import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Button } from 'ui/Button';
import { api } from 'shared/lib/api';
import { Pagination } from 'ui/Pagination';
import { AddMemberModal } from '../components/project-members/AddMemberModal';
import { useProjectMembers } from 'shared/hooks/useProjectMembers';
import { useMemberBulkActions } from '../components/project-members/useMemberBulkActions';
import { useAddMemberModal } from '../components/project-members/useAddMemberModal';
import { MemberToolbar } from '../components/project-members/MemberToolbar';
import { MemberDetailPanel } from '../components/project-members/MemberDetailPanel';
import { useLanguage } from '../context/LanguageContext';

const ROLE_OPTIONS = [
  { value: 'manager', labelKey: 'managerLabel' },
  { value: 'lead', labelKey: 'leadLabel' },
  { value: 'developer', labelKey: 'developerLabel' },
  { value: 'reporter', labelKey: 'reporterLabel' },
  { value: 'viewer', labelKey: 'viewerLabel' },
  { value: 'overseer', labelKey: 'overseer' },
];

export default function ProjectMembersPage() {
  const { id } = useParams<{ id: string }>();
  const { t, formatDate } = useLanguage();
  const roleOptions = ROLE_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }));

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isSysAdmin = currentUser?.role === 'admin';

  const { members, allUsers, fetchMembers } = useProjectMembers(id);
  const [projectStatus, setProjectStatus] = useState('');
  const [projectRole, setProjectRole] = useState<string | null>(null);
  const isArchived = projectStatus === 'archived';

  useEffect(() => {
    api(`/api/projects/${id}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setProjectStatus(json.data.status);
          setProjectRole(json.data.my_role);
        }
      });
  }, [id]);

  const canManageMembers = !isArchived && (isSysAdmin || projectRole === 'manager');

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter]);

  const {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    handleBulkRoleChange,
    handleBulkDelete,
  } = useMemberBulkActions(id, fetchMembers);

  const {
    showAddModal,
    setShowAddModal,
    addRole,
    setAddRole,
    addError,
    adding,
    closeAddModal,
    handleAddMembers,
  } = useAddMemberModal(id, members, allUsers, fetchMembers);

  const handleRemoveMember = async (userId: string, name: string) => {
    if (!window.confirm(t('confirmRemoveProjectMember').replace('{name}', name))) return;
    try {
      const res = await api(`/api/projects/${id}/members/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMembers();
        if (selectedMember?.user_id === userId) setSelectedMember(null);
      }
    } catch (err) {
      console.error('Remove member failed:', err);
    }
  };

  const filteredMembers = members.filter(m =>
    (roleFilter === 'all' || m.role === roleFilter) &&
    ((m.login || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
     (m.firstname || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
     (m.lastname || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
     (m.email || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const pagedMembers = filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex flex-col w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-300 bg-[var(--bg-surface)] text-[var(--text-primary)] overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">{t('manageMembers')}</h2>
        {canManageMembers && <Button icon={UserPlus} onClick={() => setShowAddModal(true)}>{t('chatGroupAddMembers')}</Button>}
      </div>

      {/* 툴바 */}
      <div className="px-6 py-3 border-b border-[var(--border)] shrink-0">
        <MemberToolbar 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          selectedIds={selectedIds}
          handleBatchDelete={handleBulkDelete}
          handleBatchChangeRole={handleBulkRoleChange}
          canManageMembers={canManageMembers}
          t={t}
        />
      </div>

      {/* 메인 영역 (분할) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 리스트 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-[var(--bg-surface-2)]">
              <tr className="border-b border-[var(--border)]">
                {canManageMembers && (
                  <th className="py-1.5 px-4 w-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer accent-current"
                      checked={selectedIds.size === pagedMembers.length && pagedMembers.length > 0}
                      onChange={() => toggleSelectAll(pagedMembers)}
                    />
                  </th>
                )}
                <th className="py-1.5 px-4 text-xs font-bold text-muted uppercase tracking-wider text-left">{t('member')}</th>
                <th className="py-1.5 px-4 text-xs font-bold text-muted uppercase tracking-wider text-left hidden sm:table-cell">{t('email')}</th>
                <th className="py-1.5 px-4 text-xs font-bold text-muted uppercase tracking-wider text-left">{t('permission')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {pagedMembers.map((member) => (
                <tr
                  key={member.id}
                  onClick={() => setSelectedMember({
                    id: member.user_id,
                    firstname: member.firstname,
                    lastname: member.lastname,
                    login: member.login,
                    email: member.email,
                    role: member.role,
                    created_at: member.created_at
                  })}
                  className={`hover:bg-[var(--bg-surface-2)] transition-colors cursor-pointer ${
                    selectedMember?.id === member.user_id ? 'bg-[var(--primary-bg)]' : ''
                  } ${selectedIds.has(member.user_id) ? 'bg-[var(--primary-bg)]/50' : ''}`}
                >
                  {canManageMembers && (
                    <td className="py-1.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-primary cursor-pointer accent-current"
                        checked={selectedIds.has(member.user_id)}
                        onChange={() => toggleSelect(member.user_id)}
                      />
                    </td>
                  )}
                  <td className="py-1.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-bg text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {member.firstname?.[0] || member.login[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate text-xs">{member.firstname} {member.lastname}</div>
                        <div className="text-xs text-muted truncate">@{member.login}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-1.5 px-4 hidden sm:table-cell text-xs text-secondary">{member.email}</td>
                  <td className="py-1.5 px-4 text-xs font-semibold">{member.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMembers.length > 0 && (
            <div className="border-t border-[var(--border)] relative shrink-0">
              <Pagination
                currentPage={currentPage}
                totalCount={filteredMembers.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                pageSizeOptions={[10, 20, 30, 50, 100]}
                blockSize={5}
              />
            </div>
          )}
        </div>
        {/* 상세 패널 */}
        <div className="w-1/3 border-l border-[var(--border)]">
          <MemberDetailPanel 
            member={selectedMember}
            isArchived={isArchived}
            canManageMembers={canManageMembers}
            onDelete={(id) => handleRemoveMember(id, `${selectedMember?.firstname} ${selectedMember?.lastname}`)}
            formatDate={formatDate}
            t={t}
          />
        </div>
      </div>

      {/* Add Member Modal */}
      <AddMemberModal
        show={showAddModal}
        onClose={closeAddModal}
        allUsers={allUsers}
        initialMemberIds={members.map(m => m.user_id)}
        addRole={addRole}
        setAddRole={(role) => setAddRole(role as 'manager' | 'developer' | 'reporter' | 'viewer' | 'lead' | 'overseer')}
        ROLE_OPTIONS={roleOptions}
        handleAddMembers={handleAddMembers}
        adding={adding}
        addError={addError}
      />
    </div>
  );
}
