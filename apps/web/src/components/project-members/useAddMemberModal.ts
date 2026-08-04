import { useState } from 'react';
import { api } from 'shared/lib/api';
import type { Member, UserData } from 'shared/hooks/useProjectMembers';

import { useLanguage } from 'shared/hooks/LanguageContext';
export function useAddMemberModal(
  projectId: string | undefined,
  _members: Member[],
  _allUsers: UserData[],
  fetchMembers: () => void
) {
  const { t } = useLanguage();
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
        setAddError(json.error || t('memberAddFailed'));
      }
    } catch (err) {
      setAddError(t('serverCommError'));
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
