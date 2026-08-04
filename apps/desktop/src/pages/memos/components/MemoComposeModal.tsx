import { Send, X, Award, Search, Paperclip, File, RefreshCw } from 'lucide-react';
import type { User } from 'shared/types';
import { Button } from 'ui/Button';
import { HTMLEditor, createHTMLEditorLabels } from 'ui/HTMLEditor';
import { useLanguage } from '../../../context/LanguageContext';

interface MemoComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSelfWriteMode: boolean;
  currentUser: User | null;
  recipients: User[];
  setRecipients: React.Dispatch<React.SetStateAction<User[]>>;
  recipientSearch: string;
  setRecipientSearch: (val: string) => void;
  filteredUsers: User[];
  title: string;
  setTitle: (val: string) => void;
  content: string;
  setContent: (val: string) => void;
  attachedFiles: File[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  sending: boolean;
  handleSendMemo: (e: React.FormEvent) => void;
}

export function MemoComposeModal({
  isOpen,
  onClose,
  isSelfWriteMode,
  currentUser,
  recipients,
  setRecipients,
  recipientSearch,
  setRecipientSearch,
  filteredUsers,
  title,
  setTitle,
  content,
  setContent,
  attachedFiles,
  setAttachedFiles,
  sending,
  handleSendMemo
}: MemoComposeModalProps) {
  const { t, language } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 backdrop-blur-md overflow-y-auto py-8 md:py-16 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)] bg-[var(--bg-surface-2)]/50">
          <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Send size={16} className="text-[var(--primary)]" />
            {isSelfWriteMode ? t('composeSelfMemo') : t('composeNewMemo')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors border-none bg-transparent cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSendMemo} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-6 space-y-5 flex-1 flex flex-col">
            <div className="space-y-1.5 relative">
              <label className="text-sm font-bold text-[var(--text-secondary)]">
                {t('receiver')} <span className="text-red-500">*</span>
              </label>
              
              {isSelfWriteMode ? (
                <div className="flex items-center gap-2 p-2 bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 rounded-xl text-sm font-semibold select-none">
                  <Award size={14} />
                  <span>{currentUser?.lastname}{currentUser?.firstname} {t('writeToSelfNote')}</span>
                </div>
              ) : (
                <>
                  {recipients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-[var(--bg-surface-2)] rounded-xl border border-dashed border-[var(--primary)]/30 dark:border-[var(--border)] max-h-24 overflow-y-auto">
                      {recipients.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center gap-1.5 bg-[var(--primary)]/10 text-[var(--primary)] px-2.5 py-1 rounded-lg text-sm font-semibold border border-[var(--primary)]/20 animate-in zoom-in-95 duration-150"
                        >
                          <span>{user.lastname}{user.firstname}</span>
                          <span className="text-xs opacity-65">@{user.login}</span>
                          <button
                            type="button"
                            onClick={() => setRecipients(prev => prev.filter(r => r.id !== user.id))}
                            className="hover:bg-[var(--primary)]/10 rounded p-0.5 border-none bg-transparent cursor-pointer text-[var(--primary)] flex items-center transition-colors"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('searchToAdd')}
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      className="w-full px-3.5 py-2.5 h-10 border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all placeholder:text-[var(--text-muted)] text-[var(--text-primary)]"
                    />
                    <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  </div>

                  {recipientSearch.trim() !== '' && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl z-30 divide-y divide-[var(--border)] animate-in fade-in slide-in-from-top-1 duration-150">
                      {filteredUsers.length === 0 ? (
                        <div className="p-3 text-center text-sm text-[var(--text-muted)] font-medium">{t('noSearchResultsOrAdded')}</div>
                      ) : (
                        filteredUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setRecipients(prev => [...prev, u]);
                              setRecipientSearch('');
                            }}
                            className="w-full text-left p-3 text-sm hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center justify-between cursor-pointer border-none bg-transparent"
                          >
                            <span className="font-semibold">{u.lastname}{u.firstname}</span>
                            <span className="text-xs text-[var(--text-muted)]">@{u.login} | {u.email}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[var(--text-secondary)]">
                {t('title')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder={t('memoTitlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 h-10 border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all placeholder:text-[var(--text-muted)] text-[var(--text-primary)]"
              />
            </div>

            <div className="space-y-1.5 flex-1 flex flex-col">
              <label className="text-sm font-bold text-[var(--text-secondary)]">
                {t('content')} <span className="text-red-500">*</span>
              </label>
              <div className="flex-1 flex flex-col min-h-[300px]">
                <HTMLEditor
                  value={content}
                  onChange={setContent}
                  height={320}
                  labels={createHTMLEditorLabels(t, language)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--text-secondary)] flex items-center gap-1">
                <Paperclip size={13} className="text-[var(--text-muted)]" />
                {t('attachFile')}
              </label>
              
              <div className="relative border-2 border-dashed border-[var(--border)] rounded-xl hover:border-[var(--primary)] transition-all bg-[var(--bg-surface-2)]/50 p-4 text-center cursor-pointer group">
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none select-none">
                  <Paperclip size={20} className="text-[var(--text-muted)] transition-colors" />
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">
                    {t('dragDropFiles')}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {t('maxFileSizeHint')}
                  </span>
                </div>
              </div>

              {attachedFiles.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-36 overflow-y-auto pr-1">
                  {attachedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl hover:border-[var(--primary)] transition-all text-sm font-medium animate-in zoom-in-95 duration-150"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <File size={14} className="text-[var(--text-muted)] shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-[var(--text-primary)] font-semibold">{file.name}</span>
                          <span className="text-xs text-[var(--text-muted)]">{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-955/20 rounded-lg text-[var(--text-muted)] transition-all border-none bg-transparent cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--border)] bg-[var(--bg-surface-2)]/50">
            <Button
              type="button"
              onClick={onClose}
              className="bg-[var(--bg-surface-2)] hover:opacity-90 text-[var(--text-secondary)] font-semibold px-4 py-2 rounded-xl text-sm border-none cursor-pointer"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={sending}
              className="bg-[var(--primary)] hover:opacity-90 text-white font-semibold px-5 py-2 rounded-xl text-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {sending ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  {t('sending')}
                </>
              ) : (
                <>
                  <Send size={14} />
                  {t('send')}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
