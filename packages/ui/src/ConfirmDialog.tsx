import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 네이티브 window.confirm을 대체하는 앱 일관성 확인 다이얼로그.
 * - ESC / 배경 클릭으로 취소, Enter로 확인
 * - 다크 모드 및 danger 변형 지원
 * - createPortal로 body에 렌더링하여 stacking context 이슈 회피
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      else if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-10 animate-zoom-in overflow-hidden">
        <div className="p-6 flex flex-col items-center text-center gap-3">
          {danger && (
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500 shrink-0">
              <AlertTriangle size={22} />
            </div>
          )}
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          {message && <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-line">{message}</p>}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">{cancelLabel}</Button>
          <Button type="button" variant={danger ? 'danger' : 'primary'} onClick={onConfirm} className="flex-1">{confirmLabel}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
