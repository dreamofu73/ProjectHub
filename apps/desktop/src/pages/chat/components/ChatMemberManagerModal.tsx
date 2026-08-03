import { useEffect, useState } from 'react';
import { api, organizationApi } from 'shared/lib/api';
import type { UserData } from 'shared/types/user';
import type { Department } from 'shared/types/organization';
import { OrganizationMemberPicker } from '../../../components/organization/OrganizationMemberPicker';
import { Users } from 'lucide-react';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

interface ChatMemberManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoomId?: string;
  currentUser: any;
  t: (key: string) => string;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function ChatMemberManagerModal({
  isOpen,
  onClose,
  activeRoomId,
  currentUser,
  t,
  showToast,
}: ChatMemberManagerModalProps) {
  const containerRef = useFocusTrap(isOpen);
  
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [initialMemberIds, setInitialMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && activeRoomId) {
      setLoading(true);
      Promise.all([
        api('/api/users').then(res => res.json()),
        api(`/api/chat/rooms/${activeRoomId}/members`).then(res => res.json()),
        organizationApi.listDepartments()
      ]).then(([usersJson, membersJson, deptRes]) => {
        if (usersJson.success) {
          const filteredUsers = (usersJson.data || []).filter((u: any) => String(u.id) !== String(currentUser.id));
          setAllUsers(filteredUsers);
        }
        if (membersJson.success) {
          setInitialMemberIds((membersJson.data || []).map((m: any) => String(m.user_id)));
        }
        if (deptRes.success) {
          setDepartments(deptRes.data);
        }
      }).catch(err => {
        console.error('Failed to load data for ChatMemberManagerModal', err);
        showToast(t('errOccurred') || '데이터를 불러오는데 실패했습니다.', 'error');
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [isOpen, activeRoomId, currentUser.id, showToast, t]);

  if (!isOpen) return null;

  const handleSave = async (_finalIds: string[], addedIds: string[], removedIds: string[]) => {
    if (!activeRoomId) return;
    setSaving(true);
    let errorCount = 0;
    try {
      // Add new members
      for (const userId of addedIds) {
        const addRes = await api(`/api/chat/rooms/${activeRoomId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });
        if (!addRes.ok) errorCount++;
      }
      // Remove members
      for (const userId of removedIds) {
        const removeRes = await api(`/api/chat/rooms/${activeRoomId}/members/${userId}`, {
          method: 'DELETE',
        });
        if (!removeRes.ok) errorCount++;
      }
      
      if (errorCount === 0) {
        showToast(t('saved') || '저장되었습니다.', 'success');
        onClose();
      } else {
        showToast(t('saveFailed') || '일부 멤버 관리에 실패했습니다.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('saveFailed') || '저장에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[var(--bg-app)] w-[75vw] h-[75vh] min-w-[320px] md:min-w-[600px] min-h-[400px] max-w-[95vw] max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col relative">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <OrganizationMemberPicker
            title={
              <span className="flex items-center gap-2">
                <Users size={18} className="text-primary" />
                {t('chatRoomMembers') || '채팅 멤버 관리'}
              </span>
            }
            allUsers={allUsers}
            departments={departments}
            initialMemberIds={initialMemberIds}
            onSave={handleSave}
            onClose={onClose}
            saving={saving}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
