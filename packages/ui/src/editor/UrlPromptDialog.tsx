import { createPortal } from 'react-dom';
import { Button } from '../Button';
import type { HTMLEditorLabels } from './labels';

interface UrlPromptDialogProps {
  mode: 'link' | 'image';
  value: string;
  error: string | null;
  labels: HTMLEditorLabels;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

/** 링크/이미지 URL 입력 다이얼로그 (네이티브 window.prompt 대체) */
export function UrlPromptDialog({ mode, value, error, labels, onChange, onCancel, onSubmit }: UrlPromptDialogProps) {
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={mode === 'link' ? labels.insertLink : labels.insertImage}>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onCancel} />
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onCancel(); } }}
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-10 animate-zoom-in overflow-hidden p-5 flex flex-col gap-3"
      >
        <label className="text-sm font-bold text-slate-900 dark:text-white" htmlFor="html-editor-url-input">
          {mode === 'link' ? labels.enterUrl : labels.enterImageUrl}
        </label>
        <input
          id="html-editor-url-input"
          type="text"
          inputMode="url"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
        />
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 -mt-1">{error}</p>
        )}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">{labels.cancel}</Button>
          <Button type="submit" variant="primary" className="flex-1">{labels.ok}</Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
