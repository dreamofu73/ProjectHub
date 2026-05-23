import { useState, useMemo } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { Button } from 'ui/Button';
import { Users, Shield, Search, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { Group } from 'shared/types';

interface GroupsTableProps {
  groups: Group[];
  loading: boolean;
  onSelectGroup: (group: Group) => void;
  onDeleteGroup: (id: string) => void;
  selectedGroupId: string | null;
}

type SortKey = 'name' | 'member_count' | 'created_at' | 'owner_name';
type SortDir = 'asc' | 'desc';

export function GroupsTable({ groups, loading, onSelectGroup, onDeleteGroup, selectedGroupId }: GroupsTableProps) {
  const { t, formatDateTime } = useLanguage();
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let items = [...groups];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(g => g.name.toLowerCase().includes(q) || (g.owner_name || '').toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'member_count') cmp = a.member_count - b.member_count;
      else if (sortKey === 'created_at') cmp = a.created_at.localeCompare(b.created_at);
      else if (sortKey === 'owner_name') cmp = (a.owner_name || '').localeCompare(b.owner_name || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [groups, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const thClass = "text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-3 py-3 text-left cursor-pointer hover:text-[var(--text-primary)] select-none";
  const tdClass = "px-3 py-3 text-xs text-[var(--text-primary)]";

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('groupSearchPlaceholder')}
            className="w-full h-8 pl-9 pr-3 text-xs rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/50 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[var(--bg-surface)] z-10">
            <tr className="border-b border-[var(--border)]">
              <th className={thClass} onClick={() => toggleSort('name')}>
                <span className="flex items-center gap-1">{t('title') || 'Name'} <SortIcon k="name" /></span>
              </th>
              <th className={thClass} onClick={() => toggleSort('owner_name')}>
                <span className="flex items-center gap-1">{t('groupOwner')} <SortIcon k="owner_name" /></span>
              </th>
              <th className={thClass} onClick={() => toggleSort('member_count')}>
                <span className="flex items-center gap-1">{t('groupMembers')} <SortIcon k="member_count" /></span>
              </th>
              <th className={thClass}>
                <span className="flex items-center gap-1">{t('visibility') || 'Shared'}</span>
              </th>
              <th className={thClass} onClick={() => toggleSort('created_at')}>
                <span className="flex items-center gap-1">{t('created_at')} <SortIcon k="created_at" /></span>
              </th>
              <th className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-3 py-3 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <div className="inline-block w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Users size={24} className="text-[var(--text-muted)]" />
                    <p className="text-xs text-[var(--text-muted)]">{t('groupNoGroups')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map(g => (
                <tr
                  key={g.id}
                  onClick={() => onSelectGroup(g)}
                  className={`cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]/50 ${
                    selectedGroupId === g.id ? 'bg-[var(--bg-surface-2)]' : ''
                  }`}
                >
                  <td className={tdClass}>
                    <div className="flex items-center gap-2">
                      {g.is_shared
                        ? <Shield size={12} className="text-violet-500 shrink-0" />
                        : <Users size={12} className="text-[var(--text-muted)] shrink-0" />
                      }
                      <span className="font-semibold">{g.name}</span>
                    </div>
                  </td>
                  <td className={tdClass}>{g.owner_name || '-'}</td>
                  <td className={tdClass}>{g.member_count}</td>
                  <td className={tdClass}>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      g.is_shared ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {g.is_shared ? 'Shared' : 'Personal'}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <span className="text-xs text-[var(--text-muted)]">{formatDateTime(g.created_at)}</span>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                      onClick={(e) => { e.stopPropagation(); onDeleteGroup(g.id); }}
                    >
                      {t('groupForceDelete')}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
