import { Search, Trash2, Shield, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface MemberToolbarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  roleFilter: string;
  setRoleFilter: (val: string) => void;
  selectedIds: Set<string>;
  handleBatchDelete: () => void;
  handleBatchChangeRole: (role: string) => void;
  t: (key: string) => string;
}

export function MemberToolbar({
  searchTerm,
  setSearchTerm,
  roleFilter,
  setRoleFilter,
  selectedIds,
  handleBatchDelete,
  handleBatchChangeRole,
  t
}: MemberToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<'role' | null>(null);

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
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-8 px-2 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)] cursor-pointer font-medium"
        >
          <option value="all">{t('allRoles') || '전체 권한'}</option>
          <option value="manager">매니저</option>
          <option value="developer">개발자</option>
          <option value="viewer">뷰어</option>
        </select>

        <div className="relative">
          <input
            type="text"
            placeholder={t('searchMembersPlaceholder') || '멤버 검색...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-2 pr-7 py-1 h-8 w-48 border border-[var(--border)] rounded bg-[var(--bg-surface)] text-xs focus:outline-none text-[var(--text-primary)]"
          />
          <Search size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        </div>

        <span className="text-[var(--border)] mx-1">|</span>

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
            <div className="absolute left-0 mt-1 w-36 bg-[var(--bg-surface)] border border-[var(--border)] rounded shadow-lg z-30 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {['manager', 'developer', 'viewer'].map(role => (
                <button
                  key={role}
                  onClick={() => { handleBatchChangeRole(role); setActiveDropdown(null); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-surface-2)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer border-none bg-transparent font-medium"
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </div>

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
