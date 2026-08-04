import { Users, Loader2 } from 'lucide-react';
import type { AddressBookGroup } from 'shared/types/organization';

interface AddressBookGroupListProps {
  groups: AddressBookGroup[];
  loading: boolean;
  selectedGroupId: string | null;
  onSelectGroup: (group: AddressBookGroup) => void;
  t: (key: string) => string;
}

export function AddressBookGroupList({
  groups,
  loading,
  selectedGroupId,
  onSelectGroup,
  t,
}: AddressBookGroupListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
        <Loader2 size={20} className="animate-spin text-[var(--primary)]" />
        <p className="text-xs font-medium">{t('loading')}</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-4 px-6">
        <div className="w-12 h-12 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center border border-[var(--border)]">
          <Users size={20} className="text-[var(--text-muted)] opacity-60" />
        </div>
        <p className="text-xs font-medium text-center">{t('noGroups')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar select-none">
      <div className="py-1">
        {groups.map((group) => {
          const isSelected = selectedGroupId === group.id;
          return (
            <button
              key={group.id}
              onClick={() => onSelectGroup(group)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer border-none ${
                isSelected
                  ? 'bg-[var(--primary)]/10'
                  : 'hover:bg-[var(--bg-surface-2)]/50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                isSelected
                  ? 'bg-[var(--primary)]/10 border-[var(--primary)]/20 text-[var(--primary)]'
                  : 'bg-[var(--bg-surface-2)] border-[var(--border)] text-[var(--text-muted)]'
              }`}>
                <Users size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs truncate ${
                  isSelected ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'
                }`}>
                  {group.name}
                </p>
              </div>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                isSelected
                  ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                  : 'bg-[var(--bg-surface-2)] text-[var(--text-muted)]'
              }`}>
                {group.member_count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
