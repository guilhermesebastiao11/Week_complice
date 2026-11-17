import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Film, Heart, Link2, MessageSquare, Moon, PenSquare, Sun } from 'lucide-react';
import { useRealtimeSocket } from '../hooks/useWebSocket.ts';
import type { Article, Category, Comment, WsServerMessage } from '../types.ts';
import { formatEditorialDate } from '../utils/format.ts';
import { FontScaleControl, type FontScaleOption } from './FontScaleControl.tsx';
import { EditorialImage, EditorialVideo } from './MediaFrame.tsx';
import { RealTimeComments } from './RealTimeComments.tsx';

interface ArticleDetailProps {
  articleId: string;
  categories: Category[];
  allArticles: Article[];
  isAdmin: boolean;
  theme: 'dark' | 'light';
  fontScale: FontScaleOption;
  onToggleTheme: () => void;
  onChangeFontScale: (scale: FontScaleOption) => void;
  onBack: () => void;
  onSelectCategory: (slug: string) => void;
  onOpenArticle: (articleId: string) => void;
  onEditInAdmin: (article: Article) => void;
  onCommentCountUpdate: () => void;
}

export function ArticleDetail({
  articleId,
  categories,
  allArticles,
  isAdmin,
  theme,
  fontScale,
  onToggleTheme,
  onChangeFontScale,
  onBack,
  onSelectCategory,
  onOpenArticle,
  onEditInAdmin,
  onCommentCountUpdate,
}: ArticleDetailProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState<number>(0);
  const [hasRecommended, setHasRecommended] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleScroll() {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setScrollProgress(0);
        return;
      }
      const pct = Math.min(100, Math.max(0, (window.scrollY / docHeight) * 100));
      setScrollProgress(pct);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [articleId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setHasRecommended(false);

    fetch(`/api/articles/${encodeURIComponent(articleId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Artigo não encontrado.');
        return data as { article: Article; comments: Comment[] };
      })
      .then((data) => {
        if (!active) return;
        setArticle(data.article);
        setLikes(data.article.likes ?? 0);
        setComments(data.comments);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Erro ao carregar artigo.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [articleId]);

  const handleWsMessage = useCallback(
    (msg: WsServerMessage) => {
      if (msg.type === 'article:liked' && article && msg.articleId === article.id) {
        setLikes(msg.likes);
      }
    },
    [article]
  );

  useRealtimeSocket(handleWsMessage);

  async function handleRecommend() {
    if (!article || hasRecommended) return;
    setHasRecommended(true);
    setLikes((n) => n + 1);
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(article.id)}/like`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = (await res.json()) as { likes: number };
        setLikes(data.likes);
      }
    } catch {
      // Ignore transient error
    }
  }

  function handleCopyShareLink() {
    if (!article) return;
    const shareUrl = `${window.location.origin}/?artigo=${encodeURIComponent(article.id)}`;
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2200);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-6">
        <div className="h-4 w-36 bg-[#EBE6DF] dark:bg-[#1D2027] animate-pulse" />
        <div className="h-12 w-full bg-[#EBE6DF] dark:bg-[#1D2027] animate-pulse" />
        <div className="h-6 w-3/4 bg-[#EBE6DF] dark:bg-[#1D2027] animate-pulse" />
        <div className="aspect-[16/9] w-full bg-[#EBE6DF] dark:bg-[#1D2027] animate-pulse" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="font-serif text-2xl text-[#171614] dark:text-[#F2EFE9] mb-3">
          {error || 'Artigo não encontrado.'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172D6E] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar à Primeira Página</span>
        </button>
      </div>
    );
  }

  const category = categories.find((c) => c.id === article.categoryId);
  const paragraphs = article.content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const relatedArticles = allArticles
    .filter((a) => a.id !== article.id && a.status === 'published')
    .sort((a, b) => {
      const aSame = a.categoryId === article.categoryId ? 1 : 0;
      const bSame = b.categoryId === article.categoryId ? 1 : 0;
      if (aSame !== bSame) return bSame - aSame;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .slice(0, 3);

  return (
    <>
      {/* Subtle Editorial Reading Progress Bar */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 h-[2px] z-40 pointer-events-none bg-transparent"
      >
        <div
          className="h-full bg-[#1E3A8A] dark:bg-[#60A5FA] transition-[width] duration-100 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <article className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#E6E1D6] dark:border-[#262932] mb-8">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] hover:text-[#171614] dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Primeira Página</span>
          </button>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <FontScaleControl fontScale={fontScale} onChangeFontScale={onChangeFontScale} />

            <a
              href="#comentarios-heading"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] hover:text-[#171614] dark:hover:text-white whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums">Debate ({comments.length})</span>
            </a>

            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] hover:text-[#171614] dark:hover:text-white cursor-pointer whitespace-nowrap"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#15803D] dark:text-[#4ADE80]" />
                  <span className="text-[#15803D] dark:text-[#4ADE80]">Ligação copiada</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Partilhar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] hover:text-[#171614] dark:hover:text-white cursor-pointer whitespace-nowrap"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>Modo Escuro</span>
                </>
              )}
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => onEditInAdmin(article)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                <PenSquare className="w-3.5 h-3.5" />
                <span>Editar no Painel</span>
              </button>
            )}
          </div>
        </div>

        <header className="max-w-3xl mx-auto mb-10">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#635E56] dark:text-[#9B968C] mb-4">
            {category && (
              <>
                <button
                  type="button"
                  onClick={() => onSelectCategory(category.slug)}
                  className="font-semibold text-[#9A3412] dark:text-[#FB923C] hover:underline cursor-pointer"
                >
                  {category.name}
                </button>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>{article.location}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={article.publishedAt} className="tabular-nums">
              {formatEditorialDate(article.publishedAt)}
            </time>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{article.readTimeMinutes} min de leitura</span>
          </div>

          <h1 className="font-serif editorial-article-title font-semibold tracking-tight text-[#171614] dark:text-[#F2EFE9] mb-5">
            {article.title}
          </h1>

          {article.subtitle && (
            <p className="editorial-deck text-[#47433D] dark:text-[#C5BFB4] mb-6">
              {article.subtitle}
            </p>
          )}

          <div className="pt-4 border-t border-[#E6E1D6] dark:border-[#262932] flex flex-wrap items-center justify-between gap-4 text-xs text-[#635E56] dark:text-[#9B968C]">
            <div>
              Por <span className="font-semibold text-[#171614] dark:text-[#F2EFE9]">{article.author}</span>
            </div>

            <div className="flex items-center gap-5">
              {article.videoUrl && (
                <div className="inline-flex items-center gap-1.5 text-[#1E3A8A] dark:text-[#60A5FA] font-medium">
                  <Film className="w-3.5 h-3.5" />
                  <span>Inclui reportagem em vídeo</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleRecommend}
                disabled={hasRecommended}
                className={`inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                  hasRecommended
                    ? 'text-[#9A3412] dark:text-[#FB923C]'
                    : 'text-[#47433D] dark:text-[#C5BFB4] hover:text-[#9A3412] dark:hover:text-[#FB923C]'
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    hasRecommended ? 'fill-[#9A3412] dark:fill-[#FB923C]' : ''
                  }`}
                />
                <span className="font-mono tabular-nums">
                  {hasRecommended ? 'Recomendado' : 'Recomendar'} ({likes})
                </span>
              </button>
            </div>
          </div>
        </header>

        {article.coverImage && (
          <figure className="mb-10">
            <EditorialImage
              src={article.coverImage}
              alt={article.title}
              aspectClassName="aspect-[16/9]"
            />
            <figcaption className="text-xs font-serif italic text-[#635E56] dark:text-[#9B968C] mt-2.5">
              {article.location} — Arquivo Fotográfico Complice Week Lusophone
            </figcaption>
          </figure>
        )}

        {article.videoUrl && (
          <figure className="max-w-3xl mx-auto mb-10">
            <EditorialVideo url={article.videoUrl} title={article.title} />
            <figcaption className="text-xs font-serif italic text-[#635E56] dark:text-[#9B968C] mt-2.5">
              Vídeo editorial associado a esta edição
            </figcaption>
          </figure>
        )}

        <div className="max-w-2xl mx-auto space-y-6">
          {paragraphs.map((paragraph, index) => (
            <p
              key={index}
              className={`editorial-prose text-[#24211D] dark:text-[#D6D2C9] ${
                index === 0
                  ? 'first-letter:text-5xl first-letter:font-serif first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-[0.88] first-letter:text-[#171614] dark:first-letter:text-[#F2EFE9]'
                  : ''
              }`}
            >
              {paragraph}
            </p>
          ))}

          {article.mediaGallery && article.mediaGallery.length > 0 && (
            <div className="pt-8 mt-8 border-t border-[#E6E1D6] dark:border-[#262932] space-y-8">
              <h2 className="font-serif text-xl font-semibold text-[#171614] dark:text-[#F2EFE9]">
                Galeria Multimédia
              </h2>
              <div className="space-y-8">
                {article.mediaGallery.map((item, idx) => (
                  <figure key={item.id}>
                    {item.type === 'video' ? (
                      <EditorialVideo
                        url={item.url}
                        title={item.caption || `Vídeo ${idx + 1}`}
                      />
                    ) : (
                      <EditorialImage
                        src={item.url}
                        alt={item.caption || `${article.title} — Imagem ${idx + 1}`}
                        aspectClassName="aspect-[16/10]"
                      />
                    )}
                    {item.caption && (
                      <figcaption className="text-xs font-serif italic text-[#635E56] dark:text-[#9B968C] mt-2.5">
                        {item.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </div>
          )}

          <RealTimeComments
            articleId={article.id}
            initialComments={comments}
            onCountChange={() => onCommentCountUpdate()}
          />
        </div>

        {/* Related Stories */}
        {relatedArticles.length > 0 && (
          <section
            aria-label="Reportagens Relacionadas"
            className="mt-16 pt-10 border-t border-[#E6E1D6] dark:border-[#262932]"
          >
            <h2 className="font-serif text-2xl font-semibold text-[#171614] dark:text-[#F2EFE9] mb-6">
              Continuar a Ler
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relatedArticles.map((rel) => {
                const relCat = categories.find((c) => c.id === rel.categoryId)?.name ?? 'Geral';
                return (
                  <article
                    key={rel.id}
                    onClick={() => onOpenArticle(rel.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenArticle(rel.id);
                      }
                    }}
                    className="group cursor-pointer space-y-3"
                  >
                    <EditorialImage
                      src={rel.coverImage}
                      alt={rel.title}
                      aspectClassName="aspect-[4/3]"
                      className="group-hover:[&_img]:scale-[1.02]"
                    />
                    <div className="text-xs text-[#635E56] dark:text-[#9B968C]">
                      <span className="font-semibold text-[#9A3412] dark:text-[#FB923C]">{relCat}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{rel.location}</span>
                    </div>
                    <h3 className="font-serif text-lg font-semibold leading-snug text-[#171614] dark:text-[#F2EFE9] group-hover:text-[#1E3A8A] dark:group-hover:text-[#60A5FA] transition-colors">
                      {rel.title}
                    </h3>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
