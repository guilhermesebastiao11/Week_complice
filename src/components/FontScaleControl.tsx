import { Type } from 'lucide-react';

export type FontScaleOption = '0.9' | '1' | '1.12' | '1.24';

export const FONT_SCALE_OPTIONS: {
  value: FontScaleOption;
  shortLabel: string;
  label: string;
}[] = [
  { value: '0.9', shortLabel: 'A-', label: 'Letra compacta' },
  { value: '1', shortLabel: 'A', label: 'Letra padrão' },
  { value: '1.12', shortLabel: 'A+', label: 'Letra grande' },
  { value: '1.24', shortLabel: 'A++', label: 'Letra ampliada' },
];

interface FontScaleControlProps {
  fontScale: FontScaleOption;
  onChangeFontScale: (scale: FontScaleOption) => void;
}

export function FontScaleControl({
  fontScale,
  onChangeFontScale,
}: FontScaleControlProps) {
  return (
    <div
      role="group"
      aria-label="Tamanho da fonte adaptável"
      className="inline-flex items-center border border-[#D8D1C5] dark:border-[#2F333E] bg-white dark:bg-[#191C23] divide-x divide-[#D8D1C5] dark:divide-[#2F333E] shrink-0"
    >
      <span
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-[#635E56] dark:text-[#9B968C] whitespace-nowrap"
        aria-hidden="true"
      >
        <Type className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Fonte</span>
      </span>
      {FONT_SCALE_OPTIONS.map((opt) => {
        const active = fontScale === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChangeFontScale(opt.value)}
            aria-label={opt.label}
            aria-pressed={active}
            title={opt.label}
            className={`px-2.5 py-1.5 text-xs font-mono font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              active
                ? 'bg-[#171614] text-[#FBF9F5] dark:bg-[#F2EFE9] dark:text-[#0E0F12]'
                : 'text-[#47433D] dark:text-[#C5BFB4] hover:text-[#171614] dark:hover:text-white hover:bg-[#F2EDE4] dark:hover:bg-[#22262F]'
            }`}
          >
            {opt.shortLabel}
          </button>
        );
      })}
    </div>
  );
}
