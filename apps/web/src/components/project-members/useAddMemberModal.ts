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
  const [addRole, setAddRole] = useState<'manager' | 'developer' | 'reporter' | 'viewer' | 'lead' | 'overseer'>('developer');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddError('');
  };

  const handleAddMembers = async (addedIds: string[]) => {
    if (addedIds.length === 0 || !projectId) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await api(`/api/projects/${projectId}/members/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: addedIds,
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
    addRole,
    setAddRole,
    addError,
    adding,
    closeAddModal,
    handleAddMembers,
  };
}
