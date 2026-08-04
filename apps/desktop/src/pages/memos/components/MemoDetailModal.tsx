import { Paperclip, Download, X } from 'lucide-react';
import { sanitizeHtml } from 'shared/lib/sanitize';
import type { Memo, CustomFolder, FolderType } from 'shared/types';
import { useLanguage } from 'shared/hooks/LanguageContext';

interface MemoDetailModalProps {
  memo: Memo | null;
  onClose: () => void;
  currentFolder: FolderType;
  currentUserId: string | null;
  customFolders: CustomFolder[];
  handleDeleteMemo: (id: string, e: React.MouseEvent) => void;
  handleRestoreMemo: (id: string, e: React.MouseEvent) => void;
  handleReply: (memo: Memo) => void;
  handleMoveFolder: (memoId: string, folderId: string | null) => void;
  handleBlockSender: (senderLogin: string) => void;
  handleExtendExpiry: (id: string) => void;
  showCloseButton?: boolean;
}

export function MemoDetailModal({
  memo,
  onClose,
  currentFolder,
  handleBlockSender,
  handleExtendExpiry,
  showCloseButton = false
}: MemoDetailModalProps) {
  const { t } = useLanguage();

  if (!memo) return null;

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

  const isOutgoing = currentFolder === 'sent' || currentFolder === 'reserved';
  const senderLabel = isOutgoing
    ? `${memo.receiver_lastname || ''}${memo.receiver_firstname || memo.receiver_login}`
    : `${memo.sender_lastname || ''}${memo.sender_firstname || memo.sender_login}`;
  
  return (
    <div className="flex flex-col h-full select-none overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">
      {/* 제목 영역 */}
      <div className="px-6 py-5 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/50 flex items-start justify-between gap-4">
        <h2 className="text-lg font-extrabold text-[var(--text-primary)] leading-snug break-words flex-1">
          {memo.title}
        </h2>
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] cursor-pointer shrink-0"
            title={t('close')}
          >
            <X size={16} />
          </button>
        )}
      </div>

        {/* 메타데이터 영역 */}
      <div className="px-6 py-3 border-b border-[var(--border)] text-xs flex items-center gap-6 shrink-0 bg-[var(--bg-surface-2)]/20">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] font-medium shrink-0">{isOutgoing ? t('recipient') : t('sender')}</span>
          <span className="text-[var(--text-primary)] font-bold flex items-center gap-1">
            {senderLabel}
            {isOutgoing
              ? (memo.receiver_login && <span className="text-[var(--text-muted)] font-normal">@{memo.receiver_login}</span>)
              : (memo.sender_login && <span className="text-[var(--text-muted)] font-normal">@{memo.sender_login}</span>)
            }
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] font-medium shrink-0">{t('receivedTime')}</span>
          <span className="text-[var(--text-secondary)] font-medium mr-2">
            {formatMemoDate(memo.created_at)}
          </span>
          {currentFolder !== 'sent' && currentFolder !== 'reserved' && memo.sender_login && (
            <>
              <span className="text-[var(--border)]">|</span>
              <button
                onClick={() => handleBlockSender(memo.sender_login!)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline border-none bg-transparent cursor-pointer font-semibold text-xs"
              >
                {t('block')}
              </button>
            </>
          )}
        </div>
        {currentFolder === 'reserved' && (
          <div className="flex items-center gap-3 ml-auto">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] font-medium shrink-0">{t('sendState')}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                memo.is_sent
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-amber-500/10 text-amber-600'
              }`}>
                {memo.is_sent ? t('sentSuccess') : t('scheduled')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] font-medium shrink-0">{t('scheduledTime')}</span>
              <span className="text-[var(--text-secondary)] font-medium">
                {memo.reserved_at ? formatMemoDate(memo.reserved_at) : '-'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 본문 영역 */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* 만료 기한 및 기한 연장 */}
        {memo.is_read === 1 && memo.is_archived === 0 && memo.expires_at && (
          <div className="flex items-center justify-between p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs animate-in fade-in duration-200 select-text">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-amber-600 dark:text-amber-400 font-bold">{t('archiveExpiryDate')}</span>
              <span className="text-[var(--text-secondary)] font-semibold truncate">
                {formatMemoDate(memo.expires_at)} {t('autoDeleteIn30Days')}
              </span>
            </div>
            <button
              onClick={() => handleExtendExpiry(memo.id)}
              className="px-3 py-1.5 h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors border-none cursor-pointer text-xs shrink-0 select-none"
            >
              {t('extend30Days')}
            </button>
          </div>
        )}
        
        <div 
          className="memo-detail-content text-[var(--text-secondary)] text-xs leading-relaxed whitespace-normal break-words overflow-x-auto select-text prose dark:prose-invert max-w-none pb-4"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(memo.content) }}
        />

        {/* 첨부파일 영역 */}
        {memo.attachments && memo.attachments.length > 0 && (
          <div className="pt-4 border-t border-[var(--border)] space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                {t('attachedFilesCount').replace('{count}', String(memo.attachments.length))}
              </h4>
              {memo.attachments.length > 1 && (
                <a
                  href={`/api/attachments/batch-download?memo_id=${memo.id}`}
                  download
                  className="text-xs font-bold hover:opacity-85 flex items-center gap-1 cursor-pointer text-[var(--primary)]"
                >
                  {t('downloadAll')}
                </a>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {memo.attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2.5 bg-[var(--bg-surface-2)]/40 border border-[var(--border)] rounded hover:border-[var(--primary)] transition-all group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="text-[var(--text-muted)] shrink-0" size={14} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {file.filename}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] font-medium">
                        {(file.filesize / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                  <a
                    href={`/api/attachments/${file.id}`}
                    download
                    className="p-1 hover:bg-[var(--bg-surface-2)] border border-[var(--border)] rounded text-[var(--text-secondary)] cursor-pointer"
                  >
                    <Download size={12} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
