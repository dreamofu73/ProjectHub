import { useState } from 'react';
import { api } from 'shared/lib/api';
import type { Member, UserData } from 'shared/hooks/useProjectMembers';

export function useAddMemberModal(
  projectId: string | undefined,
  members: Member[],
  allUsers: UserData[],
  fetchMembers: () => void
) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUserSearch, setAddUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [addRole, setAddRole] = useState<'manager' | 'developer' | 'reporter' | 'viewer' | 'lead' | 'overseer'>('developer');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const toggleInSet = (prev: Set<string>, item: string): Set<string> => {
    const next = new Set(prev);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    return next;
  };

  const matchesSearch = (fields: string[], term: string) =>
    fields.some(f => f.toLowerCase().includes(term.toLowerCase()));

  const availableUsers = allUsers.filter(u => !members.some(m => m.user_id === u.id));
  const filteredAvailable = availableUsers.filter(u =>
    matchesSearch([u.login, u.firstname, u.lastname, u.email], addUserSearch)
  );

  const toggleUserSelection = (uid: string) => setSelectedUserIds(prev => toggleInSet(prev, uid));

  const toggleAllAvailable = () => {
    if (selectedUserIds.size === filteredAvailable.length && filteredAvailable.length > 0) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredAvailable.map(u => u.id)));
    }
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddUserSearch('');
    setSelectedUserIds(new Set());
    setAddError('');
  };

  const handleAddMembers = async () => {
    if (selectedUserIds.size === 0 || !projectId) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await api(`/api/projects/${projectId}/members/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: Array.from(selectedUserIds),
          role: addRole,
        }),
      });
      const json = await res.json();
      if (json.success) {
        closeAddModal();
        fetchMembers();
      } else {
        setAddError(json.error || '멤버 추가에 실패했습니다.');
      }
    } catch (err) {
      setAddError('서버 통신 오류가 발생했습니다.');
    } finally {
      setAdding(false);
    }
  };

  return {
    showAddModal,
    setShowAddModal,
    addUserSearch,
    setAddUserSearch,
    selectedUserIds,
    addRole,
    setAddRole,
    addError,
    adding,
    filteredAvailable,
    toggleUserSelection,
    toggleAllAvailable,
    closeAddModal,
    handleAddMembers,
  };
}
