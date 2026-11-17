import { ArrowRight, Film, MessageSquare, Moon, Search, Sun } from 'lucide-react';
import type { Article, Category } from '../types.ts';
import { formatEditorialDate } from '../utils/format.ts';
import { FontScaleControl, type FontScaleOption } from './FontScaleControl.tsx';
import { EditorialImage } from './MediaFrame.tsx';

interface NewsPortalProps {
  articles: Article[];
  featuredArticle?: Article;
  categories: Category[];
  selectedCategorySlug: string;
  searchQuery: string;
  onlyVideo: boolean;
  theme: 'dark' | 'light';
  fontScale: FontScaleOption;
  onToggleTheme: () => void;
  onChangeFontScale: (scale: FontScaleOption) => void;
  onSelectCategory: (slug: string) => void;
  onSearchChange: (q: string) => void;
  onToggleOnlyVideo: () => void;
  onOpenArticle: (articleId: string) => void;
}

export function NewsPortal({
  articles,
  featuredArticle,
  categories,
  selectedCategorySlug,
  searchQuery,
  onlyVideo,
  theme,
  fontScale,
  onToggleTheme,
  onChangeFontScale,
  onSelectCategory,
  onSearchChange,
  onToggleOnlyVideo,
  onOpenArticle,
}: NewsPortalProps) {
  const filteredArticles = onlyVideo
    ? articles.filter(
        (a) => Boolean(a.videoUrl) || a.mediaGallery.some((m) => m.type === 'video')
      )
    : articles;

  const showPinnedFeatured = !onlyVideo && !searchQuery.trim() && Boolean(featuredArticle);
  const leadArticle = showPinnedFeatured ? featuredArticle : filteredArticles[0];
  const remainingArticles = leadArticle
    ? filteredArticles.filter((a) => a.id !== leadArticle.id)
    : filteredArticles;
  const secondaryFeatures = remainingArticles.slice(0, 3);
  const archiveArticles = remainingArticles.slice(3);

  const selectedCategory =
    selectedCategorySlug === 'all'
      ? null
      : categories.find((c) => c.slug === selectedCategorySlug);

  const getCategoryName = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.name ?? 'Geral';

  const hasVideo = (article: Article) =>
    Boolean(article.videoUrl) || article.mediaGallery.some((m) => m.type === 'video');

  const todayFormatted = new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Editorial Edition Masthead Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-5 border-b border-[#E6E1D6] dark:border-[#262932] text-xs text-[#635E56] dark:text-[#9B968C]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-medium text-[#171614] dark:text-[#F2EFE9] capitalize">
            {todayFormatted}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {selectedCategory
              ? `${selectedCategory.name} — ${selectedCategory.description || 'Cobertura especializada'}`
              : 'Edição Lusófona — Risco, Compliance, Economia & Cultura'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <FontScaleControl fontScale={fontScale} onChangeFontScale={onChangeFontScale} />

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#D8D1C5] dark:border-[#2F333E] bg-white dark:bg-[#191C23] text-[#171614] dark:text-[#F2EFE9] hover:border-[#171614] dark:hover:border-[#60A5FA] transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
        </div>
      </div>

      {/* Compact Editorial Utility Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#E6E1D6] dark:border-[#262932] mb-10">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              selectedCategorySlug === 'all'
                ? 'bg-[#171614] text-[#FBF9F5] dark:bg-[#F2EFE9] dark:text-[#0E0F12]'
                : 'text-[#47433D] dark:text-[#C5BFB4] hover:text-[#171614] dark:hover:text-white bg-[#F2EDE4] dark:bg-[#191C23]'
            }`}
          >
            Todas as Secções
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.slug)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                selectedCategorySlug === cat.slug
                  ? 'bg-[#171614] text-[#FBF9F5] dark:bg-[#F2EFE9] dark:text-[#0E0F12]'
                  : 'text-[#47433D] dark:text-[#C5BFB4] hover:text-[#171614] dark:hover:text-white bg-[#F2EDE4] dark:bg-[#191C23]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleOnlyVideo}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              onlyVideo
                ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-white border-[#1E3A8A] dark:border-[#2563EB]'
                : 'bg-white dark:bg-[#191C23] text-[#47433D] dark:text-[#C5BFB4] border-[#D8D1C5] dark:border-[#2F333E] hover:border-[#171614] dark:hover:border-[#60A5FA]'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Com Vídeo</span>
          </button>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#8C8478] dark:text-[#78746D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Pesquisar notícias..."
              aria-label="Pesquisar notícias"
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#191C23] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
            />
          </div>
        </div>
      </div>

      {!leadArticle && filteredArticles.length === 0 ? (
        <div className="py-20 text-center border border-[#E6E1D6] dark:border-[#2A2D36] bg-white dark:bg-[#16181D]">
          <p className="font-serif text-2xl text-[#171614] dark:text-[#F2EFE9] mb-2">
            Sem artigos publicados nesta seleção
          </p>
          <p className="text-sm text-[#635E56] dark:text-[#9B968C] mb-6">
            Ajuste os filtros ou publique novos conteúdos no painel administrativo.
          </p>
          <button
            type="button"
            onClick={() => {
              onSelectCategory('all');
              onSearchChange('');
              if (onlyVideo) onToggleOnlyVideo();
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172D6E] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] cursor-pointer"
          >
            Mostrar Todas as Notícias
          </button>
        </div>
      ) : (
        <>
          {/* Tier 1: Lead Story (Manchete Principal) */}
          {leadArticle && (
            <section
              aria-label="Manchete Principal"
              className="pb-12 border-b border-[#E6E1D6] dark:border-[#262932] mb-12"
            >
              <div
                onClick={() => onOpenArticle(leadArticle.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenArticle(leadArticle.id);
                  }
                }}
                className="group grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch cursor-pointer"
              >
                <div className="lg:col-span-7 overflow-hidden">
                  <EditorialImage
                    src={leadArticle.coverImage}
                    alt={leadArticle.title}
                    aspectClassName="aspect-[16/9] lg:h-full"
                    className="group-hover:[&_img]:scale-[1.015]"
                  />
                </div>

                <div className="lg:col-span-5 flex flex-col justify-between py-1">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#635E56] dark:text-[#9B968C] mb-3">
                      <span className="font-semibold text-[#9A3412] dark:text-[#FB923C]">
                        {getCategoryName(leadArticle.categoryId)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{leadArticle.location}</span>
                      {hasVideo(leadArticle) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-[#1E3A8A] dark:text-[#60A5FA] font-medium">
                            <Film className="w-3.5 h-3.5" />
                            <span>Vídeo</span>
                          </span>
                        </>
                      )}
                    </div>

                    <h1 className="font-serif editorial-lead-title font-semibold tracking-tight text-[#171614] dark:text-[#F2EFE9] group-hover:text-[#1E3A8A] dark:group-hover:text-[#60A5FA] transition-colors mb-4">
                      {leadArticle.title}
                    </h1>

                    <p className="editorial-deck text-[#47433D] dark:text-[#C5BFB4] mb-6">
                      {leadArticle.subtitle}
                    </p>

                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] group-hover:underline mb-6">
                      <span>Ler reportagem completa</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  <div className="pt-4 border-t border-[#E6E1D6] dark:border-[#262932] flex flex-wrap items-center justify-between gap-3 text-xs text-[#635E56] dark:text-[#9B968C]">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#171614] dark:text-[#F2EFE9]">
                        {leadArticle.author}
                      </span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={leadArticle.publishedAt} className="tabular-nums">
                        {formatEditorialDate(leadArticle.publishedAt)}
                      </time>
                    </div>
                    <div className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[#47433D] dark:text-[#C5BFB4]">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{leadArticle.commentCount ?? 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Tier 2: Secondary Features (Destaques da Semana) */}
          {secondaryFeatures.length > 0 && (
            <section
              aria-label="Destaques da Semana"
              className="pb-12 border-b border-[#E6E1D6] dark:border-[#262932] mb-12"
            >
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="font-serif text-2xl font-semibold text-[#171614] dark:text-[#F2EFE9]">
                  Destaques da Semana
                </h2>
                <span className="text-xs text-[#635E56] dark:text-[#9B968C] font-mono tabular-nums">
                  {secondaryFeatures.length} reportagens
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {secondaryFeatures.map((article) => (
                  <article
                    key={article.id}
                    onClick={() => onOpenArticle(article.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenArticle(article.id);
                      }
                    }}
                    className="group flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="mb-4 overflow-hidden">
                        <EditorialImage
                          src={article.coverImage}
                          alt={article.title}
                          aspectClassName="aspect-[4/3]"
                          className="group-hover:[&_img]:scale-[1.02]"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#635E56] dark:text-[#9B968C] mb-2">
                        <span className="font-semibold text-[#9A3412] dark:text-[#FB923C]">
                          {getCategoryName(article.categoryId)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{article.location}</span>
                        {hasVideo(article) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-[#1E3A8A] dark:text-[#60A5FA] font-medium">
                              <Film className="w-3.5 h-3.5" />
                              <span>Vídeo</span>
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="font-serif editorial-card-title font-semibold text-[#171614] dark:text-[#F2EFE9] group-hover:text-[#1E3A8A] dark:group-hover:text-[#60A5FA] transition-colors mb-2.5">
                        {article.title}
                      </h3>

                      <p className="text-sm leading-relaxed text-[#47433D] dark:text-[#A9A398] line-clamp-3 mb-4">
                        {article.subtitle}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#E6E1D6] dark:border-[#262932] flex items-center justify-between text-xs text-[#635E56] dark:text-[#9B968C]">
                      <span>{article.author}</span>
                      <div className="flex items-center gap-3 font-mono tabular-nums">
                        <span>{article.readTimeMinutes} min</span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {article.commentCount ?? 0}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Tier 3: Editorial Archive List */}
          {archiveArticles.length > 0 && (
            <section aria-label="Mais Reportagens">
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="font-serif text-2xl font-semibold text-[#171614] dark:text-[#F2EFE9]">
                  Arquivo &amp; Secções
                </h2>
                <span className="text-xs text-[#635E56] dark:text-[#9B968C] font-mono tabular-nums">
                  {archiveArticles.length} artigo(s)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 divide-y divide-[#E6E1D6] dark:divide-[#262932] border-t border-b border-[#E6E1D6] dark:border-[#262932]">
                {archiveArticles.map((article) => (
                  <article
                    key={article.id}
                    onClick={() => onOpenArticle(article.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenArticle(article.id);
                      }
                    }}
                    className="group py-6 flex items-start gap-5 cursor-pointer"
                  >
                    <div className="w-28 shrink-0 overflow-hidden">
                      <EditorialImage
                        src={article.coverImage}
                        alt={article.title}
                        aspectClassName="aspect-[4/3]"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#635E56] dark:text-[#9B968C] mb-1.5">
                        <span className="font-semibold text-[#9A3412] dark:text-[#FB923C]">
                          {getCategoryName(article.categoryId)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={article.publishedAt} className="tabular-nums">
                          {formatEditorialDate(article.publishedAt)}
                        </time>
                        {hasVideo(article) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <Film className="w-3.5 h-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" />
                          </>
                        )}
                      </div>

                      <h3 className="font-serif text-lg font-semibold leading-snug text-[#171614] dark:text-[#F2EFE9] group-hover:text-[#1E3A8A] dark:group-hover:text-[#60A5FA] transition-colors mb-1.5">
                        {article.title}
                      </h3>

                      <div className="flex items-center justify-between text-xs text-[#635E56] dark:text-[#9B968C]">
                        <span>{article.author}</span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <MessageSquare className="w-3 h-3" />
                          {article.commentCount ?? 0}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
