import { useState } from 'react';
import type { UserData } from 'shared/types/user';
import type { Department, AddressBookMember } from 'shared/types/organization';
import { OrganizationMemberPicker } from '../organization/OrganizationMemberPicker';

interface EditMembersModalProps {
  groupName: string;
  allUsers: UserData[];
  departments: Department[];
  existingMembers: AddressBookMember[];
  onSave: (name: string, memberUserIds: string[]) => Promise<void>;
  onClose: () => void;
  t: (key: string) => string;
}

export function EditMembersModal({
  groupName: initialName,
  allUsers,
  departments,
  existingMembers,
  onSave,
  onClose,
  t,
}: EditMembersModalProps) {
  const [groupName, setGroupName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  const initialMemberIds = existingMembers.map(m => m.user_id);

  const handleSave = async (finalIds: string[]) => {
    if (!groupName.trim()) return;
    setSaving(true);
    try {
      await onSave(groupName.trim(), finalIds);
    } finally {
      setSaving(false);
    }
  };

  return (
    <OrganizationMemberPicker
      titleInput={{
        value: groupName,
        onChange: setGroupName,
        placeholder: t('groupNamePlaceholder') || '그룹 이름을 입력하세요'
      }}
      allUsers={allUsers}
      departments={departments}
      initialMemberIds={initialMemberIds}
      onSave={handleSave}
      onClose={onClose}
      saving={saving}
      t={t}
    />
  );
}
