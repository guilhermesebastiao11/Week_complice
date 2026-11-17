import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import type { UploadedAsset, WsClientMessage, WsServerMessage } from './src/types.ts';
import {
  clearSessionCookie,
  createSessionToken,
  getAdminFromRequest,
  hashPassword,
  isEnvAdminConfigured,
  requireAdmin,
  setSessionCookie,
  verifyAdminCredentials,
} from './server/auth.ts';
import { store } from './server/store.ts';

const PORT = 3000;
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const GENERATED_IMAGES_DIR = path.resolve(process.cwd(), 'src/assets/images');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const safeName = file.originalname
      .replace(ext, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40);
    cb(null, `${Date.now()}-${safeName || 'media'}-${crypto.randomUUID().slice(0, 6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Formato não suportado. Envie ficheiros de imagem ou vídeo.'));
    }
  },
});

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  interface ClientMeta {
    articleIds: Set<string>;
    isAdmin: boolean;
    canBeAdmin: boolean;
  }
  const clients = new Map<WebSocket, ClientMeta>();

  function sendWs(ws: WebSocket, payload: WsServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function countActiveReaders(articleId: string): number {
    let count = 0;
    for (const [client, meta] of clients.entries()) {
      if (client.readyState === WebSocket.OPEN && meta.articleIds.has(articleId)) {
        count += 1;
      }
    }
    return count;
  }

  function broadcastToArticle(articleId: string, payload: WsServerMessage, excludeWs?: WebSocket) {
    for (const [client, meta] of clients.entries()) {
      if (excludeWs && client === excludeWs) continue;
      if (meta.articleIds.has(articleId) || meta.isAdmin) {
        sendWs(client, payload);
      }
    }
  }

  function broadcastPresence(articleId: string) {
    const activeReaders = countActiveReaders(articleId);
    broadcastToArticle(articleId, {
      type: 'presence:update',
      articleId,
      activeReaders,
    });
  }

  function broadcastGlobal(payload: WsServerMessage) {
    for (const client of clients.keys()) {
      sendWs(client, payload);
    }
  }

  wss.on('connection', (ws, req) => {
    const adminSession = getAdminFromRequest(req);
    clients.set(ws, {
      articleIds: new Set(),
      isAdmin: false,
      canBeAdmin: Boolean(adminSession),
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsClientMessage;
        const meta = clients.get(ws);
        if (!meta) return;

        if (msg.type === 'join_article' && msg.articleId) {
          meta.articleIds.add(msg.articleId);
          const comments = store.getCommentsForArticle(msg.articleId);
          const activeReaders = countActiveReaders(msg.articleId);
          sendWs(ws, {
            type: 'comments:init',
            articleId: msg.articleId,
            comments,
            activeReaders,
          });
          broadcastPresence(msg.articleId);
        } else if (msg.type === 'leave_article' && msg.articleId) {
          meta.articleIds.delete(msg.articleId);
          broadcastPresence(msg.articleId);
        } else if (msg.type === 'join_admin') {
          if (meta.canBeAdmin) {
            meta.isAdmin = true;
          } else {
            sendWs(ws, { type: 'error', message: 'Sessão administrativa necessária.' });
          }
        } else if (msg.type === 'typing' && msg.articleId && msg.authorName.trim()) {
          broadcastToArticle(
            msg.articleId,
            {
              type: 'typing:update',
              articleId: msg.articleId,
              authorName: msg.authorName.trim().slice(0, 40),
              isTyping: Boolean(msg.isTyping),
            },
            ws
          );
        } else if (msg.type === 'create_comment') {
          const comment = store.createComment({
            articleId: msg.articleId,
            authorName: msg.authorName,
            content: msg.content,
            parentId: msg.parentId,
          });
          broadcastToArticle(msg.articleId, {
            type: 'comment:created',
            articleId: msg.articleId,
            comment,
          });
          broadcastGlobal({ type: 'article:updated' });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Mensagem WebSocket inválida.';
        sendWs(ws, { type: 'error', message });
      }
    });

    ws.on('close', () => {
      const meta = clients.get(ws);
      const joined = meta ? Array.from(meta.articleIds) : [];
      clients.delete(ws);
      for (const articleId of joined) {
        broadcastPresence(articleId);
      }
    });
  });

  app.use(express.json({ limit: '25mb' }));
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Administrator Authentication Routes
  app.get('/api/auth/status', (req, res) => {
    const session = getAdminFromRequest(req);
    const setupRequired = !isEnvAdminConfigured() && !store.hasAdminAccount();
    res.json({
      authenticated: Boolean(session),
      setupRequired,
      adminEmail: session?.email,
    });
  });

  app.post('/api/auth/setup', (req, res) => {
    if (isEnvAdminConfigured() || store.hasAdminAccount()) {
      res.status(403).json({ error: 'A conta de administrador já foi configurada.' });
      return;
    }
    const ownerEmail = (process.env.ADMIN_EMAIL || 'guilhermejoaosebastiao11@gmail.com')
      .trim()
      .toLowerCase();
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Indique um e-mail válido para o administrador.' });
      return;
    }
    if (email !== ownerEmail) {
      res.status(403).json({ error: 'Apenas o administrador autorizado pode configurar este painel.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'A palavra-passe deve ter pelo menos 6 caracteres.' });
      return;
    }
    const { hash, salt } = hashPassword(password);
    const account = store.setAdminAccount(email, hash, salt);
    const token = createSessionToken(account.email);
    setSessionCookie(req, res, token);
    res.status(201).json({
      authenticated: true,
      setupRequired: false,
      adminEmail: account.email,
      token,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const verifiedEmail = verifyAdminCredentials(email, password);
    if (!verifiedEmail) {
      res.status(401).json({ error: 'Credenciais de administrador inválidas.' });
      return;
    }
    const token = createSessionToken(verifiedEmail);
    setSessionCookie(req, res, token);
    res.json({
      authenticated: true,
      setupRequired: false,
      adminEmail: verifiedEmail,
      token,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post('/api/auth/change-password', requireAdmin, (req, res) => {
    if (isEnvAdminConfigured()) {
      res.status(400).json({
        error: 'As credenciais estão definidas via variáveis de ambiente do servidor.',
      });
      return;
    }
    const session = getAdminFromRequest(req);
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    if (!session || !verifyAdminCredentials(session.email, currentPassword)) {
      res.status(401).json({ error: 'Palavra-passe atual incorreta.' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'A nova palavra-passe deve ter pelo menos 6 caracteres.' });
      return;
    }
    const { hash, salt } = hashPassword(newPassword);
    store.setAdminAccount(session.email, hash, salt);
    res.json({ ok: true });
  });

  // Categories (GET public, mutations admin-only)
  app.get('/api/categories', (_req, res) => {
    res.json(store.getCategories());
  });

  app.post('/api/categories', requireAdmin, (req, res) => {
    try {
      const created = store.createCategory(req.body);
      broadcastGlobal({ type: 'category:updated' });
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao criar categoria.' });
    }
  });

  app.put('/api/categories/:id', requireAdmin, (req, res) => {
    try {
      const updated = store.updateCategory(req.params.id, req.body);
      broadcastGlobal({ type: 'category:updated' });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar categoria.' });
    }
  });

  app.delete('/api/categories/:id', requireAdmin, (req, res) => {
    try {
      const reassignToId = typeof req.query.reassignTo === 'string' ? req.query.reassignTo : undefined;
      store.deleteCategory(req.params.id, reassignToId);
      broadcastGlobal({ type: 'category:updated' });
      broadcastGlobal({ type: 'article:updated' });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao eliminar categoria.' });
    }
  });

  // Articles (Public sees published only; Admin sees all + mutations)
  app.get('/api/articles', (req, res) => {
    const isAdmin = Boolean(getAdminFromRequest(req));
    const categorySlug = typeof req.query.category === 'string' ? req.query.category : undefined;
    const requestedStatus = typeof req.query.status === 'string' ? req.query.status : 'published';
    const status = isAdmin ? requestedStatus : 'published';
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json(store.getArticles({ categorySlug, status, q }));
  });

  app.get('/api/articles/:id', (req, res) => {
    const isAdmin = Boolean(getAdminFromRequest(req));
    const article = store.getArticleById(req.params.id);
    if (!article || (article.status !== 'published' && !isAdmin)) {
      res.status(404).json({ error: 'Artigo não encontrado.' });
      return;
    }
    const comments = store.getCommentsForArticle(article.id);
    res.json({ article, comments });
  });

  app.post('/api/articles', requireAdmin, (req, res) => {
    try {
      const created = store.createArticle(req.body);
      broadcastGlobal({ type: 'article:updated' });
      broadcastGlobal({ type: 'category:updated' });
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao criar artigo.' });
    }
  });

  app.put('/api/articles/:id', requireAdmin, (req, res) => {
    try {
      const updated = store.updateArticle(req.params.id, req.body);
      broadcastGlobal({ type: 'article:updated' });
      broadcastGlobal({ type: 'category:updated' });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar artigo.' });
    }
  });

  app.post('/api/articles/:id/like', (req, res) => {
    try {
      const existing = store.getArticleById(req.params.id);
      if (!existing || existing.status !== 'published') {
        res.status(404).json({ error: 'Artigo não encontrado.' });
        return;
      }
      const updated = store.likeArticle(req.params.id);
      broadcastToArticle(updated.id, {
        type: 'article:liked',
        articleId: updated.id,
        likes: updated.likes ?? 0,
      });
      broadcastGlobal({ type: 'article:updated' });
      res.json({ likes: updated.likes ?? 0 });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Artigo não encontrado.' });
    }
  });

  app.delete('/api/articles/:id', requireAdmin, (req, res) => {
    try {
      store.deleteArticle(req.params.id);
      broadcastGlobal({ type: 'article:updated' });
      broadcastGlobal({ type: 'category:updated' });
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao eliminar artigo.' });
    }
  });

  // Comments (Public create & like; Admin list all & moderate/delete)
  app.get('/api/comments', requireAdmin, (_req, res) => {
    res.json(store.getAllComments());
  });

  app.post('/api/articles/:id/comments', (req, res) => {
    try {
      const comment = store.createComment({
        articleId: req.params.id,
        authorName: req.body.authorName ?? '',
        content: req.body.content ?? '',
        parentId: typeof req.body.parentId === 'string' ? req.body.parentId : undefined,
      });
      broadcastToArticle(req.params.id, {
        type: 'comment:created',
        articleId: req.params.id,
        comment,
      });
      broadcastGlobal({ type: 'article:updated' });
      res.status(201).json(comment);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao publicar comentário.' });
    }
  });

  app.post('/api/comments/:id/like', (req, res) => {
    try {
      const comment = store.likeComment(req.params.id);
      broadcastToArticle(comment.articleId, {
        type: 'comment:liked',
        articleId: comment.articleId,
        commentId: comment.id,
        likes: comment.likes ?? 0,
      });
      res.json({ likes: comment.likes ?? 0 });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : 'Comentário não encontrado.' });
    }
  });

  app.delete('/api/comments/:id', requireAdmin, (req, res) => {
    const removed = store.deleteComment(req.params.id);
    if (!removed) {
      res.status(404).json({ error: 'Comentário não encontrado.' });
      return;
    }
    broadcastToArticle(removed.articleId, {
      type: 'comment:deleted',
      articleId: removed.articleId,
      commentId: removed.id,
    });
    broadcastGlobal({ type: 'article:updated' });
    res.json({ ok: true });
  });

  // Media uploads & library (Admin-only)
  app.post('/api/upload', requireAdmin, upload.single('file'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum ficheiro recebido.' });
      return;
    }
    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    res.status(201).json({
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
      mediaType,
      size: req.file.size,
      originalName: req.file.originalname,
    });
  });

  app.get('/api/media', requireAdmin, (_req, res) => {
    const assets: UploadedAsset[] = [];

    if (fs.existsSync(UPLOADS_DIR)) {
      for (const file of fs.readdirSync(UPLOADS_DIR)) {
        const fullPath = path.join(UPLOADS_DIR, file);
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
        const ext = path.extname(file).toLowerCase();
        const isVideo = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'].includes(ext);
        assets.push({
          filename: file,
          url: `/uploads/${file}`,
          mediaType: isVideo ? 'video' : 'image',
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
          deletable: true,
        });
      }
    }

    if (fs.existsSync(GENERATED_IMAGES_DIR)) {
      for (const file of fs.readdirSync(GENERATED_IMAGES_DIR)) {
        const fullPath = path.join(GENERATED_IMAGES_DIR, file);
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
        assets.push({
          filename: file,
          url: `/src/assets/images/${file}`,
          mediaType: 'image',
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
          deletable: false,
        });
      }
    }

    const attachedDir = path.resolve(process.cwd(), 'public/assets/aistudio');
    if (fs.existsSync(attachedDir)) {
      for (const file of fs.readdirSync(attachedDir)) {
        const fullPath = path.join(attachedDir, file);
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
        assets.push({
          filename: file,
          url: `/assets/aistudio/${file}`,
          mediaType: 'image',
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
          deletable: false,
        });
      }
    }

    assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(assets);
  });

  app.delete('/api/media/:filename', requireAdmin, (req, res) => {
    const safeBase = path.basename(req.params.filename);
    const targetPath = path.resolve(UPLOADS_DIR, safeBase);
    if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'Nome de ficheiro inválido.' });
      return;
    }
    if (!fs.existsSync(targetPath)) {
      res.status(404).json({ error: 'Ficheiro não encontrado.' });
      return;
    }
    fs.unlinkSync(targetPath);
    res.json({ ok: true });
  });

  // Newsletter subscription (Public subscribe; Admin list & delete)
  app.post('/api/newsletter/subscribe', (req, res) => {
    try {
      const email = typeof req.body.email === 'string' ? req.body.email : '';
      const name = typeof req.body.name === 'string' ? req.body.name : undefined;
      const result = store.subscribeNewsletter({ email, name });
      res.status(result.alreadySubscribed ? 200 : 201).json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Erro ao subscrever a newsletter.',
      });
    }
  });

  app.get('/api/newsletter/subscribers', requireAdmin, (_req, res) => {
    res.json(store.getNewsletterSubscribers());
  });

  app.delete('/api/newsletter/subscribers/:id', requireAdmin, (req, res) => {
    const ok = store.deleteNewsletterSubscriber(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Subscritor não encontrado.' });
      return;
    }
    res.json({ ok: true });
  });

  // Export editorial backup JSON (Admin-only)
  app.get('/api/export', requireAdmin, (_req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="complice-week-lusophone-backup.json"');
    res.json(store.exportSnapshot());
  });

  // Multer error handler
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Erro no servidor.';
    res.status(400).json({ error: message });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Complice Week Lusophone server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
