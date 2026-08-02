import { useEffect, useState } from 'react';
import { api, organizationApi } from 'shared/lib/api';
import type { UserData } from 'shared/types/user';
import type { Department } from 'shared/types/organization';
import { OrganizationMemberPicker } from '../../../components/organization/OrganizationMemberPicker';
import { useFocusTrap } from '../../../hooks/useFocusTrap';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  t: (key: string) => string;
  showToast: (msg: string, type: 'success' | 'error') => void;
  onRoomCreated: (roomId: string) => void;
}

export function CreateRoomModal({
  isOpen,
  onClose,
  currentUser,
  t,
  showToast,
  onRoomCreated,
}: CreateRoomModalProps) {
  const containerRef = useFocusTrap(isOpen);
  
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setRoomName('');
      Promise.all([
        api('/api/users').then(res => res.json()),
        organizationApi.listDepartments()
      ]).then(([usersJson, deptRes]) => {
        if (usersJson.success) {
          const filteredUsers = (usersJson.data || []).filter((u: any) => String(u.id) !== String(currentUser.id));
          setAllUsers(filteredUsers);
        }
        if (deptRes.success) {
          setDepartments(deptRes.data);
        }
      }).catch(err => {
        console.error('Failed to load data for CreateRoomModal', err);
        showToast(t('errOccurred') || '데이터를 불러오는데 실패했습니다.', 'error');
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [isOpen, currentUser.id, showToast, t]);

  if (!isOpen) return null;

  const handleSave = async (finalIds: string[]) => {
    if (!roomName.trim()) {
      showToast(t('chatRoomNamePlaceholder') || '채팅방 이름을 입력하세요', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName, user_id: currentUser.id ? String(currentUser.id) : 1 })
      });
      const json = await res.json();
      if (json.success) {
        for (const userId of finalIds) {
          await api(`/api/chat/rooms/${json.id}/members`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ user_id: userId }) 
          });
        }
        showToast(t('chatRoomCreateSuccess') || '채팅방이 생성되었습니다.', 'success');
        onRoomCreated(json.id.toString());
        onClose();
      } else {
        showToast(t('errOccurred') || '채팅방 생성에 실패했습니다.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('errOccurred') || '채팅방 생성에 실패했습니다.', 'error');
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
            <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <OrganizationMemberPicker
            titleInput={{
              value: roomName,
              onChange: setRoomName,
              placeholder: t('chatRoomNamePlaceholder') || '채팅방 이름을 입력하세요'
            }}
            allUsers={allUsers}
            departments={departments}
            initialMemberIds={[]}
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
