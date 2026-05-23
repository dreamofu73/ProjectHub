import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, type Language } from '../context/LanguageContext';
import ThemeSelector from './ThemeSelector';

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: 'ko', label: 'KR', flag: '🇰🇷' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'ja', label: 'JA', flag: '🇯🇵' },
  { code: 'zh', label: 'ZH', flag: '🇨🇳' },
];

interface FloatingControlsProps {
  isCollapsed?: boolean;
}

export default function FloatingControls({ isCollapsed = false }: FloatingControlsProps) {
  const { lightDark, cycleLightDark, currentConfig } = useTheme();
  const { language, setLanguage } = useLanguage();

  const LightDarkIcon = lightDark === 'light' ? Sun : lightDark === 'dark' ? Moon : Monitor;

  if (isCollapsed) {
    return (
      <div
        className="w-full flex flex-col items-center gap-2.5 py-3 border-t select-none mt-auto border-[var(--sidebar-border)] bg-[var(--sidebar-bg)]"
      >
        {/* Compact Theme Select */}
        <ThemeSelector isCollapsed={true} />

        {/* Compact Lang Select */}
        <div className="relative w-9 h-7 flex items-center justify-center bg-[var(--sidebar-link-hover-bg)] border border-[var(--sidebar-border)] rounded-md">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="w-full h-full text-center bg-transparent border-none cursor-pointer text-xs appearance-none focus:outline-none text-[var(--sidebar-link-color)]"
          >
            {LANGS.map(l => (
              <option key={l.code} value={l.code} className="bg-white text-slate-850 dark:bg-slate-900 dark:text-slate-300 text-xs">
                {l.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute text-xs">{LANGS.find(l => l.code === language)?.flag}</span>
        </div>

        {/* Light/dark toggle */}
        {!currentConfig.forceDark && (
          <button
            onClick={cycleLightDark}
            className="cursor-pointer border-none p-1.5 rounded transition-all hover:bg-[var(--sidebar-link-hover-bg)] bg-transparent text-[var(--sidebar-link-color)]"
            title={lightDark === 'light' ? '라이트' : lightDark === 'dark' ? '다크' : '시스템'}
          >
            <LightDarkIcon size={12} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="w-full flex items-center gap-1.5 px-3 h-10 border-t select-none mt-auto bg-[var(--sidebar-bg)] border-[var(--sidebar-border)]"
    >
      {/* Theme selector */}
      <ThemeSelector isCollapsed={false} />

      {/* Divider */}
      <div className="w-px h-4 mx-0.5 shrink-0 bg-[var(--sidebar-border)]" />

      {/* Compact Lang Select */}
      <div className="relative shrink-0 flex items-center">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="bg-transparent border-none py-0.5 pl-1.5 pr-4 rounded cursor-pointer text-xs font-bold transition-all leading-none appearance-none focus:outline-none text-[var(--sidebar-link-color)]"
        >
          {LANGS.map(l => (
            <option key={l.code} value={l.code} className="bg-white text-slate-850 dark:bg-slate-900 dark:text-slate-300 text-xs">
              {l.flag} &nbsp; {l.label}
            </option>
          ))}
        </select>
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground opacity-50">
          <ChevronDown className="size-3" />
        </div>
      </div>

      {/* Divider */}
      {!currentConfig.forceDark && (
        <div className="w-px h-4 mx-0.5 shrink-0 bg-[var(--sidebar-border)]" />
      )}

      {/* Light/dark toggle */}
      {!currentConfig.forceDark && (
        <button
          onClick={cycleLightDark}
          className="cursor-pointer border-none p-1 rounded transition-all hover:bg-[var(--sidebar-link-hover-bg)] ml-auto bg-transparent text-[var(--sidebar-link-color)]"
          title={lightDark === 'light' ? '라이트' : lightDark === 'dark' ? '다크' : '시스템'}
        >
          <LightDarkIcon size={12} />
        </button>
      )}
    </div>
  );
}
