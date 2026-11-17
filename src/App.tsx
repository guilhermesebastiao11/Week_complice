import { useCallback, useEffect, useState } from 'react';
import { AdminAuthGate } from './components/AdminAuthGate.tsx';
import { AdminPanel } from './components/AdminPanel.tsx';
import { ArticleDetail } from './components/ArticleDetail.tsx';
import type { FontScaleOption } from './components/FontScaleControl.tsx';
import { NewsPortal } from './components/NewsPortal.tsx';
import { NewsletterFooter } from './components/NewsletterFooter.tsx';
import { useRealtimeSocket } from './hooks/useWebSocket.ts';
import type { AdminAuthStatus, Article, Category, WsServerMessage } from './types.ts';
import { adminFetch, setAdminToken } from './utils/adminAuth.ts';

type AppView =
  | { mode: 'portal' }
  | { mode: 'article'; articleId: string }
  | { mode: 'admin'; editArticle?: Article | null };

const THEME_STORAGE_KEY = 'complice_theme';
const FONT_SCALE_STORAGE_KEY = 'complice_font_scale';

function readInitialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light') return 'light';
  } catch {
    // Ignore storage issues
  }
  return 'dark';
}

function readInitialFontScale(): FontScaleOption {
  try {
    const saved = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    if (saved === '0.9' || saved === '1' || saved === '1.12' || saved === '1.24') {
      return saved;
    }
  } catch {
    // Ignore storage issues
  }
  return '1';
}

function readInitialUrlState(): { view: AppView; categorySlug: string } {
  const params = new URLSearchParams(window.location.search);
  const artigo = params.get('artigo');
  const painel = params.get('painel');
  const categoria = params.get('categoria') || 'all';

  if (window.location.pathname === '/admin' || painel === '1') {
    return { view: { mode: 'admin', editArticle: null }, categorySlug: categoria };
  }
  if (artigo) {
    return { view: { mode: 'article', articleId: artigo }, categorySlug: categoria };
  }
  return { view: { mode: 'portal' }, categorySlug: categoria };
}

