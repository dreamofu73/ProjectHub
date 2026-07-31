import { useState } from 'react';
import { api } from 'shared/lib/api';
import type { Member } from 'shared/hooks/useProjectMembers';

export function useMemberBulkActions(projectId: string | undefined, fetchMembers: () => void) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const toggleInSet = (prev: Set<string>, item: string): Set<string> => {
    const next = new Set(prev);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    return next;
  };

  const toggleSelect = (userId: string) => setSelectedIds(prev => toggleInSet(prev, userId));

  const toggleSelectAll = (pagedMembers: Member[]) => {
    if (selectedIds.size === pagedMembers.length && pagedMembers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedMembers.map(m => m.user_id)));
    }
  };

  const handleBulkRoleChange = async () => {
    if (selectedIds.size === 0 || !bulkRole || !projectId) return;
    setBulkUpdating(true);
    try {
      const res = await api(`/api/projects/${projectId}/members/batch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: Array.from(selectedIds),
          role: bulkRole,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSelectedIds(new Set());
        setBulkRole('');
        fetchMembers();
      }
    } catch (err) {
      console.error('Bulk role update failed:', err);
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !projectId) return;
    if (!window.confirm(`선택한 ${selectedIds.size}명의 멤버를 프로젝트에서 제외하시겠습니까?`)) return;
    setBulkUpdating(true);
    try {
      const res = await api(`/api/projects/${projectId}/members/batch`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: Array.from(selectedIds),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSelectedIds(new Set());
        fetchMembers();
      }
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setBulkUpdating(false);
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  return {
    selectedIds,
    setSelectedIds,
    bulkRole,
    setBulkRole,
    bulkUpdating,
    toggleSelect,
    toggleSelectAll,
    handleBulkRoleChange,
    handleBulkDelete,
    clearSelection,
  };
}
