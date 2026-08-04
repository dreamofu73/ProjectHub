import { CheckSquare, Square, Minus, RefreshCw, Coffee, Clock, Check } from 'lucide-react';
import type { Memo, FolderType } from 'shared/types';
import { useLanguage } from 'shared/hooks/LanguageContext';

interface MemoListProps {
  memos: Memo[];
  loading: boolean;
  currentFolder: FolderType;
  currentUserId: string | null;
  selectedIds: Set<string>;
  toggleSelectRow: (id: string, e: React.MouseEvent) => void;
  handleOpenDetail: (memo: Memo) => void;
  handleRestoreMemo: (id: string, e: React.MouseEvent) => void;
  handleArchiveToggle: (memo: Memo, e: React.MouseEvent) => void;
  handleSpamToggle: (memo: Memo, e: React.MouseEvent) => void;
  toggleSelectAll?: () => void;
}

export function MemoList({
  memos,
  loading,
  currentFolder,
  currentUserId,
  selectedIds,
  toggleSelectRow,
  handleOpenDetail,
  toggleSelectAll
}: MemoListProps) {
  const { t } = useLanguage();

  const formatMemoDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yy}-${mm}-${dd} [${hh}:${min}]`;
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-[var(--text-muted)]">
        <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-[var(--primary)]" />
        <p className="font-medium text-xs">{t('logsLoading')}</p>
      </div>
    );
  }

  if (memos.length === 0) {
    return (
      <div className="py-24 text-center text-[var(--text-muted)] font-medium text-xs">
        {t('noMemos')}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar select-none">
      <table className="w-full text-left border-collapse table-fixed">
        <thead>
          <tr className="border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-surface-2)]/50">
            <th className="w-10 p-2 text-center">
              <div 
                className="flex items-center justify-center cursor-pointer p-1 rounded hover:bg-[var(--bg-surface-2)]"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelectAll?.();
                }}
                title={memos.length > 0 && memos.every(m => selectedIds.has(m.id)) ? t('deselect') : t('selectAll')}
              >
                {memos.length > 0 && memos.every(m => selectedIds.has(m.id)) ? (
                  <CheckSquare size={14} className="text-[var(--primary)]" />
                ) : memos.some(m => selectedIds.has(m.id)) ? (
                  <Minus size={14} className="text-[var(--primary)]" />
                ) : (
                  <Square size={14} className="text-[var(--text-muted)] opacity-60" />
                )}
              </div>
            </th>
            <th className="w-28 p-2 text-xs font-semibold text-[var(--text-muted)]">{currentFolder === 'sent' || currentFolder === 'reserved' ? t('recipient') : t('sender')}</th>
            <th className="p-2 text-xs font-semibold text-[var(--text-muted)]">{t('title')}</th>
            <th className="w-36 p-2 text-right pr-4 text-xs font-semibold text-[var(--text-muted)]">{currentFolder === 'reserved' ? t('scheduledTime') : t('date')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {memos.map((memo) => {
            const isUnread = memo.is_read === 0 && memo.receiver_id === currentUserId;
            const isChecked = selectedIds.has(memo.id);
            
            const userLabel = currentFolder === 'sent' || currentFolder === 'reserved'
              ? `${memo.receiver_lastname || ''}${memo.receiver_firstname || memo.receiver_login}`
              : `${memo.sender_lastname || ''}${memo.sender_firstname || memo.sender_login}`;

            return (
              <tr
                key={memo.id}
                onClick={() => handleOpenDetail(memo)}
                className={`hover:bg-[var(--bg-surface-2)]/50 cursor-pointer transition-colors ${
                  isChecked ? 'bg-[var(--primary)]/10' : ''
                }`}
              >
                <td className="p-2 text-center" onClick={(e) => toggleSelectRow(memo.id, e)}>
                  <div className="flex items-center justify-center">
                    {isChecked ? (
                      <CheckSquare size={14} className="text-[var(--primary)]" />
                    ) : (
                      <Square size={14} className="text-[var(--text-muted)] opacity-65" />
                    )}
                  </div>
                </td>

                <td className="p-2 pl-3 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Coffee 
                      size={13} 
                      className={isUnread ? "text-[var(--primary)] fill-[var(--primary)]/10 shrink-0" : "text-[var(--text-muted)] shrink-0"} 
                    />
                    <span className={`text-xs truncate ${isUnread ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)] font-medium'}`}>
                      {userLabel}
                    </span>
                  </div>
                </td>

                <td className="p-2 min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className={`text-xs truncate max-w-full block ${isUnread ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      {memo.title}
                    </span>
                  </div>
                </td>

                <td className="p-2 pr-4 text-right">
                  {currentFolder === 'reserved' ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        memo.is_sent
                          ? 'bg-green-500/10 text-green-600'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {memo.is_sent ? <Check size={10} /> : <Clock size={10} />}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] font-medium">
                        {memo.reserved_at ? formatMemoDate(memo.reserved_at) : formatMemoDate(memo.created_at)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)] font-medium">
                      {formatMemoDate(memo.created_at)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