export default function App() {
  const initialState = readInitialUrlState();
  const [theme, setTheme] = useState<'dark' | 'light'>(readInitialTheme);
  const [fontScale, setFontScale] = useState<FontScaleOption>(readInitialFontScale);
  const [view, setView] = useState<AppView>(initialState.view);
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>(
    initialState.categorySlug
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyVideo, setOnlyVideo] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus>({
    authenticated: false,
    setupRequired: false,
  });
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--reading-scale', fontScale);
    try {
      localStorage.setItem(FONT_SCALE_STORAGE_KEY, fontScale);
    } catch {
      // Ignore storage failures
    }
  }, [fontScale]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const res = await adminFetch('/api/auth/status');
      if (res.ok) {
        const data = (await res.json()) as AdminAuthStatus;
        if (!data.authenticated) {
          setAdminToken(null);
        }
        setAuthStatus(data);
      }
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const syncUrl = useCallback((nextView: AppView, catSlug: string) => {
    const params = new URLSearchParams();
    if (nextView.mode === 'article') {
      params.set('artigo', nextView.articleId);
    } else if (nextView.mode === 'admin') {
      params.set('painel', '1');
    } else if (catSlug && catSlug !== 'all') {
      params.set('categoria', catSlug);
    }
    const qs = params.toString();
    const targetUrl = qs ? `/?${qs}` : '/';
    if (window.location.pathname + window.location.search !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
  }, []);

  useEffect(() => {
    function handlePopState() {
      const next = readInitialUrlState();
      setView(next.view);
      setSelectedCategorySlug(next.categorySlug);
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Private administrator shortcuts (Ctrl+Shift+A, Cmd+Shift+A, or Alt+Shift+A)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const next: AppView = { mode: 'admin', editArticle: null };
        setView(next);
        syncUrl(next, selectedCategorySlug);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCategorySlug, syncUrl]);

  const loadCategories = useCallback(async () => {
    const res = await fetch('/api/categories');
    if (res.ok) {
      setCategories(await res.json());
    }
  }, []);

  const loadArticles = useCallback(async () => {
    const res = await fetch('/api/articles?status=published');
    if (res.ok) {
      setArticles(await res.json());
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadCategories(), loadArticles()]);
  }, [loadCategories, loadArticles]);

  useEffect(() => {
    setLoading(true);
    refreshAll().finally(() => setLoading(false));
  }, [refreshAll]);

  const handleGlobalWs = useCallback(
    (msg: WsServerMessage) => {
      if (msg.type === 'article:updated' || msg.type === 'category:updated') {
        refreshAll();
      }
    },
    [refreshAll]
  );

  useRealtimeSocket(handleGlobalWs);

  const topNavCategories = categories.slice(0, 4);

  const globalFeaturedArticle =
    articles.find((a) => a.featured) || articles[0] || undefined;

  const visibleArticles = articles.filter((a) => {
    if (selectedCategorySlug !== 'all') {
      const cat = categories.find(
        (c) => c.slug === selectedCategorySlug || c.id === selectedCategorySlug
      );
      if (!cat || a.categoryId !== cat.id) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.author.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function navigateToPortal(categorySlug = selectedCategorySlug) {
    setSelectedCategorySlug(categorySlug);
    const next: AppView = { mode: 'portal' };
    setView(next);
    syncUrl(next, categorySlug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigateToArticle(articleId: string) {
    const next: AppView = { mode: 'article', articleId };
    setView(next);
    syncUrl(next, selectedCategorySlug);
  }

  function navigateToAdmin(editArticle: Article | null = null) {
    const next: AppView = { mode: 'admin', editArticle };
    setView(next);
    syncUrl(next, selectedCategorySlug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleLogout() {
    await adminFetch('/api/auth/logout', { method: 'POST' });
    setAdminToken(null);
    setAuthStatus({ authenticated: false, setupRequired: false });
    navigateToPortal('all');
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] dark:bg-[#0E0F12] text-[#171614] dark:text-[#F2EFE9] transition-colors duration-200">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-[#FBF9F5]/95 dark:bg-[#0E0F12]/95 backdrop-blur-sm border-b border-[#E6E1D6] dark:border-[#262932]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateToPortal('all');
            }}
            className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#171614] dark:text-[#F2EFE9] whitespace-nowrap shrink-0"
          >
            Complice Week Lusophone
          </a>

          {/* Zone 2: 4-5 Concise Single-Line Nav Links */}
          <nav
            aria-label="Secções principais"
            className="hidden md:flex items-center gap-6 text-xs font-medium text-[#47433D] dark:text-[#A9A398]"
          >
            <button
              type="button"
              onClick={() => navigateToPortal('all')}
              className={`hover:text-[#171614] dark:hover:text-[#F2EFE9] transition-colors cursor-pointer whitespace-nowrap shrink-0 pb-0.5 ${
                view.mode !== 'admin' && selectedCategorySlug === 'all'
                  ? 'text-[#171614] dark:text-[#F2EFE9] border-b border-[#171614] dark:border-[#F2EFE9]'
                  : ''
              }`}
            >
              Destaques
            </button>
            {topNavCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigateToPortal(cat.slug)}
                className={`hover:text-[#171614] dark:hover:text-[#F2EFE9] transition-colors cursor-pointer whitespace-nowrap shrink-0 pb-0.5 ${
                  view.mode !== 'admin' && selectedCategorySlug === cat.slug
                    ? 'text-[#171614] dark:text-[#F2EFE9] border-b border-[#171614] dark:border-[#F2EFE9]'
                    : ''
                }`}
              >
                {cat.name.split(' & ')[0]}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary CTA (Admin actions visible ONLY when authenticated as Admin) */}
          <div className="flex items-center shrink-0">
            {authStatus.authenticated ? (
              view.mode === 'admin' ? (
                <button
                  type="button"
                  onClick={() => navigateToPortal(selectedCategorySlug)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#171614] hover:bg-[#2F2C27] dark:bg-[#F2EFE9] dark:text-[#0E0F12] dark:hover:bg-[#E0DBD1] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Ver Jornal
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateToAdmin(null)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172D6E] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Painel Admin
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOnlyVideo((v) => !v);
                  if (view.mode !== 'portal') {
                    navigateToPortal(selectedCategorySlug);
                  }
                }}
                className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  onlyVideo
                    ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-white'
                    : 'bg-[#171614] text-white hover:bg-[#2F2C27] dark:bg-[#1D2027] dark:text-[#F2EFE9] dark:border dark:border-[#2F333E] dark:hover:bg-[#262A33]'
                }`}
              >
                {onlyVideo ? 'Todas as Notícias' : 'Reportagens em Vídeo'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {view.mode === 'portal' && (
          loading && articles.length === 0 ? (
            <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
              <div className="h-10 w-full bg-[#EBE6DF] dark:bg-[#1D2027] animate-pulse" />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 aspect-[16/9] bg-[#EBE6DF] dark:bg-[#1D2027] animate-pulse" />
                <div className="lg:col-span-5 space-y-4">
                  <div className="h-8 bg-[#EBE6DF] dark:bg-[#1D2027] animate-pulse" />
                  <div className="h-24 bg-[#EBE6DF] dark:bg-[#1D2027] animate-pulse" />
                </div>
              </div>
            </div>
          ) : (
            <NewsPortal
              articles={visibleArticles}
              featuredArticle={globalFeaturedArticle}
              categories={categories}
              selectedCategorySlug={selectedCategorySlug}
              searchQuery={searchQuery}
              onlyVideo={onlyVideo}
              theme={theme}
              fontScale={fontScale}
              onToggleTheme={toggleTheme}
              onChangeFontScale={setFontScale}
              onSelectCategory={(slug) => {
                setSelectedCategorySlug(slug);
                syncUrl({ mode: 'portal' }, slug);
              }}
              onSearchChange={setSearchQuery}
              onToggleOnlyVideo={() => setOnlyVideo((v) => !v)}
              onOpenArticle={navigateToArticle}
            />
          )
        )}

        {view.mode === 'article' && (
          <ArticleDetail
            articleId={view.articleId}
            categories={categories}
            allArticles={articles}
            isAdmin={authStatus.authenticated}
            theme={theme}
            fontScale={fontScale}
            onToggleTheme={toggleTheme}
            onChangeFontScale={setFontScale}
            onBack={() => navigateToPortal(selectedCategorySlug)}
            onSelectCategory={(slug) => navigateToPortal(slug)}
            onOpenArticle={navigateToArticle}
            onEditInAdmin={(article) => navigateToAdmin(article)}
            onCommentCountUpdate={loadArticles}
          />
        )}

        {view.mode === 'admin' && (
          !authChecked ? (
            <div className="max-w-md mx-auto px-6 py-20">
              <div className="h-64 bg-[#EBE6DF] dark:bg-[#1D2027] animate-pulse" />
            </div>
          ) : authStatus.authenticated ? (
            <AdminPanel
              categories={categories}
              adminEmail={authStatus.adminEmail}
              initialEditArticle={view.editArticle}
              theme={theme}
              onToggleTheme={toggleTheme}
              onRefreshAll={refreshAll}
              onViewArticle={navigateToArticle}
              onLogout={handleLogout}
              onUnauthorized={() => {
                setAdminToken(null);
                setAuthStatus({ authenticated: false, setupRequired: false });
              }}
            />
          ) : (
            <AdminAuthGate
              setupRequired={authStatus.setupRequired}
              onAuthenticated={(status) => {
                setAuthStatus(status);
              }}
              onBackToPortal={() => navigateToPortal(selectedCategorySlug)}
            />
          )
        )}
      </main>

      <NewsletterFooter
        categories={categories}
        theme={theme}
        fontScale={fontScale}
        onToggleTheme={toggleTheme}
        onChangeFontScale={setFontScale}
        onSelectCategory={(slug) => navigateToPortal(slug)}
        onOpenAdmin={() => navigateToAdmin(null)}
      />
    </div>
  );
}
