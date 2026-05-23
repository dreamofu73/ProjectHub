import { Search, Trash2, Shield, Power, ChevronDown, Building2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { DepartmentTreeModal } from './DepartmentTreeModal';
import type { Department } from 'shared/types/organization';

interface UserToolbarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  roleFilter: string;
  setRoleFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  selectedIds: Set<string>;
  handleBatchDelete: () => void;
  handleBatchSetStatus: (isActive: number) => void;
  hasInactiveSelected: boolean;
  handleBatchChangeRole: (role: string) => void;
  handleBatchDepartment: (departmentId: string | null) => void;
  departments: Department[];
  t: (key: string) => string;
}

export function UserToolbar({
  searchTerm,
  setSearchTerm,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  selectedIds,
  handleBatchDelete,
  handleBatchSetStatus,
  hasInactiveSelected,
  handleBatchChangeRole,
  handleBatchDepartment,
  departments,
  t
}: UserToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<'role' | null>(null);
  const [isDeptTreeOpen, setIsDeptTreeOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <div ref={toolbarRef} className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border)] select-none text-xs">
      {/* 좌측 컨트롤 그룹 */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
        >
          <option value="all">{t('allRoles') || '전체 권한'}</option>
          <option value="admin">{t('admin') || '관리자'}</option>
          <option value="overseer">{t('overseer') || '감시자'}</option>
          <option value="user">{t('regularUser') || '일반 사용자'}</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
        >
          <option value="all">{t('allStatuses') || '상태'}</option>
          <option value="active">{t('activeUser') || '활성'}</option>
          <option value="inactive">{t('inactiveUser') || '비활성'}</option>
        </select>

        <div className="relative">
          <input
            type="text"
            placeholder={t('searchUsersPlaceholder') || '사용자 검색...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-2 pr-7 py-1 h-8 w-48 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)]"
          />
          <button
            type="button"
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] border-none bg-transparent cursor-pointer"
          >
            <Search size={12} />
          </button>
        </div>

        <span className="text-[var(--border)] mx-1">|</span>

        {/* 일괄 작업 버튼들 */}
        <div className="relative">
          <button
            onClick={() => setActiveDropdown(activeDropdown === 'role' ? null : 'role')}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] disabled:opacity-45 disabled:hover:bg-transparent rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
          >
            <Shield size={11} />
            권한 변경
            <ChevronDown size={10} className="opacity-60" />
          </button>
          {activeDropdown === 'role' && (
            <div className="absolute left-0 mt-1 w-36 bg-[var(--bg-surface)] border border-[var(--border)] rounded shadow-lg z-30 py-1 divide-y divide-[var(--border)] animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                onClick={() => { handleBatchChangeRole('admin'); setActiveDropdown(null); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium"
              >
                {t('admin') || '관리자'}
              </button>
              <button
                onClick={() => { handleBatchChangeRole('overseer'); setActiveDropdown(null); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium"
              >
                {t('overseer') || '감시자'}
              </button>
              <button
                onClick={() => { handleBatchChangeRole('user'); setActiveDropdown(null); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium"
              >
                {t('regularUser') || '일반 사용자'}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsDeptTreeOpen(true)}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] disabled:opacity-45 disabled:hover:bg-transparent rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
        >
          <Building2 size={11} />
          부서 변경
          <ChevronDown size={10} className="opacity-60" />
        </button>

        <DepartmentTreeModal
          isOpen={isDeptTreeOpen}
          onClose={() => setIsDeptTreeOpen(false)}
          onSelect={handleBatchDepartment}
          departments={departments}
        />

        <button
          onClick={() => handleBatchSetStatus(hasInactiveSelected ? 1 : 0)}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] disabled:opacity-45 disabled:hover:bg-transparent rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
        >
          <Power size={11} />
          {selectedIds.size === 0 ? '상태 변경' : (hasInactiveSelected ? '활성화' : '비활성화')}
        </button>

        <button
          onClick={handleBatchDelete}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-1 px-2.5 py-1.5 border border-[var(--border)] hover:bg-red-50 dark:hover:bg-red-950/20 text-[var(--text-secondary)] hover:text-red-500 disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-[var(--text-secondary)] rounded text-xs font-semibold transition-all cursor-pointer bg-[var(--bg-surface)] h-8"
        >
          <Trash2 size={11} />
          {t('bulkDelete') || '삭제'}
        </button>
      </div>
    </div>
  );
}
