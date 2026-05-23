import { useCallback } from 'react';
import { api } from 'shared/lib/api';
import { useToast } from 'ui/Toast';
import type { Memo, FolderType } from 'shared/types';

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
  const { showToast } = useToast();

  const handleExtendExpiry = useCallback(async (memoId: string) => {
    try {
      const res = await api(`/api/memos/${memoId}/extend`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        showToast('보관 만료 기한이 30일 연장되었습니다.', 'success');
        setSelectedMemo(prev => {
          if (prev && prev.id === memoId) {
            return { ...prev, expires_at: json.data.new_expires_at };
          }
          return prev;
        });
        fetchMemos();
      } else {
        showToast(json.error || '연장에 실패했습니다.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('네트워크 오류가 발생했습니다.', 'error');
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
        showToast(nextArchive === 1 ? '보관함으로 이동되었습니다.' : '보관 해제되었습니다.', 'success');
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
        showToast(nextSpam === 1 ? '스팸으로 신고되었습니다.' : '스팸 신고가 해제되었습니다.', 'success');
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
        showToast('폴더가 변경되었습니다.', 'success');
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
    if (!window.confirm(isTrash ? '영구 삭제하시겠습니까?' : '삭제하시겠습니까?')) return;
    try {
      const res = await api(`/api/memos/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('삭제되었습니다.', 'success');
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
        showToast('복원되었습니다.', 'success');
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
