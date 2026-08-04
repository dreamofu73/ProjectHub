import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ColorTheme = 'default' | 'warm' | 'lavender' | 'ocean' | 'amber';
export type LightDark = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  id: ColorTheme;
  name: string;
  descKey?: string;
  swatch: string;
  accent: string;
  forceDark?: boolean;
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'default',
    name: 'Classic',
    descKey: 'themeDefaultDesc',
    swatch: 'linear-gradient(135deg, #f5f5f5 50%, #0070f3 50%)',
    accent: '#0070f3',
  },
  {
    id: 'warm',
    name: 'Warm',
    descKey: 'themeWarmDesc',
    swatch: 'linear-gradient(135deg, #fef9ef 50%, #d97706 50%)',
    accent: '#d97706',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    descKey: 'themeLavenderDesc',
    swatch: 'linear-gradient(135deg, #faf5ff 50%, #7c3aed 50%)',
    accent: '#7c3aed',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    descKey: 'themeOceanDesc',
    swatch: 'linear-gradient(135deg, #f0fdfa 50%, #0d9488 50%)',
    accent: '#0d9488',
  },
  {
    id: 'amber',
    name: 'Amber',
    descKey: 'themeAmberDesc',
    swatch: 'linear-gradient(135deg, #fffbeb 50%, #f59e0b 50%)',
    accent: '#f59e0b',
  },
];

interface ThemeContextValue {
  colorTheme: ColorTheme;
  setColorTheme: (t: ColorTheme) => void;
  lightDark: LightDark;
  setLightDark: (t: LightDark) => void;
  isDark: boolean;
  cycleLightDark: () => void;
  currentConfig: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorTheme, _setColorTheme] = useState<ColorTheme>(() => {
    const saved = localStorage.getItem('colorTheme') as ColorTheme | null;
    return saved && THEMES.some(t => t.id === saved) ? saved : 'default';
  });

  const [lightDark, _setLightDark] = useState<LightDark>(() => {
    return (localStorage.getItem('theme') as LightDark) || 'system';
  });

  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  const currentConfig = THEMES.find(t => t.id === colorTheme) ?? THEMES[0];

  // Apply data-theme attribute
  useEffect(() => {
    document.documentElement.dataset.theme = colorTheme;
    localStorage.setItem('colorTheme', colorTheme);
  }, [colorTheme]);

  // Apply light/dark class
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      if (currentConfig.forceDark) {
        document.documentElement.classList.add('dark');
        setIsDark(true);
        return;
      }
      const dark = lightDark === 'dark' || (lightDark === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      setIsDark(dark);
      localStorage.setItem('theme', lightDark);
    };

    apply();
    const listener = () => { if (lightDark === 'system') apply(); };
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [lightDark, colorTheme, currentConfig.forceDark]);

  const setColorTheme = (t: ColorTheme) => _setColorTheme(t);

  const setLightDark = (t: LightDark) => {
    if (!currentConfig.forceDark) _setLightDark(t);
  };

  const cycleLightDark = () => {
    if (currentConfig.forceDark) return;
    if (lightDark === 'light') _setLightDark('dark');
    else if (lightDark === 'dark') _setLightDark('system');
    else _setLightDark('light');
  };

  return (
    <ThemeContext.Provider value={{
      colorTheme, setColorTheme,
      lightDark, setLightDark,
      isDark, cycleLightDark,
      currentConfig,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
