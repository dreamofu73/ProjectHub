import { Sun, Moon, Monitor, Globe, ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, type Language } from '../context/LanguageContext';
import ThemeSelector from './ThemeSelector';

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '简体中文', flag: '🇨🇳' },
];

export default function AuthControls() {
  const { lightDark, cycleLightDark, currentConfig } = useTheme();
  const { language, setLanguage } = useLanguage();

  const LightDarkIcon = lightDark === 'light' ? Sun : lightDark === 'dark' ? Moon : Monitor;

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-card/85 backdrop-blur-md border border-border px-3 py-1.5 rounded-xl shadow-sm text-foreground select-none">
      {/* Theme selector */}
      <ThemeSelector position="bottom" />

      {/* Divider */}
      <div className="w-px h-4 bg-border" />

      {/* Language selector */}
      <div className="relative flex items-center gap-1.5">
        <Globe size={13} className="text-muted-foreground" />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="bg-transparent border-none text-xs font-semibold cursor-pointer focus:outline-none appearance-none pr-4 text-foreground font-sans"
        >
          {LANGS.map(l => (
            <option key={l.code} value={l.code} className="bg-card text-foreground">
              {l.flag} {l.label}
            </option>
          ))}
        </select>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground opacity-50">
          <ChevronDown className="size-3" />
        </div>
      </div>

      {/* Divider & Dark toggle */}
      {!currentConfig.forceDark && (
        <>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={cycleLightDark}
            className="cursor-pointer border-none p-1 rounded-lg transition-all hover:bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground"
            title={lightDark === 'light' ? '라이트' : lightDark === 'dark' ? '다크' : '시스템'}
          >
            <LightDarkIcon size={13} />
          </button>
        </>
      )}
    </div>
  );
}
