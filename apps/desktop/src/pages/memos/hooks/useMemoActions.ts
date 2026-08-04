import { useCallback } from 'react';
import { api } from 'shared/lib/api';
import { useToast } from 'ui/Toast';
import type { Memo, FolderType } from 'shared/types';
import { useLanguage } from 'shared/hooks/LanguageContext';

interface UseMemoActionsProps {
  currentFolder: FolderType;
  selectedMemo: Memo | null;
  setSelectedMemo: React.Dispatch<React.SetStateAction<Memo | null>>;
  setIsDetailOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fetchMemos: () => Promise<void>;
}

export function useMemoActions({
  currentFolder,
  selectedMemo,
  setSelectedMemo,
  setIsDetailOpen,
  fetchMemos,
}: UseMemoActionsProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const handleExtendExpiry = useCallback(async (memoId: string) => {
    try {
      const res = await api(`/api/memos/${memoId}/extend`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        showToast(t('archiveExtended30'), 'success');
        setSelectedMemo(prev => {
          if (prev && prev.id === memoId) {
            return { ...prev, expires_at: json.data.new_expires_at };
          }
          return prev;
        });
        fetchMemos();
      } else {
        showToast(json.error || t('extendFailed'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('networkError'), 'error');
    }
  }, [showToast, fetchMemos, setSelectedMemo]);

  const handleArchiveToggle = useCallback(async (memo: Memo, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextArchive = memo.is_archived === 0 ? 1 : 0;
    try {
      const res = await api(`/api/memos/${memo.id}/archive`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: nextArchive })
      });
      if (res.ok) {
        showToast(nextArchive === 1 ? t('movedToArchive') : t('unarchived'), 'success');
        fetchMemos();
      }
    } catch (err) { console.error(err); }
  }, [showToast, fetchMemos]);

  const handleSpamToggle = useCallback(async (memo: Memo, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSpam = memo.is_spam === 0 ? 1 : 0;
    try {
      const res = await api(`/api/memos/${memo.id}/spam`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_spam: nextSpam })
      });
      if (res.ok) {
        showToast(nextSpam === 1 ? t('reportedSpam') : t('spamReportCleared'), 'success');
        if (selectedMemo?.id === memo.id) {
          setIsDetailOpen(false);
          setSelectedMemo(null);
        }
        fetchMemos();
        window.dispatchEvent(new CustomEvent('memo_read_update'));
      }
    } catch (err) { console.error(err); }
  }, [showToast, selectedMemo, setIsDetailOpen, setSelectedMemo, fetchMemos]);

  const handleMoveFolder = useCallback(async (memoId: string, folderId: string | null) => {
    try {
      const res = await api('/api/memos/folders/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo_ids: [memoId], folder_id: folderId })
      });
      const json = await res.json();
      if (json.success) {
        showToast(t('folderChanged'), 'success');
        if (selectedMemo?.id === memoId) {
          setSelectedMemo(prev => prev ? { ...prev, folder_id: folderId || undefined } : null);
        }
        fetchMemos();
      }
    } catch (err) { console.error(err); }
  }, [showToast, selectedMemo, setSelectedMemo, fetchMemos]);

  const handleDeleteMemo = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isTrash = currentFolder === 'trash';
    if (!window.confirm(isTrash ? t('permanentDeleteConfirm') : t('deleteConfirm2'))) return;
    try {
      const res = await api(`/api/memos/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast(t('deleted2'), 'success');
        if (selectedMemo?.id === id) {
          setIsDetailOpen(false);
          setSelectedMemo(null);
        }
        fetchMemos();
        window.dispatchEvent(new CustomEvent('memo_read_update'));
      }
    } catch (err) { console.error(err); }
  }, [currentFolder, showToast, selectedMemo, setIsDetailOpen, setSelectedMemo, fetchMemos]);

  const handleRestoreMemo = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api(`/api/memos/${id}/restore`, { method: 'PUT' });
      const json = await res.json();
      if (json.success) {
        showToast(t('restored'), 'success');
        if (selectedMemo?.id === id) {
          setIsDetailOpen(false);
          setSelectedMemo(null);
        }
        fetchMemos();
        window.dispatchEvent(new CustomEvent('memo_read_update'));
      }
    } catch (err) { console.error(err); }
  }, [showToast, selectedMemo, setIsDetailOpen, setSelectedMemo, fetchMemos]);

  return {
    handleExtendExpiry,
    handleArchiveToggle,
    handleSpamToggle,
    handleMoveFolder,
    handleDeleteMemo,
    handleRestoreMemo,
  };
}
