import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Globe, ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, type Language } from '../context/LanguageContext';
import ThemeSelector from './ThemeSelector';

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export default function AuthControls() {
  const { lightDark, cycleLightDark, currentConfig } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const langContainerRef = useRef<HTMLDivElement>(null);

  const activeLang = LANGS.find(l => l.code === language) || LANGS[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langContainerRef.current && !langContainerRef.current.contains(event.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLangSelect = (code: Language) => {
    setLanguage(code);
    setLangOpen(false);
  };

  const LightDarkIcon = lightDark === 'light' ? Sun : lightDark === 'dark' ? Moon : Monitor;

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-card/85 backdrop-blur-md border border-border px-3 py-1.5 rounded-xl shadow-sm text-foreground select-none">
      {/* Theme selector */}
      <ThemeSelector position="bottom" />

      {/* Divider */}
      <div className="w-px h-4 bg-border" />

      {/* Language selector */}
      <div className="relative" ref={langContainerRef}>
        <button
          onClick={() => setLangOpen(!langOpen)}
          className="flex items-center gap-1.5 px-2 py-1 bg-transparent hover:bg-foreground/5 border-none rounded-lg cursor-pointer text-xs font-bold transition-all text-foreground leading-none select-none focus:outline-none"
        >
          <Globe size={13} className="text-muted-foreground" />
          <span>{activeLang.flag} {activeLang.label}</span>
          <ChevronDown className={`size-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
        </button>

        {langOpen && (
          <div className="absolute z-50 w-56 p-2 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl animate-zoom-in text-foreground top-7 right-0">
            <div className="flex flex-col gap-0.5">
              {LANGS.map(l => (
                <button
                  key={l.code}
                  onClick={() => handleLangSelect(l.code)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-semibold cursor-pointer border-none transition-all ${
                    language === l.code
                      ? 'bg-primary/15 text-primary'
                      : 'bg-transparent hover:bg-foreground/5 text-foreground'
                  }`}
                >
                  <span>{l.flag}</span>
                  <div className="min-w-0">
                    <div>{l.label}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Divider & Dark toggle */}
      {!currentConfig.forceDark && (
        <>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={cycleLightDark}
            className="cursor-pointer border-none p-1 rounded-lg transition-all hover:bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground"
            title={lightDark === 'light' ? t('themeLight') : lightDark === 'dark' ? t('themeDark') : t('themeSystem')}
          >
            <LightDarkIcon size={13} />
          </button>
        </>
      )}
    </div>
  );
}
