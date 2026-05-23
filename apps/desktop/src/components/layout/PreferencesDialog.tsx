import { Settings, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'ui/shadcn/dialog';
import { Label } from 'ui/shadcn/label';
import { Separator } from 'ui/shadcn/separator';
import type { ColorTheme, LightDark, ThemeConfig } from '../../context/ThemeContext';
import type { Language } from '../../context/LanguageContext';

interface PreferencesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
  lightDark: LightDark;
  setLightDark: (mode: LightDark) => void;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
  themes: ThemeConfig[];
}

export function PreferencesDialog({
  isOpen,
  onOpenChange,
  t,
  language,
  setLanguage,
  lightDark,
  setLightDark,
  colorTheme,
  setColorTheme,
  themes
}: PreferencesDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl gap-0 p-0 overflow-hidden animate-zoom-in"
        showCloseButton={true}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <Settings size={16} className="text-primary" />
            {t('settings') || '설정'}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-2.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('language') || '언어'}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { code: 'ko', label: '한국어' },
                { code: 'en', label: 'English' },
                { code: 'ja', label: '日本語' },
                { code: 'zh', label: '简体中文' }
              ] as { code: Language; label: string }[]).map(item => (
                <button
                  key={item.code}
                  onClick={() => setLanguage(item.code)}
                  className={`flex items-center justify-center h-10 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    language === item.code
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 bg-transparent'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <Separator className="bg-slate-100 dark:bg-slate-800" />

          <div className="space-y-2.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('themeMode') || '화면 모드'}
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'light', label: t('themeLight') || '라이트' },
                { id: 'dark', label: t('themeDark') || '다크' },
                { id: 'system', label: t('themeSystem') || '시스템' }
              ].map(item => {
                const isActive = lightDark === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setLightDark(item.id as LightDark)}
                    className={`flex items-center justify-center h-10 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 bg-transparent'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator className="bg-slate-100 dark:bg-slate-800" />

          <div className="space-y-2.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('colorTheme') || '컬러 테마'}
            </Label>
            <div className="flex flex-col gap-2">
              {themes.map(theme => {
                const isActive = colorTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => setColorTheme(theme.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20'
                        : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/20 bg-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full border border-black/10 dark:border-white/10"
                        style={{ background: theme.swatch }}
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{theme.name}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{theme.desc}</div>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      isActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-transparent'
                    }`}>
                      {isActive && <Check size={10} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full h-9.5 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-none flex items-center justify-center"
            style={{ background: 'var(--primary)' }}
          >
            {t('confirm') || '확인'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
