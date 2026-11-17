import { useState } from 'react';
import { Film, Image as ImageIcon } from 'lucide-react';
import { parseVideoSource } from '../utils/format.ts';

interface EditorialImageProps {
  src?: string;
  alt: string;
  className?: string;
  aspectClassName?: string;
}

export function EditorialImage({
  src,
  alt,
  className = '',
  aspectClassName = 'aspect-[4/3]',
}: EditorialImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isPortraitCover, setIsPortraitCover] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`${aspectClassName} w-full bg-[#EFEAE0] dark:bg-[#16181D] border border-[#E6E1D6] dark:border-[#2A2D36] flex flex-col items-center justify-center gap-2 px-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageIcon className="w-6 h-6 text-[#8C8478] dark:text-[#78746D]" strokeWidth={1.5} />
        <span className="text-xs text-[#635E56] dark:text-[#9B968C] line-clamp-2 max-w-xs">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`${aspectClassName} w-full overflow-hidden bg-[#EFEAE0] dark:bg-[#16181D] ${className}`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth > 0 && img.naturalHeight >= img.naturalWidth * 0.92) {
            setIsPortraitCover(true);
          }
        }}
        onError={() => setHasError(true)}
        className={`w-full h-full transition-transform duration-300 ease-out ${
          isPortraitCover ? 'object-contain bg-[#F2EDE4] dark:bg-[#13151A]' : 'object-cover'
        }`}
      />
    </div>
  );
}

interface EditorialVideoProps {
  url: string;
  title?: string;
  className?: string;
}

export function EditorialVideo({ url, title = 'Vídeo da reportagem', className = '' }: EditorialVideoProps) {
  const parsed = parseVideoSource(url);
  if (!parsed) return null;

  if (parsed.kind === 'youtube' || parsed.kind === 'vimeo') {
    return (
      <div className={`aspect-video w-full overflow-hidden bg-[#0E0F12] border border-[#E6E1D6] dark:border-[#2A2D36] ${className}`}>
        <iframe
          src={parsed.embedUrl}
          title={title}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={`aspect-video w-full overflow-hidden bg-[#0E0F12] border border-[#E6E1D6] dark:border-[#2A2D36] ${className}`}>
      <video
        src={parsed.src}
        controls
        playsInline
        preload="metadata"
        className="w-full h-full object-contain bg-black"
      >
        <div className="flex items-center justify-center gap-2 text-white p-6">
          <Film className="w-5 h-5" />
          <span>O seu navegador não suporta reprodução de vídeo.</span>
        </div>
      </video>
    </div>
  );
}
