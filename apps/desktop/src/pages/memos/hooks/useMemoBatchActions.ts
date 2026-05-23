import { useState } from 'react';
import { api } from 'shared/lib/api';
import type { FolderType, Memo } from 'shared/types';

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
      ? `선택한 ${selectedIds.size}개의 쪽지를 영구 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.`
      : `선택한 ${selectedIds.size}개의 쪽지를 삭제하시겠습니까? 삭제 시 휴지통으로 이동합니다.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const results = await Promise.all(
        Array.from(selectedIds).map(id => api(`/api/memos/${id}`, { method: 'DELETE' }).then(res => res.json()))
      );
      const failCount = results.filter(r => !r.success).length;
      if (failCount === 0) showToast(isTrash ? '선택한 쪽지가 영구 삭제되었습니다.' : '선택한 쪽지가 삭제되었습니다.', 'success');
      else showToast(`일부 쪽지(${failCount}건) 삭제에 실패했습니다.`, 'warning');
      fetchMemos();
      window.dispatchEvent(new CustomEvent('memo_read_update'));
    } catch (err) {
      console.error(err);
      showToast('삭제 작업 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleBatchRestore = async () => {
    if (selectedIds.size === 0) return;
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map(id => api(`/api/memos/${id}/restore`, { method: 'PUT' }).then(res => res.json()))
      );
      const failCount = results.filter(r => !r.success).length;
      if (failCount === 0) showToast('선택한 쪽지가 복원되었습니다.', 'success');
      else showToast(`일부 쪽지(${failCount}건) 복원에 실패했습니다.`, 'warning');
      fetchMemos();
      window.dispatchEvent(new CustomEvent('memo_read_update'));
    } catch (err) {
      console.error(err);
      showToast('복원 작업 중 오류가 발생했습니다.', 'error');
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
        showToast(folderId ? '선택한 쪽지가 폴더로 이동되었습니다.' : '선택한 쪽지가 폴더에서 제외되었습니다.', 'success');
        setSelectedIds(new Set());
        fetchMemos();
      } else showToast(json.error || '이동 실패', 'error');
    } catch (err) {
      console.error(err);
      showToast('오류가 발생했습니다.', 'error');
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
      showToast('선택한 쪽지가 보관 처리되었습니다.', 'success');
      fetchMemos();
    } catch (err) {
      console.error(err);
      showToast('보관 작업 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleBatchSpam = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.size}개의 쪽지를 스팸으로 신고하시겠습니까?`)) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => api(`/api/memos/${id}/spam`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_spam: 1 })
        }).then(res => res.json()))
      );
      showToast('선택한 쪽지가 스팸으로 신고되었습니다.', 'success');
      fetchMemos();
      window.dispatchEvent(new CustomEvent('memo_read_update'));
    } catch (err) {
      console.error(err);
      showToast('스팸 신고 중 오류가 발생했습니다.', 'error');
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
      showToast('선택한 쪽지의 스팸 신고가 해제되었습니다.', 'success');
      fetchMemos();
      window.dispatchEvent(new CustomEvent('memo_read_update'));
    } catch (err) {
      console.error(err);
      showToast('스팸 해제 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleDeleteAllUnread = async () => {
    if (!window.confirm('안 읽은 모든 받은 쪽지를 일괄 삭제하시겠습니까?')) return;
    try {
      const res = await api('/api/memos/received/unread', { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('안 읽은 받은 쪽지가 모두 삭제되었습니다.', 'success');
        fetchMemos();
        window.dispatchEvent(new CustomEvent('memo_read_update'));
      } else showToast(json.error || '삭제 실패', 'error');
    } catch (err) {
      console.error(err);
      showToast('삭제 중 오류가 발생했습니다.', 'error');
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
