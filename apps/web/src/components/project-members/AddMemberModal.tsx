import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus } from 'lucide-react';
import { Select } from 'ui/Input';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { OrganizationMemberPicker } from '../organization/OrganizationMemberPicker';
import { organizationApi } from 'shared/lib/api';
import type { Department } from 'shared/types/organization';
import type { UserData } from 'shared/types/user';

interface AddMemberModalProps {
  show: boolean;
  onClose: () => void;
  allUsers: UserData[];
  initialMemberIds: string[];
  addRole: string;
  setAddRole: (role: string) => void;
  ROLE_OPTIONS: { value: string; label: string }[];
  handleAddMembers: (addedIds: string[]) => void;
  adding: boolean;
  addError: string;
}

export function AddMemberModal({
  show,
  onClose,
  allUsers,
  initialMemberIds,
  addRole,
  setAddRole,
  ROLE_OPTIONS,
  handleAddMembers,
  adding,
  addError,
}: AddMemberModalProps) {
  const containerRef = useFocusTrap(show);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    if (show) {
      organizationApi.listDepartments().then(res => {
        if (res.success) setDepartments(res.data);
      }).catch(() => {});
    }
  }, [show]);

  if (!show) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-title"
    >
      <div className="bg-[var(--bg-app)] w-[75vw] h-[75vh] min-w-[320px] md:min-w-[600px] min-h-[400px] max-w-[95vw] max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col relative">
        {addError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-danger-bg text-danger text-sm p-3 rounded-lg border border-danger/20 shadow-lg">
            {addError}
          </div>
        )}
        <OrganizationMemberPicker
          title={
            <span id="add-member-title" className="flex items-center gap-2">
              <UserPlus size={18} className="text-primary" />
              새 멤버 초대
            </span>
          }
          allUsers={allUsers}
          departments={departments}
          initialMemberIds={initialMemberIds}
          onSave={async (finalIds, addedIds, removedIds) => {
            await handleAddMembers(addedIds);
          }}
          onClose={onClose}
          saving={adding}
          t={(key) => {
            const translations: Record<string, string> = {
              save: '초대하기',
              processing: '초대 중...',
            };
            return translations[key] || '';
          }}
          footerLeft={
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--text-primary)]">프로젝트 권한:</span>
              <div className="w-48">
                <Select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  options={ROLE_OPTIONS}
                />
              </div>
            </div>
          }
        />
      </div>
    </div>,
    document.body
  );
}
