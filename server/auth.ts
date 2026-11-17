import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { store } from './store.ts';

export const SESSION_COOKIE_NAME = 'complice_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  return store.getOrCreateSessionSecret();
}

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface SessionPayload {
  email: string;
  role: 'admin';
  exp: number;
}

export function createSessionToken(email: string): string {
  const payload: SessionPayload = {
    email,
    role: 'admin',
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function parseCookieHeader(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

export function verifySessionToken(token?: string): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as SessionPayload;
    if (payload.role !== 'admin' || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getAdminFromRequest(req: {
  headers: { cookie?: string; authorization?: string };
  url?: string;
}): SessionPayload | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    const fromBearer = verifySessionToken(bearer);
    if (fromBearer) return fromBearer;
  }

  if (req.url && req.url.includes('token=')) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const queryToken = parsedUrl.searchParams.get('token');
      if (queryToken) {
        const fromQuery = verifySessionToken(queryToken);
        if (fromQuery) return fromQuery;
      }
    } catch {
      // Ignore malformed URL
    }
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  return verifySessionToken(cookies[SESSION_COOKIE_NAME]);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const session = getAdminFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Acesso restrito ao administrador. Inicie sessão.' });
    return;
  }
  next();
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function isEnvAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length >= 6);
}

export function verifyAdminCredentials(emailInput: string, passwordInput: string): string | null {
  const normalizedEmail = emailInput.trim().toLowerCase();

  // Check env-configured credentials first if set
  if (isEnvAdminConfigured()) {
    const envEmail = (process.env.ADMIN_EMAIL || 'admin@compliceweek.com').trim().toLowerCase();
    const envPass = process.env.ADMIN_PASSWORD || '';
    if (normalizedEmail === envEmail && passwordInput === envPass) {
      return envEmail;
    }
    return null;
  }

  const admin = store.getAdminAccount();
  if (!admin) return null;
  if (admin.email.toLowerCase() !== normalizedEmail) return null;
  if (!verifyPassword(passwordInput, admin.passwordHash, admin.salt)) return null;
  return admin.email;
}
