import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Film,
  FolderKanban,
  Image as ImageIcon,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  Pencil,
  Plus,
  Search,
  Star,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRealtimeSocket } from '../hooks/useWebSocket.ts';
import type {
  Article,
  Category,
  Comment,
  NewsletterSubscriber,
  UploadedAsset,
  WsServerMessage,
} from '../types.ts';
import { adminFetch } from '../utils/adminAuth.ts';
import { formatBytes, formatDateTime, formatEditorialDate } from '../utils/format.ts';
import { ArticleEditor } from './ArticleEditor.tsx';
import { CategoryManager } from './CategoryManager.tsx';

export type AdminTab =
  | 'articles'
  | 'editor'
  | 'categories'
  | 'comments'
  | 'media'
  | 'newsletter';

interface AdminPanelProps {
  categories: Category[];
  adminEmail?: string;
  initialEditArticle?: Article | null;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onRefreshAll: () => Promise<void>;
  onViewArticle: (articleId: string) => void;
  onLogout: () => Promise<void>;
  onUnauthorized: () => void;
}

export function AdminPanel({
  categories,
  adminEmail,
  initialEditArticle = null,
  theme,
  onToggleTheme,
  onRefreshAll,
  onViewArticle,
  onLogout,
  onUnauthorized,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(
    initialEditArticle ? 'editor' : 'articles'
  );
  const [articles, setArticles] = useState<Article[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [mediaAssets, setMediaAssets] = useState<UploadedAsset[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [editingArticle, setEditingArticle] = useState<Article | null>(initialEditArticle);
  const [prefillMedia, setPrefillMedia] = useState<{
    url: string;
    mediaType: 'image' | 'video';
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [commentSearch, setCommentSearch] = useState('');
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [dragOverMedia, setDragOverMedia] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const mediaUploadInputRef = useRef<HTMLInputElement | null>(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [artRes, comRes, medRes, subRes] = await Promise.all([
        adminFetch('/api/articles?status=all'),
        adminFetch('/api/comments'),
        adminFetch('/api/media'),
        adminFetch('/api/newsletter/subscribers'),
      ]);
      if (
        artRes.status === 401 ||
        comRes.status === 401 ||
        medRes.status === 401 ||
        subRes.status === 401
      ) {
        onUnauthorized();
        return;
      }
      if (artRes.ok) setArticles(await artRes.json());
      if (comRes.ok) setComments(await comRes.json());
      if (medRes.ok) setMediaAssets(await medRes.json());
      if (subRes.ok) setSubscribers(await subRes.json());
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    if (initialEditArticle) {
      setEditingArticle(initialEditArticle);
      setActiveTab('editor');
    }
  }, [initialEditArticle]);

  const handleWsMessage = useCallback(
    (msg: WsServerMessage) => {
      if (msg.type === 'comment:created') {
        setComments((prev) => {
          if (prev.some((c) => c.id === msg.comment.id)) return prev;
          return [msg.comment, ...prev];
        });
        loadAdminData();
      } else if (msg.type === 'comment:deleted') {
        setComments((prev) => prev.filter((c) => c.id !== msg.commentId));
      } else if (msg.type === 'article:updated' || msg.type === 'category:updated') {
        loadAdminData();
      }
    },
    [loadAdminData]
  );

  const { status: wsStatus, sendMessage } = useRealtimeSocket(handleWsMessage);

  useEffect(() => {
    sendMessage({ type: 'join_admin' });
  }, [sendMessage]);

  async function handleDeleteArticle(id: string) {
    const res = await adminFetch(`/api/articles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await loadAdminData();
      await onRefreshAll();
    }
  }

  async function handleToggleStatus(article: Article) {
    const nextStatus = article.status === 'published' ? 'draft' : 'published';
    const res = await adminFetch(`/api/articles/${encodeURIComponent(article.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      await loadAdminData();
      await onRefreshAll();
    }
  }

  async function handleSetFeatured(article: Article) {
    const res = await adminFetch(`/api/articles/${encodeURIComponent(article.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: !article.featured }),
    });
    if (res.ok) {
      await loadAdminData();
      await onRefreshAll();
    }
  }

  async function handleDeleteComment(commentId: string) {
    const res = await adminFetch(`/api/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      await loadAdminData();
      await onRefreshAll();
    }
  }

  async function handleDeleteSubscriber(id: string) {
    const res = await adminFetch(`/api/newsletter/subscribers/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
    }
  }

  function handleCopyAllEmails() {
    const list = subscribers.map((s) => s.email).join(', ');
    if (!list) return;
    navigator.clipboard?.writeText(list).catch(() => {});
    setCopiedEmails(true);
    window.setTimeout(() => setCopiedEmails(false), 2000);
  }

  function handleExportSubscribersCsv() {
    const header = 'Nome,Email,Data de Subscricao\n';
    const rows = subscribers
      .map(
        (s) =>
          `"${(s.name || '').replace(/"/g, '""')}","${s.email.replace(/"/g, '""')}","${s.subscribedAt}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'complice-week-newsletter-subscritores.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function uploadMediaFile(file: File) {
    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await adminFetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        await loadAdminData();
      }
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleLibraryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadMediaFile(file);
    e.target.value = '';
  }

  async function handleDeleteMedia(filename: string) {
    const res = await adminFetch(`/api/media/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await loadAdminData();
    }
  }

  async function handleExportBackup() {
    const res = await adminFetch('/api/export');
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'complice-week-lusophone-backup.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function copyAssetUrl(url: string) {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedUrl(url);
    window.setTimeout(() => setCopiedUrl(null), 2000);
  }

  const filteredArticles = articles.filter((a) => {
    const matchesCat = categoryFilter === 'all' || a.categoryId === categoryFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.author.toLowerCase().includes(q) ||
      a.location.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const filteredComments = comments.filter((c) => {
    const q = commentSearch.trim().toLowerCase();
    if (!q) return true;
    const articleTitle = articles.find((a) => a.id === c.articleId)?.title ?? '';
    return (
      c.authorName.toLowerCase().includes(q) ||
      c.content.toLowerCase().includes(q) ||
      articleTitle.toLowerCase().includes(q)
    );
  });

  const filteredSubscribers = subscribers.filter((s) => {
    const q = subscriberSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      s.email.toLowerCase().includes(q) ||
      (s.name ?? '').toLowerCase().includes(q)
    );
  });

  const publishedCount = articles.filter((a) => a.status === 'published').length;
  const draftCount = articles.filter((a) => a.status === 'draft').length;

  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? 'Sem categoria';

  const getArticleTitle = (id: string) =>
    articles.find((a) => a.id === id)?.title ?? 'Artigo removido';

  const tabTitles: Record<AdminTab, string> = {
    articles: 'Gestão de Artigos',
    editor: editingArticle ? 'Editar Artigo' : 'Novo Artigo',
    categories: 'Gestão de Categorias',
    comments: 'Moderação de Comentários em Tempo Real',
    media: 'Biblioteca de Imagens & Vídeos',
    newsletter: 'Subscritores da Newsletter',
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sidebar */}
        <aside className="lg:col-span-3 bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] p-4 space-y-6">
          <div>
            <p className="text-xs font-semibold text-[#635E56] dark:text-[#9B968C] mb-3 px-2">
              Redação &amp; Conteúdo
            </p>
            <nav className="space-y-1" aria-label="Navegação administrativa">
              <button
                type="button"
                onClick={() => {
                  setEditingArticle(null);
                  setPrefillMedia(null);
                  setActiveTab('articles');
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'articles'
                    ? 'bg-[#171614] text-white dark:bg-[#F2EFE9] dark:text-[#0E0F12]'
                    : 'text-[#47433D] dark:text-[#C5BFB4] hover:bg-[#F2EDE4] dark:hover:bg-[#1D2027]'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <FileText className="w-4 h-4" />
                  <span>Artigos</span>
                </span>
                <span className="font-mono tabular-nums opacity-80">{articles.length}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingArticle(null);
                  setPrefillMedia(null);
                  setActiveTab('editor');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'editor'
                    ? 'bg-[#171614] text-white dark:bg-[#F2EFE9] dark:text-[#0E0F12]'
                    : 'text-[#47433D] dark:text-[#C5BFB4] hover:bg-[#F2EDE4] dark:hover:bg-[#1D2027]'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Novo Artigo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('categories')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'categories'
                    ? 'bg-[#171614] text-white dark:bg-[#F2EFE9] dark:text-[#0E0F12]'
                    : 'text-[#47433D] dark:text-[#C5BFB4] hover:bg-[#F2EDE4] dark:hover:bg-[#1D2027]'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <FolderKanban className="w-4 h-4" />
                  <span>Categorias</span>
                </span>
                <span className="font-mono tabular-nums opacity-80">{categories.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('media')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'media'
                    ? 'bg-[#171614] text-white dark:bg-[#F2EFE9] dark:text-[#0E0F12]'
                    : 'text-[#47433D] dark:text-[#C5BFB4] hover:bg-[#F2EDE4] dark:hover:bg-[#1D2027]'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <ImageIcon className="w-4 h-4" />
                  <span>Imagens &amp; Vídeos</span>
                </span>
                <span className="font-mono tabular-nums opacity-80">{mediaAssets.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('comments')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'comments'
                    ? 'bg-[#171614] text-white dark:bg-[#F2EFE9] dark:text-[#0E0F12]'
                    : 'text-[#47433D] dark:text-[#C5BFB4] hover:bg-[#F2EDE4] dark:hover:bg-[#1D2027]'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4" />
                  <span>Comentários</span>
                </span>
                <span className="font-mono tabular-nums opacity-80">{comments.length}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('newsletter')}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'newsletter'
                    ? 'bg-[#171614] text-white dark:bg-[#F2EFE9] dark:text-[#0E0F12]'
                    : 'text-[#47433D] dark:text-[#C5BFB4] hover:bg-[#F2EDE4] dark:hover:bg-[#1D2027]'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Mail className="w-4 h-4" />
                  <span>Newsletter</span>
                </span>
                <span className="font-mono tabular-nums opacity-80">{subscribers.length}</span>
              </button>
            </nav>
          </div>

          <div className="pt-4 border-t border-[#E6E1D6] dark:border-[#262932] px-2 space-y-3 text-xs text-[#635E56] dark:text-[#9B968C]">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsStatus === 'connected' ? 'bg-[#15803D] dark:bg-[#4ADE80]' : 'bg-[#B45309] dark:bg-[#F59E0B]'
                }`}
                aria-hidden="true"
              />
              <span>
                {wsStatus === 'connected'
                  ? 'Sincronização em tempo real ativa'
                  : 'A ligar WebSocket...'}
              </span>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] hover:text-[#171614] dark:hover:text-[#F2EFE9] cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Alternar para Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>Alternar para Modo Escuro</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Backup JSON</span>
            </button>

            <div className="pt-3 border-t border-[#E6E1D6] dark:border-[#262932] space-y-2">
              {adminEmail && (
                <p className="text-[11px] font-mono text-[#47433D] dark:text-[#C5BFB4] truncate" title={adminEmail}>
                  {adminEmail}
                </p>
              )}
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9A3412] dark:text-[#FB923C] hover:underline cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Terminar Sessão</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="lg:col-span-9 space-y-6">
          {/* Breadcrumb Top Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E6E1D6] dark:border-[#262932]">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#635E56] dark:text-[#9B968C] mb-1">
                <span>Complice Week Lusophone</span>
                <span>/</span>
                <span>Painel Admin</span>
                <span>/</span>
                <span className="text-[#171614] dark:text-[#F2EFE9] font-medium">{tabTitles[activeTab]}</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#171614] dark:text-[#F2EFE9]">
                {tabTitles[activeTab]}
              </h1>
            </div>

            {activeTab !== 'editor' && (
              <button
                type="button"
                onClick={() => {
                  setEditingArticle(null);
                  setPrefillMedia(null);
                  setActiveTab('editor');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172D6E] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Artigo</span>
              </button>
            )}
          </div>

          {/* Real Editorial Overview Metrics Strip */}
          {activeTab === 'articles' && (
            <div className="grid grid-cols-2 sm:grid-cols-6 bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] divide-y sm:divide-y-0 sm:divide-x divide-[#E6E1D6] dark:divide-[#262932]">
              <div className="p-4">
                <p className="text-xs text-[#635E56] dark:text-[#9B968C]">Publicados</p>
                <p className="font-mono text-2xl font-semibold text-[#171614] dark:text-[#F2EFE9] tabular-nums mt-1">
                  {publishedCount}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-[#635E56] dark:text-[#9B968C]">Rascunhos</p>
                <p className="font-mono text-2xl font-semibold text-[#171614] dark:text-[#F2EFE9] tabular-nums mt-1">
                  {draftCount}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-[#635E56] dark:text-[#9B968C]">Categorias</p>
                <p className="font-mono text-2xl font-semibold text-[#171614] dark:text-[#F2EFE9] tabular-nums mt-1">
                  {categories.length}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-[#635E56] dark:text-[#9B968C]">Comentários</p>
                <p className="font-mono text-2xl font-semibold text-[#171614] dark:text-[#F2EFE9] tabular-nums mt-1">
                  {comments.length}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-[#635E56] dark:text-[#9B968C]">Multimédia</p>
                <p className="font-mono text-2xl font-semibold text-[#171614] dark:text-[#F2EFE9] tabular-nums mt-1">
                  {mediaAssets.length}
                </p>
              </div>
              <div className="p-4">
                <p className="text-xs text-[#635E56] dark:text-[#9B968C]">Newsletter</p>
                <p className="font-mono text-2xl font-semibold text-[#171614] dark:text-[#F2EFE9] tabular-nums mt-1">
                  {subscribers.length}
                </p>
              </div>
            </div>
          )}

          {/* Tab 1: Articles Table */}
          {activeTab === 'articles' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="w-3.5 h-3.5 text-[#8C8478] dark:text-[#78746D] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrar por título, autor ou cidade..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#191C23] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-white dark:bg-[#191C23] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9]"
                >
                  <option value="all">Todas as categorias</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <div className="bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] p-8 space-y-3">
                  <div className="h-8 bg-[#EBE6DF] dark:bg-[#1D2027] animate-pulse" />
                  <div className="h-8 bg-[#EBE6DF] dark:bg-[#1D2027] animate-pulse" />
                  <div className="h-8 bg-[#EBE6DF] dark:bg-[#1D2027] animate-pulse" />
                </div>
              ) : filteredArticles.length === 0 ? (
                <div className="bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] p-12 text-center">
                  <p className="font-serif text-xl text-[#171614] dark:text-[#F2EFE9] mb-2">
                    Nenhum artigo encontrado
                  </p>
                  <p className="text-xs text-[#635E56] dark:text-[#9B968C] mb-5">
                    Crie uma nova reportagem com imagens ou vídeos para publicar no jornal.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingArticle(null);
                      setActiveTab('editor');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A8A] dark:bg-[#2563EB] cursor-pointer"
                  >
                    Criar Primeiro Artigo
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E6E1D6] dark:border-[#262932] bg-[#F6F2EA] dark:bg-[#1D2027] text-xs font-semibold text-[#47433D] dark:text-[#C5BFB4]">
                        <th className="py-3 px-4">Capa</th>
                        <th className="py-3 px-4">Artigo</th>
                        <th className="py-3 px-4">Categoria</th>
                        <th className="py-3 px-4">Multimédia</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Coment.</th>
                        <th className="py-3 px-4 text-right">Data</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E1D6] dark:divide-[#262932] text-xs">
                      {filteredArticles.map((art) => (
                        <tr key={art.id} className="hover:bg-[#FBF9F5] dark:hover:bg-[#1B1E25]">
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleSetFeatured(art)}
                              title={
                                art.featured
                                  ? 'Manchete principal ativa'
                                  : 'Promover a manchete principal'
                              }
                              className={`p-1 cursor-pointer ${
                                art.featured
                                  ? 'text-[#B45309] dark:text-[#F59E0B]'
                                  : 'text-[#C2B9AA] dark:text-[#4F5461] hover:text-[#47433D] dark:hover:text-[#C5BFB4]'
                              }`}
                            >
                              <Star
                                className={`w-4 h-4 ${
                                  art.featured ? 'fill-[#B45309] dark:fill-[#F59E0B]' : ''
                                }`}
                              />
                            </button>
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <p className="font-serif text-sm font-semibold text-[#171614] dark:text-[#F2EFE9] line-clamp-1">
                              {art.title}
                            </p>
                            <p className="text-[#635E56] dark:text-[#9B968C] mt-0.5">
                              {art.author} · {art.location}
                              {art.featured ? ' · Manchete Principal' : ''}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-[#47433D] dark:text-[#C5BFB4] whitespace-nowrap">
                            {getCategoryName(art.categoryId)}
                          </td>
                          <td className="py-3 px-4 text-[#47433D] dark:text-[#C5BFB4] whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              {art.coverImage && (
                                <ImageIcon className="w-3.5 h-3.5 text-[#635E56] dark:text-[#9B968C]" />
                              )}
                              {(art.videoUrl || art.mediaGallery.some((m) => m.type === 'video')) && (
                                <Film className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" />
                              )}
                              {!art.coverImage && !art.videoUrl && 'Texto'}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(art)}
                              className={`font-medium hover:underline cursor-pointer ${
                                art.status === 'published'
                                  ? 'text-[#15803D] dark:text-[#4ADE80]'
                                  : 'text-[#B45309] dark:text-[#F59E0B]'
                              }`}
                            >
                              {art.status === 'published' ? 'Publicado' : 'Rascunho'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-[#171614] dark:text-[#F2EFE9]">
                            {art.commentCount ?? 0}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-[#635E56] dark:text-[#9B968C] whitespace-nowrap">
                            {formatEditorialDate(art.publishedAt)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onViewArticle(art.id)}
                                title="Ver no portal"
                                className="p-1.5 text-[#47433D] dark:text-[#C5BFB4] hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] hover:bg-[#EBE6DF] dark:hover:bg-[#262932] cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingArticle(art);
                                  setPrefillMedia(null);
                                  setActiveTab('editor');
                                }}
                                title="Editar artigo"
                                className="p-1.5 text-[#47433D] dark:text-[#C5BFB4] hover:text-[#1E3A8A] dark:hover:text-[#60A5FA] hover:bg-[#EBE6DF] dark:hover:bg-[#262932] cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteArticle(art.id)}
                                title="Excluir artigo"
                                className="p-1.5 text-[#47433D] dark:text-[#C5BFB4] hover:text-[#9A3412] dark:hover:text-[#FB923C] hover:bg-[#FEE2E2] dark:hover:bg-[#2D1816] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Article Editor */}
          {activeTab === 'editor' && (
            <ArticleEditor
              key={editingArticle?.id ?? prefillMedia?.url ?? 'new'}
              article={editingArticle}
              categories={categories}
              initialMediaUrl={prefillMedia}
              onCancel={() => {
                setEditingArticle(null);
                setPrefillMedia(null);
                setActiveTab('articles');
              }}
              onSaved={async () => {
                setEditingArticle(null);
                setPrefillMedia(null);
                await loadAdminData();
                await onRefreshAll();
                setActiveTab('articles');
              }}
            />
          )}

          {/* Tab 3: Category Manager */}
          {activeTab === 'categories' && (
            <CategoryManager
              categories={categories}
              onRefresh={async () => {
                await loadAdminData();
                await onRefreshAll();
              }}
            />
          )}

          {/* Tab 4: Media Library with Drag & Drop + Delete */}
          {activeTab === 'media' && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverMedia(true);
                }}
                onDragLeave={() => setDragOverMedia(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragOverMedia(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) await uploadMediaFile(file);
                }}
                className={`border p-6 flex flex-wrap items-center justify-between gap-4 transition-colors ${
                  dragOverMedia
                    ? 'border-[#1E3A8A] dark:border-[#60A5FA] bg-[#F0F4FF] dark:bg-[#1A2233]'
                    : 'border-[#E6E1D6] dark:border-[#2A2D36] bg-white dark:bg-[#16181D]'
                }`}
              >
                <div>
                  <h2 className="font-serif text-lg font-semibold text-[#171614] dark:text-[#F2EFE9]">
                    Carregar Novas Imagens ou Vídeos
                  </h2>
                  <p className="text-xs text-[#635E56] dark:text-[#9B968C] mt-1">
                    Arraste ficheiros para aqui ou clique para carregar JPG, PNG, WebP, MP4, WebM ou MOV até 100 MB.
                  </p>
                </div>

                <div>
                  <input
                    ref={mediaUploadInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleLibraryUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => mediaUploadInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172D6E] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploadingMedia ? 'A carregar...' : 'Enviar Ficheiro Multimédia'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {mediaAssets.map((asset) => (
                  <div
                    key={asset.url}
                    className="bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[16/10] bg-[#0E0F12] overflow-hidden">
                        {asset.mediaType === 'video' ? (
                          <video
                            src={asset.url}
                            controls
                            preload="metadata"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <img
                            src={asset.url}
                            alt={asset.filename}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="p-4">
                        <p className="text-xs font-medium text-[#171614] dark:text-[#F2EFE9] truncate">
                          {asset.filename}
                        </p>
                        <p className="font-mono text-[11px] text-[#635E56] dark:text-[#9B968C] mt-1 tabular-nums">
                          {asset.mediaType === 'video' ? 'Vídeo' : 'Imagem'} · {formatBytes(asset.size)}
                        </p>
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-[#E6E1D6] dark:border-[#262932] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => copyAssetUrl(asset.url)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] hover:text-[#171614] dark:hover:text-white cursor-pointer"
                      >
                        {copiedUrl === asset.url ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#15803D] dark:text-[#4ADE80]" />
                            <span className="text-[#15803D] dark:text-[#4ADE80]">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar URL</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingArticle(null);
                            setPrefillMedia({ url: asset.url, mediaType: asset.mediaType });
                            setActiveTab('editor');
                          }}
                          className="text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
                        >
                          Usar
                        </button>
                        {asset.deletable && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMedia(asset.filename)}
                            title="Eliminar ficheiro carregado"
                            className="p-1 text-[#635E56] dark:text-[#9B968C] hover:text-[#9A3412] dark:hover:text-[#FB923C] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 5: Real-Time Comment Moderation with Search */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="w-3.5 h-3.5 text-[#8C8478] dark:text-[#78746D] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={commentSearch}
                  onChange={(e) => setCommentSearch(e.target.value)}
                  placeholder="Filtrar comentários por leitor ou artigo..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#191C23] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
                />
              </div>

              <div className="bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] overflow-x-auto">
                {filteredComments.length === 0 ? (
                  <div className="p-12 text-center text-sm text-[#635E56] dark:text-[#9B968C]">
                    Nenhum comentário encontrado nesta seleção.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E6E1D6] dark:border-[#262932] bg-[#F6F2EA] dark:bg-[#1D2027] text-xs font-semibold text-[#47433D] dark:text-[#C5BFB4]">
                        <th className="py-3 px-4">Leitor</th>
                        <th className="py-3 px-4">Comentário</th>
                        <th className="py-3 px-4">Artigo</th>
                        <th className="py-3 px-4 text-right">Data</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E1D6] dark:divide-[#262932] text-xs">
                      {filteredComments.map((comment) => (
                        <tr key={comment.id} className="hover:bg-[#FBF9F5] dark:hover:bg-[#1B1E25]">
                          <td className="py-3.5 px-4 font-semibold text-[#171614] dark:text-[#F2EFE9] whitespace-nowrap align-top">
                            {comment.authorName}
                            {comment.parentId && (
                              <span className="block font-normal text-[11px] text-[#635E56] dark:text-[#9B968C]">
                                Resposta
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-[#2F2C27] dark:text-[#D6D2C9] max-w-md leading-relaxed align-top">
                            {comment.content}
                          </td>
                          <td className="py-3.5 px-4 text-[#1E3A8A] dark:text-[#60A5FA] max-w-xs align-top">
                            <button
                              type="button"
                              onClick={() => onViewArticle(comment.articleId)}
                              className="text-left hover:underline line-clamp-2 cursor-pointer"
                            >
                              {getArticleTitle(comment.articleId)}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#635E56] dark:text-[#9B968C] whitespace-nowrap align-top">
                            {formatDateTime(comment.createdAt)}
                          </td>
                          <td className="py-3.5 px-4 text-right align-top">
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comment.id)}
                              title="Remover comentário em tempo real"
                              className="p-1.5 text-[#47433D] dark:text-[#C5BFB4] hover:text-[#9A3412] dark:hover:text-[#FB923C] hover:bg-[#FEE2E2] dark:hover:bg-[#2D1816] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Tab 6: Newsletter Subscribers */}
          {activeTab === 'newsletter' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="w-3.5 h-3.5 text-[#8C8478] dark:text-[#78746D] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={subscriberSearch}
                    onChange={(e) => setSubscriberSearch(e.target.value)}
                    placeholder="Filtrar subscritores por nome ou e-mail..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#191C23] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAllEmails}
                    disabled={subscribers.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white dark:bg-[#191C23] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] hover:border-[#171614] dark:hover:border-[#60A5FA] disabled:opacity-50 cursor-pointer"
                  >
                    {copiedEmails ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#15803D] dark:text-[#4ADE80]" />
                        <span>E-mails copiados</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Todos os E-mails</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportSubscribersCsv}
                    disabled={subscribers.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172D6E] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar CSV</span>
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] overflow-x-auto">
                {filteredSubscribers.length === 0 ? (
                  <div className="p-12 text-center text-sm text-[#635E56] dark:text-[#9B968C]">
                    Nenhum leitor subscrito à newsletter ainda. Os e-mails capturados no rodapé aparecerão aqui.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E6E1D6] dark:border-[#262932] bg-[#F6F2EA] dark:bg-[#1D2027] text-xs font-semibold text-[#47433D] dark:text-[#C5BFB4]">
                        <th className="py-3 px-4">E-mail</th>
                        <th className="py-3 px-4">Nome</th>
                        <th className="py-3 px-4 text-right">Subscrito em</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E1D6] dark:divide-[#262932] text-xs">
                      {filteredSubscribers.map((sub) => (
                        <tr key={sub.id} className="hover:bg-[#FBF9F5] dark:hover:bg-[#1B1E25]">
                          <td className="py-3.5 px-4 font-mono text-[#171614] dark:text-[#F2EFE9]">
                            {sub.email}
                          </td>
                          <td className="py-3.5 px-4 text-[#47433D] dark:text-[#C5BFB4]">
                            {sub.name || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#635E56] dark:text-[#9B968C] whitespace-nowrap">
                            {formatDateTime(sub.subscribedAt)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteSubscriber(sub.id)}
                              title="Remover subscritor"
                              className="p-1.5 text-[#47433D] dark:text-[#C5BFB4] hover:text-[#9A3412] dark:hover:text-[#FB923C] hover:bg-[#FEE2E2] dark:hover:bg-[#2D1816] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
