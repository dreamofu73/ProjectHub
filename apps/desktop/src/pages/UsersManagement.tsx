import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { useUsersManagement } from '../hooks/useUsersManagement';
import { api } from 'shared/lib/api';
import { UserList } from '../components/users/UserList';
import { UserDetail } from '../components/users/UserDetail';
import { UserToolbar } from '../components/users/UserToolbar';
import { UserModal } from '../components/users/UserModal';
import { PasswordResetModal } from '../components/users/PasswordResetModal';
import { Pagination } from 'ui/Pagination';
import type { UserData } from 'shared/types/user';

export default function UsersManagementPage() {
  const {
    loading,
    searchTerm,
    setSearchTerm,
    showModal,
    currentUser,
    setCurrentUser,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    error,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    fetchUsers,
    handleCreate,
    handleBatchChangeDepartment,
    handleUpdate,
    handleResetPassword,
    handleDelete,
    openCreateModal,
    openEditModal,
    openPasswordModal,
    closeModal,
    totalCount,
    pagedUsers,
    formatDate,
    t,
    departments,
    organizationName,
  } = useUsersManagement();

  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (filteredUsers.length > 0 && filteredUsers.every(u => selectedIds.has(u.id))) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      filteredUsers.forEach(u => next.add(u.id));
      setSelectedIds(next);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(t('confirmBulkDelete').replace('{count}', String(selectedIds.size)))) return;

    let successCount = 0;
    for (const id of selectedIds) {
      if (id === '1') continue; // Skip admin
      try {
        const res = await api(`/api/users/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (res.ok) successCount++;
      } catch (e) {
        console.error(e);
      }
    }

    if (successCount > 0) {
      setSelectedIds(new Set());
      fetchUsers();
    }
  };

  const handleBatchSetStatus = async (isActive: number) => {
    if (selectedIds.size === 0) return;
    const actionName = isActive === 1 ? t('activate') : t('deactivate');
    const confirmMsg = (t('confirmUserStatusChange'))
      .replace('{count}', String(selectedIds.size))
      .replace('{action}', actionName);
    if (!window.confirm(confirmMsg)) return;

    let successCount = 0;
    for (const id of selectedIds) {
      if (id === '1') continue; // Skip admin
      try {
        const res = await api(`/api/users/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ is_active: isActive })
        });
        if (res.ok) successCount++;
      } catch (e) {
        console.error(e);
      }
    }

    if (successCount > 0) {
      setSelectedIds(new Set());
      fetchUsers();
    }
  };

  const selectedUsersList = pagedUsers.filter(u => selectedIds.has(u.id));
  const hasInactiveSelected = selectedUsersList.some(u => u.is_active === 0);

  const handleBatchChangeRole = async (role: string) => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(t('confirmBulkRoleChange').replace('{count}', String(selectedIds.size)))) return;

    let successCount = 0;
    for (const id of selectedIds) {
      if (id === '1') continue; // Skip admin
      try {
        const res = await api(`/api/users/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ role })
        });
        if (res.ok) successCount++;
      } catch (e) {
        console.error(e);
      }
    }

    if (successCount > 0) {
      setSelectedIds(new Set());
      fetchUsers();
    }
  };

  const handleBatchDepartment = async (departmentId: string | null) => {
    if (selectedIds.size === 0) return;
    const deptName = departmentId
      ? departments.find(d => d.id === departmentId)?.name || `ID:${departmentId}`
      : t('noDept');
    const confirmMsg = t('confirmUserDeptChange')
      .replace('{count}', String(selectedIds.size))
      .replace('{dept}', deptName);
    if (!window.confirm(confirmMsg)) return;

    const updated = await handleBatchChangeDepartment([...selectedIds], departmentId);
    if (updated > 0) {
      setSelectedIds(new Set());
      fetchUsers();
    }
  };

  // Filter users locally based on role and status (since useUsersManagement only searches by term)
  const filteredUsers = pagedUsers.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter === 'active' && u.is_active !== 1) return false;
    if (statusFilter === 'inactive' && u.is_active !== 0) return false;
    return true;
  });

  // Auto-select first user
  useEffect(() => {
    if (!loading && filteredUsers.length > 0 && !selectedUser) {
      setSelectedUser(filteredUsers[0]);
    }
  }, [loading, filteredUsers, selectedUser]);

  // ESC 키로 상세보기 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (showModal) return;
      if (selectedUser) {
        e.preventDefault();
        setSelectedUser(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUser, showModal]);

  // Prevent body scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Split layout resizer
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem('users_leftWidth');
    return saved ? Number(saved) : 55;
  });

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = 'none';

    const container = document.getElementById('users-split-container');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startWidth = leftWidth;

    const doResize = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerRect.width) * 100;
      const newWidth = Math.min(Math.max(startWidth + deltaPercent, 20), 80);
      setLeftWidth(newWidth);
      localStorage.setItem('users_leftWidth', String(newWidth));
    };

    const stopResize = () => {
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
    };

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
  }, [leftWidth]);

  return (
    <div className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">

      {/* 상단 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-surface)] border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Users size={16} className="text-[var(--primary)]" />
            <span>{t('users')}</span>
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="h-8.5 px-3.5 bg-[var(--primary)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98] border-none"
          >
            <UserPlus size={13} />
            {t('addUser')}
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex flex-col flex-1 overflow-hidden p-5 gap-4">
        <UserToolbar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          selectedIds={selectedIds}
          handleBatchDelete={handleBatchDelete}
          handleBatchSetStatus={handleBatchSetStatus}
          hasInactiveSelected={hasInactiveSelected}
          handleBatchChangeRole={handleBatchChangeRole}
          handleBatchDepartment={handleBatchDepartment}
          departments={departments}
          t={t}
        />

        {/* 목록 + 상세 분할 영역 */}
        <div id="users-split-container" className="flex-1 overflow-hidden flex min-h-0 flex-row">

          {/* 목록 영역 */}
          <div className="flex flex-col overflow-hidden border-[var(--border)] min-w-[280px] min-h-[150px]" style={{ width: `${leftWidth}%` }}>
            <UserList
              users={filteredUsers}
              loading={loading}
              selectedUserId={selectedUser?.id || null}
              onSelectUser={setSelectedUser}
              selectedIds={selectedIds}
              toggleSelectRow={toggleSelectRow}
              toggleSelectAll={toggleSelectAll}
              t={t}
            />

            {/* 페이지네이션 */}
            {!loading && totalCount > 0 && (
              <div className="border-t border-[var(--border)] relative shrink-0">
                <Pagination
                  currentPage={currentPage}
                  totalCount={totalCount}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                  pageSizeOptions={[10, 20, 30, 50, 100]}
                  blockSize={5}
                />
              </div>
            )}
          </div>

          {/* 리사이저 */}
          <div
            className="bg-[var(--border)] w-px h-full mx-0.5 shrink-0 relative cursor-col-resize group"
            onMouseDown={startResize}
          >
            <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-[var(--primary)]/20 transition-colors" />
          </div>

          {/* 우측 상세 패널 */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[var(--bg-surface)]">
            <UserDetail
              user={selectedUser}
              onEdit={openEditModal}
              onResetPassword={openPasswordModal}
              onDelete={(id) => {
                handleDelete(id);
                if (selectedUser?.id === id) setSelectedUser(null);
              }}
              formatDate={formatDate}
              t={t}
            />
          </div>
        </div>
      </div>

      {/* User Create/Edit Modal */}
      {(showModal === 'create' || showModal === 'edit') && (
        <UserModal
          showModal={showModal}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          password={password}
          setPassword={setPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          error={error}
          onClose={closeModal}
          onSubmit={showModal === 'create' ? handleCreate : handleUpdate}
          t={t}
          departments={departments}
          organizationName={organizationName}
        />
      )}

      {/* Password Reset Modal */}
      {showModal === 'password' && (
        <PasswordResetModal
          currentUser={currentUser}
          password={password}
          setPassword={setPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          error={error}
          onClose={closeModal}
          onSubmit={handleResetPassword}
          t={t}
        />
      )}
    </div>
  );
}
