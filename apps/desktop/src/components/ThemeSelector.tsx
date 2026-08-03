import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme, THEMES, type ColorTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface ThemeSelectorProps {
  isCollapsed?: boolean;
  position?: 'top' | 'bottom';
}

export default function ThemeSelector({ isCollapsed = false, position = 'top' }: ThemeSelectorProps) {
  const { colorTheme, setColorTheme } = useTheme();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTheme = THEMES.find(t => t.id === colorTheme) || THEMES[0];

  const dropdownPositionClass = position === 'top' 
    ? (isCollapsed ? 'left-11 bottom-0' : 'left-0 bottom-8') 
    : 'top-7 right-0';

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: ColorTheme) => {
    setColorTheme(id);
    setIsOpen(false);
  };

  if (isCollapsed) {
    return (
      <div className="relative" ref={containerRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-9 h-7 flex items-center justify-center bg-[var(--sidebar-link-hover-bg)] border border-[var(--sidebar-border)] rounded-md cursor-pointer hover:opacity-85 text-xs select-none"
          title={t('themeChange').replace('{name}', activeTheme.name)}
        >
          <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: activeTheme.swatch || activeTheme.accent }} />
        </button>

        {isOpen && (
          <div className={`absolute z-50 w-56 p-2 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl animate-zoom-in text-foreground ${dropdownPositionClass}`}>
            <div className="text-xs font-bold text-muted-foreground px-2 py-1 border-b border-border mb-1">🎨 {t('themeSelect')}</div>
            <div className="flex flex-col gap-0.5">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-semibold cursor-pointer border-none transition-all ${
                    colorTheme === t.id 
                      ? 'bg-primary/15 text-primary' 
                      : 'bg-transparent hover:bg-foreground/5 text-foreground'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.swatch || t.accent }} />
                  <div className="min-w-0">
                    <div>{t.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative ref-theme-container" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 bg-transparent hover:bg-foreground/5 border-none rounded-lg cursor-pointer text-xs font-bold transition-all text-[var(--sidebar-link-color)] hover:text-[var(--sidebar-link-hover-color)] leading-none select-none focus:outline-none"
      >
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: activeTheme.swatch || activeTheme.accent }} />
        <span>{activeTheme.name}</span>
        <ChevronDown className={`size-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute z-50 w-56 p-2 bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl animate-zoom-in text-foreground ${dropdownPositionClass}`}>
          <div className="flex flex-col gap-0.5">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-semibold cursor-pointer border-none transition-all ${
                  colorTheme === t.id 
                    ? 'bg-primary/15 text-primary' 
                    : 'bg-transparent hover:bg-foreground/5 text-foreground'
                }`}
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.swatch || t.accent }} />
                <div className="min-w-0">
                  <div>{t.name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
