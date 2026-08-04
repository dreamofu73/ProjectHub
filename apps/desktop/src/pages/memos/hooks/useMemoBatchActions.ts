import { useState } from 'react';
import { api } from 'shared/lib/api';
import type { FolderType, Memo } from 'shared/types';
import { useLanguage } from 'shared/hooks/LanguageContext';

interface UseMemoBatchActionsProps {
  currentFolder: FolderType;
  showToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  fetchMemos: () => void;
  filteredMemos: Memo[];
}

export function useMemoBatchActions({
  currentFolder,
  showToast,
  fetchMemos,
  filteredMemos,
}: UseMemoBatchActionsProps) {
  const { t } = useLanguage();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredMemos.map(m => m.id);
    setSelectedIds(prev => {
      const allSelected = visibleIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach(id => next.delete(id));
      else visibleIds.forEach(id => next.add(id));
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const isTrash = currentFolder === 'trash';
    const confirmMsg = isTrash
      ? t('confirmPermanentDeleteMemos').replace('{count}', String(selectedIds.size))
      : t('confirmDeleteMemos').replace('{count}', String(selectedIds.size));
    if (!window.confirm(confirmMsg)) return;

    try {
      const results = await Promise.all(
        Array.from(selectedIds).map(id => api(`/api/memos/${id}`, { method: 'DELETE' }).then(res => res.json()))
      );
      const failCount = results.filter(r => !r.success).length;
      if (failCount === 0) showToast(isTrash ? t('selectedMemosDeleted') : t('selectedMemosTrashed'), 'success');
      else showToast(t('someMemosDeleteFailed').replace('{count}', String(failCount)), 'warning');
      fetchMemos();
      window.dispatchEvent(new CustomEvent('memo_read_update'));
    } catch (err) {
      console.error(err);
      showToast(t('deleteError2'), 'error');
    }
  };

  const handleBatchRestore = async () => {
    if (selectedIds.size === 0) return;
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map(id => api(`/api/memos/${id}/restore`, { method: 'PUT' }).then(res => res.json()))
      );
      const failCount = results.filter(r => !r.success).length;
      if (failCount === 0) showToast(t('selectedMemosRestored'), 'success');
      else showToast(t('someMemosRestoreFailed').replace('{count}', String(failCount)), 'warning');
      fetchMemos();
      window.dispatchEvent(new CustomEvent('memo_read_update'));
    } catch (err) {
      console.error(err);
      showToast(t('restoreError'), 'error');
    }
  };

  const handleBatchMove = async (folderId: string | null) => {
    if (selectedIds.size === 0) return;
    try {
      const res = await api('/api/memos/folders/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo_ids: Array.from(selectedIds), folder_id: folderId })
      });
      const json = await res.json();
      if (json.success) {
        showToast(folderId ? t('movedToFolder') : t('removedFromFolder'), 'success');
        setSelectedIds(new Set());
        fetchMemos();
      } else showToast(json.error || t('moveFailed'), 'error');
    } catch (err) {
      console.error(err);
      showToast(t('errOccurred'), 'error');
    }
  };

  const handleBatchArchive = async () => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => api(`/api/memos/${id}/archive`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_archived: 1 })
        }).then(res => res.json()))
      );
      showToast(t('selectedMemosArchived'), 'success');
      fetchMemos();
    } catch (err) {
      console.error(err);
      showToast(t('archiveError'), 'error');
    }
  };

  const handleBatchSpam = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(t('confirmReportSpamMemos').replace('{count}', String(selectedIds.size)))) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => api(`/api/memos/${id}/spam`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_spam: 1 })
        }).then(res => res.json()))
      );
      showToast(t('selectedMemosSpammed'), 'success');
      fetchMemos();
      window.dispatchEvent(new CustomEvent('memo_read_update'));
    } catch (err) {
      console.error(err);
      showToast(t('spamReportError'), 'error');
    }
  };

  const handleBatchUnspam = async () => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => api(`/api/memos/${id}/spam`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_spam: 0 })
        }).then(res => res.json()))
      );
      showToast(t('spamCleared'), 'success');
      fetchMemos();
      window.dispatchEvent(new CustomEvent('memo_read_update'));
    } catch (err) {
      console.error(err);
      showToast(t('spamClearError'), 'error');
    }
  };

  const handleDeleteAllUnread = async () => {
    if (!window.confirm(t('deleteAllUnread'))) return;
    try {
      const res = await api('/api/memos/received/unread', { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast(t('allUnreadDeleted'), 'success');
        fetchMemos();
        window.dispatchEvent(new CustomEvent('memo_read_update'));
      } else showToast(json.error || t('deleteFail'), 'error');
    } catch (err) {
      console.error(err);
      showToast(t('deleteError'), 'error');
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  return {
    selectedIds,
    setSelectedIds,
    clearSelection,
    toggleSelectRow,
    toggleSelectAll,
    handleBatchDelete,
    handleBatchRestore,
    handleBatchMove,
    handleBatchArchive,
    handleBatchSpam,
    handleBatchUnspam,
    handleDeleteAllUnread,
  };
}
