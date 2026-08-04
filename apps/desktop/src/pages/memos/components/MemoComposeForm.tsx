import React, { useState, useMemo } from 'react';
import { Send, X, Award, Search, Paperclip, File, RefreshCw, Users } from 'lucide-react';
import { Button } from 'ui/Button';
import { HTMLEditor, createHTMLEditorLabels } from 'ui/HTMLEditor';
import { useLanguage } from '../../../context/LanguageContext';
import { AddressBookPicker } from './AddressBookPickerModal';
import type { User } from 'shared/types';

interface MemoComposeFormProps {
  isSelfWriteMode: boolean;
  currentUser: { lastname: string; firstname: string; login: string } | null;
  recipients: any[];
  setRecipients: React.Dispatch<React.SetStateAction<User[]>>;
  recipientSearch: string;
  setRecipientSearch: (val: string) => void;
  filteredUsers: any[];
  title: string;
  setTitle: (val: string) => void;
  isReservedSend: boolean;
  setIsReservedSend: (val: boolean) => void;
  reservedDate: string;
  setReservedDate: (val: string) => void;
  content: string;
  setContent: (val: string) => void;
  attachedFiles: File[];
  setAttachedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  sending: boolean;
  handleSendMemo: (e: React.FormEvent) => Promise<void>;
  setIsComposeOpen: (val: boolean) => void;
  existingRecipientIds: Set<string>;
  t: (key: string) => string;
}

