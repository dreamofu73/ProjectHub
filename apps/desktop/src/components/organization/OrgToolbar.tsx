import { Search, Plus } from 'lucide-react';

interface OrgToolbarProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  openCreateModal: () => void;
  t: (key: string) => string;
}

export function OrgToolbar({
  searchTerm,
  setSearchTerm,
  openCreateModal,
  t,
}: OrgToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border)] select-none text-xs">
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <div className="relative">
          <input
            type="text"
            placeholder={t('searchDeptPlaceholder') || '부서 검색...'}
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
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={openCreateModal}
          className="h-8 px-3.5 bg-[var(--primary)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98] border-none"
        >
          <Plus size={13} />
          {t('addDepartment') || '부서 추가'}
        </button>
      </div>
    </div>
  );
}
