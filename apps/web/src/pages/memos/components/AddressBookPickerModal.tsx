import { useState, useEffect, useMemo } from 'react';
import {
  X, Search, CheckSquare, Square, Users, User as UserIcon, Loader2,
} from 'lucide-react';
import { addressBookApi } from 'shared/lib/api';
import { Button } from 'ui/Button';
import type { AddressBookGroup, AddressBookMember } from 'shared/types/organization';
import type { } from 'shared/types';

interface AddressBookPickerProps {
  existingRecipientIds: Set<string>;
  onSelect: (users: any[]) => void;
  onClose: () => void;
  t: (key: string) => string;
}

export function AddressBookPicker({
  existingRecipientIds,
  onSelect,
  onClose,
  t,
}: AddressBookPickerProps) {
  // Groups
  const [groups, setGroups] = useState<AddressBookGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AddressBookGroup | null>(null);

  // Members
  const [members, setMembers] = useState<AddressBookMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Selection
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Search/filter for members
  const [searchText, setSearchText] = useState('');

  // Fetch groups on mount
  useEffect(() => {
    setGroupsLoading(true);
    addressBookApi.listGroups()
      .then(res => {
        if (res.success) {
          setGroups(res.data);
          if (res.data.length > 0) {
            setSelectedGroup(res.data[0]);
          }
        }
      })
      .catch(err => console.error('Failed to fetch groups:', err))
      .finally(() => setGroupsLoading(false));
  }, []);

  // Fetch members when group changes
  useEffect(() => {
    if (!selectedGroup) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    addressBookApi.listMembers(selectedGroup.id)
      .then(res => {
        if (res.success) setMembers(res.data);
      })
      .catch(err => console.error('Failed to fetch members:', err))
      .finally(() => setMembersLoading(false));
  }, [selectedGroup]);

  // Filter members
  const filteredMembers = useMemo(() => {
    const query = searchText.toLowerCase().trim();
    return members.filter(m => {
      if (query) {
        const fullName = `${m.lastname}${m.firstname}`.toLowerCase();
        return (
          fullName.includes(query) ||
          m.login.toLowerCase().includes(query) ||
          m.email.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [members, searchText]);

  const toggleMember = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    const selectableIds = filteredMembers
      .filter(m => !existingRecipientIds.has(m.user_id))
      .map(m => m.user_id);
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      selectableIds.forEach(id => next.add(id));
      return next;
    });
  };

  const deselectAll = () => {
    setSelectedUserIds(new Set());
  };

  const handleConfirm = () => {
    if (selectedUserIds.size === 0) return;
    const selectedMembers = members.filter(m => selectedUserIds.has(m.user_id));
    const users: any[] = selectedMembers.map(m => ({
      id: m.user_id,
      login: m.login,
      email: m.email,
      firstname: m.firstname,
      lastname: m.lastname,
      role: 'user' as const,
      groupName: selectedGroup?.name,
    }));
    onSelect(users);
    setSelectedUserIds(new Set());
  };

  return (
    <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-surface)] shadow-xl flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-surface-2)]/50 shrink-0">
        <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
          <Users size={13} className="text-[var(--primary)]" />
          {t('addressBook')}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-2)] transition-colors cursor-pointer border-none bg-transparent"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Body: Groups (left) + Members (right) ── */}
      <div className="flex min-h-0" style={{ height: '380px', maxHeight: '50vh' }}>
        {/* Left: Groups */}
        <div className="w-[170px] shrink-0 border-r border-[var(--border)] flex flex-col overflow-hidden bg-[var(--bg-surface-2)]/20">
          <div className="px-3 py-2 border-b border-[var(--border)] shrink-0">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {t('myGroups')}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {groupsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={14} className="animate-spin text-[var(--primary)]" />
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)] gap-1.5 px-3">
                <Users size={16} className="opacity-60" />
                <span className="text-xs font-medium text-center">
                  {t('noGroups')}
                </span>
              </div>
            ) : (
              groups.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGroup(g)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer border-none bg-transparent ${
                    selectedGroup?.id === g.id
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'hover:bg-[var(--bg-surface-2)]/50 text-[var(--text-secondary)]'
                  }`}
                >
                  <span className="text-xs font-semibold truncate">{g.name}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-1.5 ${
                    selectedGroup?.id === g.id
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'bg-[var(--bg-surface-2)] text-[var(--text-muted)]'
                  }`}>
                    {g.member_count}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Members */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Search bar */}
          <div className="px-3 py-2 border-b border-[var(--border)] shrink-0 space-y-1.5">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder={t('searchMembers')}
                className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-2)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--primary)] transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllFiltered}
                disabled={filteredMembers.filter(m => !existingRecipientIds.has(m.user_id)).length === 0}
                className="text-xs text-[var(--primary)] hover:text-[var(--primary)]/80 font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-none bg-transparent transition-colors"
              >
                {t('selectAll')}
              </button>
              <span className="text-xs text-[var(--text-muted)]">·</span>
              <button
                type="button"
                onClick={deselectAll}
                disabled={selectedUserIds.size === 0}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-none bg-transparent transition-colors"
              >
                {t('deselectAll')}
              </button>
              {selectedUserIds.size > 0 && (
                <span className="text-xs text-[var(--primary)] font-bold ml-auto">
                  {t('selectedCount').replace('{count}', String(selectedUserIds.size))}
                </span>
              )}
            </div>
          </div>

          {/* Member list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {membersLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={14} className="animate-spin text-[var(--primary)]" />
              </div>
            ) : !selectedGroup ? (
              <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)] gap-2">
                <Users size={16} className="opacity-60" />
                <span className="text-xs font-medium">
                  {t('selectGroup')}
                </span>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)] gap-2">
                <UserIcon size={16} className="opacity-60" />
                <span className="text-xs font-medium">
                  {t('noMembers')}
                </span>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {filteredMembers.map(member => {
                  const isExisting = existingRecipientIds.has(member.user_id);
                  const isSelected = selectedUserIds.has(member.user_id);

                  return (
                    <div
                      key={member.id}
                      onClick={() => { if (!isExisting) toggleMember(member.user_id); }}
                      className={`flex items-center gap-2.5 px-3 py-2 transition-colors ${
                        isExisting
                          ? 'opacity-40 cursor-not-allowed bg-[var(--bg-surface-2)]/20'
                          : 'hover:bg-[var(--bg-surface-2)]/50 cursor-pointer'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="shrink-0">
                        {isExisting ? (
                          <span className="text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 rounded">
                            {t('alreadyAdded')}
                          </span>
                        ) : isSelected ? (
                          <CheckSquare size={14} className="text-[var(--primary)]" />
                        ) : (
                          <Square size={14} className="text-[var(--text-muted)] opacity-50" />
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="w-6 h-6 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] border border-[var(--border)] shrink-0">
                        {member.login.slice(0, 2).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-secondary)] truncate">
                          {member.lastname}{member.firstname}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {member.login} · {member.email}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected count + confirm */}
          <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--bg-surface-2)]/30 shrink-0 flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              {selectedUserIds.size > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {members
                    .filter(m => selectedUserIds.has(m.user_id))
                    .map(m => (
                      <span
                        key={m.user_id}
                        className="inline-flex items-center gap-1 bg-[var(--primary)]/10 text-[var(--primary)] px-1.5 py-0.5 rounded text-xs font-bold"
                      >
                        {m.lastname}{m.firstname}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleMember(m.user_id); }}
                          className="hover:bg-[var(--primary)]/15 rounded p-0.5 border-none bg-transparent cursor-pointer flex items-center"
                        >
                          <X size={8} />
                        </button>
                      </span>
                    ))}
                </div>
              ) : (
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  {t('selectMembersToAdd')}
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={Users}
              onClick={handleConfirm}
              disabled={selectedUserIds.size === 0}
              className="!text-xs !px-2.5 !py-1 !h-7 shrink-0"
            >
              {t('addSelectedRecipients')}
              {selectedUserIds.size > 0 ? ` (${selectedUserIds.size})` : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
