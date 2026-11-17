import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Film, Image as ImageIcon, Plus, Save, Trash2, Upload } from 'lucide-react';
import type { Article, Category, MediaItem, UploadedAsset } from '../types.ts';
import { adminFetch } from '../utils/adminAuth.ts';
import { EditorialImage, EditorialVideo } from './MediaFrame.tsx';

interface ArticleEditorProps {
  article: Article | null;
  categories: Category[];
  initialMediaUrl?: { url: string; mediaType: 'image' | 'video' } | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}

export function ArticleEditor({
  article,
  categories,
  initialMediaUrl,
  onCancel,
  onSaved,
}: ArticleEditorProps) {
  const [title, setTitle] = useState(article?.title ?? '');
  const [subtitle, setSubtitle] = useState(article?.subtitle ?? '');
  const [categoryId, setCategoryId] = useState(
    article?.categoryId ?? categories[0]?.id ?? ''
  );
  const [author, setAuthor] = useState(article?.author ?? '');
  const [location, setLocation] = useState(article?.location ?? '');
  const [coverImage, setCoverImage] = useState(
    article?.coverImage ??
      (initialMediaUrl?.mediaType === 'image' ? initialMediaUrl.url : '')
  );
  const [videoUrl, setVideoUrl] = useState(
    article?.videoUrl ??
      (initialMediaUrl?.mediaType === 'video' ? initialMediaUrl.url : '')
  );
  const [content, setContent] = useState(article?.content ?? '');
  const [featured, setFeatured] = useState(article?.featured ?? false);
  const [status, setStatus] = useState<'published' | 'draft'>(
    article?.status ?? 'published'
  );
  const [mediaGallery, setMediaGallery] = useState<MediaItem[]>(
    article?.mediaGallery ?? []
  );

  const [libraryAssets, setLibraryAssets] = useState<UploadedAsset[]>([]);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [dragTarget, setDragTarget] = useState<'cover' | 'video' | null>(null);
  const [uploadingTarget, setUploadingTarget] = useState<'cover' | 'video' | 'gallery' | null>(null);
  const [galleryNewType, setGalleryNewType] = useState<'image' | 'video'>('image');
  const [galleryNewUrl, setGalleryNewUrl] = useState('');
  const [galleryNewCaption, setGalleryNewCaption] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    adminFetch('/api/media')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: UploadedAsset[]) => setLibraryAssets(data))
      .catch(() => {});
  }, []);

  async function uploadFile(file: File): Promise<{ url: string; mediaType: 'image' | 'video' }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await adminFetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao enviar ficheiro.');
    }
    adminFetch('/api/media')
      .then((r) => (r.ok ? r.json() : []))
      .then((assets: UploadedAsset[]) => setLibraryAssets(assets))
      .catch(() => {});
    return { url: data.url, mediaType: data.mediaType };
  }

  async function processCoverFile(file: File) {
    setError(null);
    setUploadingTarget('cover');
    try {
      const uploaded = await uploadFile(file);
      if (uploaded.mediaType !== 'image') {
        throw new Error('Selecione um ficheiro de imagem para a capa.');
      }
      setCoverImage(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no envio da imagem.');
    } finally {
      setUploadingTarget(null);
    }
  }

  async function processVideoFile(file: File) {
    setError(null);
    setUploadingTarget('video');
    try {
      const uploaded = await uploadFile(file);
      if (uploaded.mediaType !== 'video') {
        throw new Error('Selecione um ficheiro de vídeo (MP4, WebM, MOV).');
      }
      setVideoUrl(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no envio do vídeo.');
    } finally {
      setUploadingTarget(null);
    }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await processCoverFile(file);
    e.target.value = '';
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await processVideoFile(file);
    e.target.value = '';
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingTarget('gallery');
    try {
      const uploaded = await uploadFile(file);
      const item: MediaItem = {
        id: `med-${Date.now()}`,
        type: uploaded.mediaType,
        url: uploaded.url,
        caption: galleryNewCaption.trim() || undefined,
      };
      setMediaGallery((prev) => [...prev, item]);
      setGalleryNewCaption('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no envio para a galeria.');
    } finally {
      setUploadingTarget(null);
      e.target.value = '';
    }
  }

  function addGalleryByUrl() {
    if (!galleryNewUrl.trim()) return;
    const item: MediaItem = {
      id: `med-${Date.now()}`,
      type: galleryNewType,
      url: galleryNewUrl.trim(),
      caption: galleryNewCaption.trim() || undefined,
    };
    setMediaGallery((prev) => [...prev, item]);
    setGalleryNewUrl('');
    setGalleryNewCaption('');
  }

  function removeGalleryItem(id: string) {
    setMediaGallery((prev) => prev.filter((item) => item.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('O título do artigo é obrigatório.');
      return;
    }
    if (!categoryId) {
      setError('Selecione uma categoria para o artigo.');
      return;
    }
    if (!content.trim()) {
      setError('Escreva o corpo da notícia.');
      return;
    }

    setSaving(true);
    try {
      const endpoint = article
        ? `/api/articles/${encodeURIComponent(article.id)}`
        : '/api/articles';
      const method = article ? 'PUT' : 'POST';

      const res = await adminFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim(),
          categoryId,
          author: author.trim() || 'Redação Lusophone',
          location: location.trim() || 'Lisboa',
          coverImage: coverImage.trim(),
          videoUrl: videoUrl.trim(),
          mediaGallery,
          content: content.trim(),
          featured,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao guardar artigo.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar artigo.');
    } finally {
      setSaving(false);
    }
  }

  const imageAssets = libraryAssets.filter((a) => a.mediaType === 'image');
  const selectedCategoryName = categories.find((c) => c.id === categoryId)?.name ?? 'Geral';
  const previewParagraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E6E1D6] dark:border-[#262932]">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] hover:text-[#171614] dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar à Lista de Artigos</span>
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-white dark:bg-[#191C23] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] hover:border-[#171614] dark:hover:border-[#60A5FA] cursor-pointer whitespace-nowrap"
          >
            {previewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{previewMode ? 'Voltar ao Editor' : 'Pré-visualizar'}</span>
          </button>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'published' | 'draft')}
            aria-label="Estado de publicação"
            className="px-3 py-2 text-xs font-medium bg-white dark:bg-[#191C23] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9]"
          >
            <option value="published">Publicado</option>
            <option value="draft">Rascunho</option>
          </select>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-[#172D6E] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'A guardar...' : article ? 'Guardar Alterações' : 'Publicar Artigo'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 bg-[#FEE2E2] dark:bg-[#2D1816] border border-[#FCA5A5] dark:border-[#9A3412] text-xs font-medium text-[#9A3412] dark:text-[#FB923C]"
        >
          {error}
        </div>
      )}

      {previewMode ? (
        <div className="bg-[#FBF9F5] dark:bg-[#13151A] border border-[#E6E1D6] dark:border-[#2A2D36] p-8 sm:p-12 max-w-4xl mx-auto space-y-8">
          <div className="space-y-4">
            <div className="text-xs text-[#635E56] dark:text-[#9B968C]">
              <span className="font-semibold text-[#9A3412] dark:text-[#FB923C]">{selectedCategoryName}</span>
              <span> · </span>
              <span>{location || 'Lisboa'}</span>
              <span> · </span>
              <span>Por {author || 'Redação Lusophone'}</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold leading-tight text-[#171614] dark:text-[#F2EFE9]">
              {title || 'Título da reportagem'}
            </h2>
            {subtitle && (
              <p className="text-lg text-[#47433D] dark:text-[#C5BFB4] leading-relaxed">{subtitle}</p>
            )}
          </div>

          {coverImage && (
            <EditorialImage
              src={coverImage}
              alt={title || 'Capa do artigo'}
              aspectClassName="aspect-[16/9]"
            />
          )}

          {videoUrl && <EditorialVideo url={videoUrl} title={title || 'Vídeo do artigo'} />}

          <div className="max-w-2xl mx-auto space-y-5">
            {previewParagraphs.length === 0 ? (
              <p className="text-sm italic text-[#635E56] dark:text-[#9B968C]">Sem texto redigido ainda.</p>
            ) : (
              previewParagraphs.map((p, idx) => (
                <p
                  key={idx}
                  className={`text-[17px] leading-[1.78] text-[#24211D] dark:text-[#D6D2C9] ${
                    idx === 0
                      ? 'first-letter:text-5xl first-letter:font-serif first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-[0.88] first-letter:text-[#171614] dark:first-letter:text-[#F2EFE9]'
                      : ''
                  }`}
                >
                  {p}
                </p>
              ))
            )}
          </div>

          {mediaGallery.length > 0 && (
            <div className="max-w-2xl mx-auto pt-6 border-t border-[#E6E1D6] dark:border-[#262932] space-y-6">
              {mediaGallery.map((item, idx) => (
                <figure key={item.id}>
                  {item.type === 'video' ? (
                    <EditorialVideo url={item.url} title={item.caption || `Vídeo ${idx + 1}`} />
                  ) : (
                    <EditorialImage
                      src={item.url}
                      alt={item.caption || `Imagem ${idx + 1}`}
                      aspectClassName="aspect-[16/10]"
                    />
                  )}
                  {item.caption && (
                    <figcaption className="text-xs font-serif italic text-[#635E56] dark:text-[#9B968C] mt-2">
                      {item.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Main Editorial Fields */}
          <div className="xl:col-span-7 bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] p-6 space-y-5">
            <div>
              <label htmlFor="art-title" className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5">
                Título da Reportagem
              </label>
              <input
                id="art-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Escreva um título claro e jornalístico..."
                className="w-full px-3.5 py-2.5 font-serif text-xl bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
              />
            </div>

            <div>
              <label htmlFor="art-subtitle" className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5">
                Subtítulo / Lead Editorial
              </label>
              <textarea
                id="art-subtitle"
                rows={2}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Resumo de duas linhas apresentado logo abaixo da manchete..."
                className="w-full px-3.5 py-2 text-sm bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="art-cat" className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5">
                  Categoria
                </label>
                <select
                  id="art-cat"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="art-author" className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5">
                  Autor / Jornalista
                </label>
                <input
                  id="art-author"
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Ex.: Mariana Alencar"
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
                />
              </div>

              <div>
                <label htmlFor="art-location" className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5">
                  Localização
                </label>
                <input
                  id="art-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex.: Lisboa, Luanda, São Paulo"
                  className="w-full px-3 py-2 text-sm bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-[#171614] dark:text-[#F2EFE9] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 accent-[#1E3A8A] dark:accent-[#3B82F6]"
              />
              <span>Definir como Manchete Principal na primeira página</span>
            </label>

            <div>
              <label htmlFor="art-content" className="block text-xs font-medium text-[#47433D] dark:text-[#C5BFB4] mb-1.5">
                Texto Integral do Artigo (separe parágrafos com uma linha em branco)
              </label>
              <textarea
                id="art-content"
                rows={14}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Redija a reportagem completa..."
                className="w-full px-3.5 py-3 text-[15px] leading-relaxed bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
              />
            </div>
          </div>

          {/* Media Controls: Cover Image, Video, Gallery */}
          <div className="xl:col-span-5 space-y-6">
            {/* Cover Image with Drag & Drop */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragTarget('cover');
              }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={async (e) => {
                e.preventDefault();
                setDragTarget(null);
                const file = e.dataTransfer.files?.[0];
                if (file) await processCoverFile(file);
              }}
              className={`bg-white dark:bg-[#16181D] border p-5 space-y-4 transition-colors ${
                dragTarget === 'cover'
                  ? 'border-[#1E3A8A] dark:border-[#60A5FA] bg-[#F0F4FF] dark:bg-[#1A2233]'
                  : 'border-[#E6E1D6] dark:border-[#2A2D36]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" />
                  <h3 className="text-sm font-semibold text-[#171614] dark:text-[#F2EFE9]">Imagem de Capa</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCoverPicker((v) => !v)}
                  className="text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:underline cursor-pointer"
                >
                  {showCoverPicker ? 'Fechar galeria' : 'Escolher da biblioteca'}
                </button>
              </div>

              {coverImage ? (
                <EditorialImage
                  src={coverImage}
                  alt={title || 'Pré-visualização de capa'}
                  aspectClassName="aspect-[16/9]"
                />
              ) : (
                <div className="py-6 px-4 border border-dashed border-[#D8D1C5] dark:border-[#2F333E] bg-[#FBF9F5] dark:bg-[#111318] text-center text-xs text-[#635E56] dark:text-[#9B968C]">
                  Arraste uma imagem para aqui ou carregue abaixo
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingTarget === 'cover'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#F2EDE4] dark:bg-[#1D2027] text-[#171614] dark:text-[#F2EFE9] hover:bg-[#E6DFD2] dark:hover:bg-[#262A33] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingTarget === 'cover' ? 'A enviar...' : 'Carregar Imagem'}</span>
                </button>
                <input
                  type="url"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="Ou cole o URL da imagem (/uploads/...)"
                  className="flex-1 min-w-[180px] px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
                />
              </div>

              {showCoverPicker && imageAssets.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E6E1D6] dark:border-[#262932] max-h-48 overflow-y-auto">
                  {imageAssets.map((asset) => (
                    <button
                      key={asset.url}
                      type="button"
                      onClick={() => {
                        setCoverImage(asset.url);
                        setShowCoverPicker(false);
                      }}
                      className={`overflow-hidden border-2 cursor-pointer ${
                        coverImage === asset.url
                          ? 'border-[#1E3A8A] dark:border-[#60A5FA]'
                          : 'border-transparent'
                      }`}
                    >
                      <img
                        src={asset.url}
                        alt={asset.filename}
                        referrerPolicy="no-referrer"
                        className="w-full aspect-[4/3] object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Primary Article Video with Drag & Drop */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragTarget('video');
              }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={async (e) => {
                e.preventDefault();
                setDragTarget(null);
                const file = e.dataTransfer.files?.[0];
                if (file) await processVideoFile(file);
              }}
              className={`bg-white dark:bg-[#16181D] border p-5 space-y-4 transition-colors ${
                dragTarget === 'video'
                  ? 'border-[#1E3A8A] dark:border-[#60A5FA] bg-[#F0F4FF] dark:bg-[#1A2233]'
                  : 'border-[#E6E1D6] dark:border-[#2A2D36]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" />
                  <h3 className="text-sm font-semibold text-[#171614] dark:text-[#F2EFE9]">Vídeo da Reportagem</h3>
                </div>
                {videoUrl && (
                  <button
                    type="button"
                    onClick={() => setVideoUrl('')}
                    className="text-xs text-[#9A3412] dark:text-[#FB923C] hover:underline cursor-pointer"
                  >
                    Remover vídeo
                  </button>
                )}
              </div>

              {videoUrl ? (
                <EditorialVideo url={videoUrl} title={title || 'Pré-visualização'} />
              ) : (
                <div className="py-5 px-4 border border-dashed border-[#D8D1C5] dark:border-[#2F333E] bg-[#FBF9F5] dark:bg-[#111318] text-center text-xs text-[#635E56] dark:text-[#9B968C]">
                  Arraste um vídeo MP4/WebM ou insira um link YouTube/Vimeo
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploadingTarget === 'video'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#F2EDE4] dark:bg-[#1D2027] text-[#171614] dark:text-[#F2EFE9] hover:bg-[#E6DFD2] dark:hover:bg-[#262A33] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingTarget === 'video' ? 'A enviar vídeo...' : 'Carregar Vídeo (MP4/WebM)'}</span>
                </button>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Ou URL YouTube, Vimeo ou MP4"
                  className="flex-1 min-w-[180px] px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
                />
              </div>
            </div>

            {/* Additional Media Gallery */}
            <div className="bg-white dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#171614] dark:text-[#F2EFE9]">
                  Galeria Multimédia Adicional
                </h3>
                <span className="font-mono text-xs text-[#635E56] dark:text-[#9B968C] tabular-nums">
                  {mediaGallery.length} item(ns)
                </span>
              </div>

              {mediaGallery.length > 0 && (
                <div className="space-y-3">
                  {mediaGallery.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2.5 bg-[#FBF9F5] dark:bg-[#111318] border border-[#E6E1D6] dark:border-[#2A2D36]"
                    >
                      <span className="font-mono text-[11px] uppercase text-[#1E3A8A] dark:text-[#60A5FA] shrink-0">
                        {item.type === 'video' ? 'VÍDEO' : 'IMG'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#171614] dark:text-[#F2EFE9] truncate">
                          {item.caption || item.url}
                        </p>
                        <p className="text-[11px] font-mono text-[#635E56] dark:text-[#9B968C] truncate">{item.url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGalleryItem(item.id)}
                        className="p-1.5 text-[#635E56] dark:text-[#9B968C] hover:text-[#9A3412] dark:hover:text-[#FB923C] cursor-pointer"
                        title="Remover da galeria"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2.5 pt-2 border-t border-[#E6E1D6] dark:border-[#262932]">
                <input
                  type="text"
                  value={galleryNewCaption}
                  onChange={(e) => setGalleryNewCaption(e.target.value)}
                  placeholder="Legenda opcional (Ex.: Fig. 2 — Sessão plenária)"
                  className="w-full px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D] focus:outline-none focus:border-[#1E3A8A] dark:focus:border-[#60A5FA]"
                />

                <div className="flex flex-wrap gap-2">
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleGalleryUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={uploadingTarget === 'gallery'}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#F2EDE4] dark:bg-[#1D2027] text-[#171614] dark:text-[#F2EFE9] hover:bg-[#E6DFD2] dark:hover:bg-[#262A33] cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingTarget === 'gallery' ? 'A enviar...' : 'Enviar Ficheiro'}</span>
                  </button>

                  <select
                    value={galleryNewType}
                    onChange={(e) => setGalleryNewType(e.target.value as 'image' | 'video')}
                    className="px-2.5 py-2 text-xs bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9]"
                  >
                    <option value="image">Imagem</option>
                    <option value="video">Vídeo</option>
                  </select>

                  <input
                    type="url"
                    value={galleryNewUrl}
                    onChange={(e) => setGalleryNewUrl(e.target.value)}
                    placeholder="URL da imagem ou vídeo"
                    className="flex-1 min-w-[140px] px-3 py-2 text-xs bg-[#FBF9F5] dark:bg-[#111318] border border-[#D8D1C5] dark:border-[#2F333E] text-[#171614] dark:text-[#F2EFE9] placeholder:text-[#8C8478] dark:placeholder:text-[#78746D]"
                  />

                  <button
                    type="button"
                    onClick={addGalleryByUrl}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-[#171614] hover:bg-[#2F2C27] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Juntar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