export function MemoComposeForm({
  isSelfWriteMode,
  currentUser,
  recipients,
  setRecipients,
  recipientSearch,
  setRecipientSearch,
  filteredUsers,
  title,
  setTitle,
  isReservedSend,
  setIsReservedSend,
  reservedDate,
  setReservedDate,
  content,
  setContent,
  attachedFiles,
  setAttachedFiles,
  sending,
  handleSendMemo,
  setIsComposeOpen,
  existingRecipientIds,
  t,
}: MemoComposeFormProps) {
  const [isAddressBookOpen, setIsAddressBookOpen] = useState(false);
  const { language } = useLanguage();

  // Group recipients by groupName for display
  const groupedRecipients = useMemo(() => {
    const groups: { groupName: string | null; users: User[] }[] = [];
    const groupMap = new Map<string | null, User[]>();
    for (const user of recipients) {
      const key = user.groupName ?? null;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(user);
    }
    for (const [key, users] of groupMap) {
      groups.push({ groupName: key, users });
    }
    return groups;
  }, [recipients]);

  const handleAddressBookPick = (selectedUsers: User[]) => {
    setRecipients(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      const newUsers = selectedUsers.filter(u => !existingIds.has(u.id));
      return [...prev, ...newUsers];
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Send size={14} className="text-[var(--primary)]" />
          {isSelfWriteMode ? t('composeSelfMemo') : t('composeNewMemo')}
        </h3>
        <button
          type="button"
          onClick={() => setIsComposeOpen(false)}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)] transition-colors border-none bg-transparent cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
      
      <form onSubmit={handleSendMemo} className="flex-1 overflow-y-auto flex flex-col p-6 space-y-5 custom-scrollbar">
        {/* 제목 (먼저) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[var(--text-secondary)]">{t('title')} <span className="text-red-500">*</span></label>
          <input type="text" placeholder={t('memoTitlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full px-3.5 py-2 h-9.5 border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all placeholder:text-[var(--text-muted)] text-[var(--text-primary)]" />
        </div>

        {/* 받는 사람 (두 번째) */}
        <div className="space-y-1.5 relative">
          <label className="text-xs font-bold text-[var(--text-secondary)]">
            {t('receiver')} <span className="text-red-500">*</span>
          </label>
          {isSelfWriteMode ? (
            <div className="flex items-center gap-2 p-2 bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 rounded-xl text-xs font-bold select-none">
              <Award size={13} />
              <span>{currentUser?.lastname}{currentUser?.firstname} {t('writeToSelfNote')}</span>
            </div>
          ) : (
            <>
              {recipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 bg-[var(--bg-surface-2)] rounded-xl border border-dashed border-[var(--border)] max-h-24 overflow-y-auto custom-scrollbar">
                  {groupedRecipients.map((group) => (
                    <React.Fragment key={group.groupName ?? '__direct'}>
                      {group.groupName && (
                        <div className="w-full flex items-center gap-1 mb-0.5 mt-0.5 first:mt-0">
                          <Users size={10} className="text-[var(--text-muted)]" />
                          <span className="text-xs font-bold text-[var(--text-muted)]">{group.groupName}</span>
                        </div>
                      )}
                      {group.users.map((user) => (
                        <div key={user.id} className="flex items-center gap-1.5 bg-[var(--primary)]/10 text-[var(--primary)] px-2.5 py-1 rounded-lg text-xs font-bold border border-[var(--primary)]/20 animate-in zoom-in-95 duration-150">
                          <span>{user.lastname}{user.firstname}</span>
                          <span className="text-xs opacity-65">@{user.login}</span>
                          <button type="button" onClick={() => setRecipients(prev => prev.filter(r => r.id !== user.id))} className="hover:bg-[var(--primary)]/15 rounded p-0.5 border-none bg-transparent cursor-pointer text-[var(--primary)] flex items-center transition-colors">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type="text" placeholder={t('searchToAdd')} value={recipientSearch} onChange={(e) => setRecipientSearch(e.target.value)} className="w-full px-3.5 py-2 h-9.5 border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)] transition-all placeholder:text-[var(--text-muted)] text-[var(--text-primary)]" />
                  <Search size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddressBookOpen(!isAddressBookOpen)}
                  title={t('contactGroups')}
                  className={`h-9.5 px-3 border rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0 ${
                    isAddressBookOpen
                      ? 'border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-[var(--border)] bg-[var(--bg-surface-2)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] hover:border-[var(--primary)]/30 text-[var(--text-muted)]'
                  }`}
                >
                  <Users size={13} />
                  <span className="hidden sm:inline">{t('contactGroups')}</span>
                </button>
              </div>
              {recipientSearch.trim() !== '' && (
                <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl z-35 divide-y divide-[var(--border)] animate-in fade-in slide-in-from-top-1 duration-150 custom-scrollbar" style={{ top: '100%' }}>
                  {filteredUsers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-[var(--text-muted)] font-medium">{t('noSearchResultsOrAdded')}</div>
                  ) : (
                    filteredUsers.map((u) => (
                      <button key={u.id} type="button" onClick={() => { setRecipients(prev => [...prev, u]); setRecipientSearch(''); }} className="w-full text-left p-2.5 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center justify-between cursor-pointer border-none bg-transparent font-medium">
                        <span className="font-semibold">{u.lastname}{u.firstname}</span>
                        <span className="text-xs text-[var(--text-muted)]">@{u.login} | {u.email}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* 수신그룹 팝업 */}
              {isAddressBookOpen && (
                <div className="absolute left-0 right-0 z-30 mt-1 animate-in fade-in slide-in-from-top-1 duration-150" style={{ top: '100%' }}>
                  <AddressBookPicker
                    existingRecipientIds={existingRecipientIds}
                    onSelect={handleAddressBookPick}
                    onClose={() => setIsAddressBookOpen(false)}
                    t={t}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* 예약 발송 설정 */}
        <div className="space-y-2 p-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-2xl">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--text-secondary)] select-none">
            <input
              type="checkbox"
              checked={isReservedSend}
              onChange={(e) => setIsReservedSend(e.target.checked)}
              className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)] w-4 h-4 cursor-pointer"
            />
            <span>{t('scheduleSendSettings')}</span>
          </label>
          {isReservedSend && (
            <div className="mt-2.5 flex items-center gap-2.5 animate-in fade-in duration-200">
              <input
                type="datetime-local"
                value={reservedDate}
                onChange={(e) => setReservedDate(e.target.value)}
                required
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                className="px-3.5 py-2 h-9 border border-[var(--border)] rounded-xl bg-[var(--bg-surface)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 text-[var(--text-primary)] cursor-pointer"
              />
              <span className="text-xs text-[var(--text-muted)] font-medium">{t('scheduleSendDesc')}</span>
            </div>
          )}
        </div>

        <div className="space-y-1.5 flex-1 flex flex-col">
          <label className="text-xs font-bold text-[var(--text-secondary)]">{t('content')} <span className="text-red-500">*</span></label>
          <div className="flex-1 flex flex-col min-h-[250px]">
            <HTMLEditor value={content} onChange={setContent} height={280} labels={createHTMLEditorLabels(t, language)} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1">
            <Paperclip size={12} className="text-[var(--text-muted)]" />{t('attachFile')}
          </label>
          <div className="relative border-2 border-dashed border-[var(--border)] rounded-2xl hover:border-[var(--primary)] transition-all bg-[var(--bg-surface-2)]/50 p-4 text-center cursor-pointer">
            <input type="file" multiple onChange={(e) => { if (e.target.files) setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none select-none">
              <Paperclip size={18} className="text-[var(--text-muted)]" />
              <span className="text-xs font-bold text-[var(--text-secondary)]">{t('dragDropFiles')}</span>
              <span className="text-xs text-[var(--text-muted)]">{t('maxFileSizeHint')}</span>
            </div>
          </div>
          {attachedFiles.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl transition-all text-xs font-semibold">
                  <div className="flex items-center gap-2 min-w-0">
                    <File size={13} className="text-[var(--text-muted)] shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-[var(--text-primary)] font-bold">{file.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))} className="p-1 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-955/20 rounded-lg text-[var(--text-muted)] transition-all border-none bg-transparent cursor-pointer">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-5 border-t border-[var(--border)] shrink-0">
          <Button type="button" onClick={() => setIsComposeOpen(false)} className="bg-[var(--bg-surface-2)] hover:opacity-90 text-[var(--text-secondary)] font-bold px-4 py-2 rounded-xl text-xs border-none cursor-pointer h-9">{t('cancel')}</Button>
          <Button type="submit" disabled={sending} className="bg-[var(--primary)] hover:opacity-90 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 h-9 border-none">
            {sending ? <><RefreshCw size={13} className="animate-spin" />{t('sending')}</> : <><Send size={13} />{t('send')}</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
