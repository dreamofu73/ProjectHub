import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  X, Search, FolderTree, FolderOpen, Users, ChevronRight, ChevronDown,
  CheckSquare, Square, Plus, Trash2, Save,
} from 'lucide-react';
import { Button } from 'ui/Button';
import type { UserData } from 'shared/types/user';
import type { Department, AddressBookMember } from 'shared/types/organization';

const PAGE_SIZE = 8;

interface EditMembersModalProps {
  groupName: string;
  allUsers: UserData[];
  departments: Department[];
  existingMembers: AddressBookMember[];
  onSave: (name: string, memberUserIds: string[]) => Promise<void>;
  onClose: () => void;
  t: (key: string) => string;
}

export function EditMembersModal({
  groupName: initialName,
  allUsers,
  departments,
  existingMembers,
  onSave,
  onClose,
  t,
}: EditMembersModalProps) {
  const [groupName, setGroupName] = useState(initialName);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [expandedDeptIds, setExpandedDeptIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [memberUserIds, setMemberUserIds] = useState<Set<string>>(() =>
    new Set(existingMembers.map(m => m.user_id))
  );
  const [selectedAvailable, setSelectedAvailable] = useState<Set<string>>(new Set());
  const [selectedMember, setSelectedMember] = useState<Set<string>>(new Set());
  const [availPage, setAvailPage] = useState(0);
  const [memberPage, setMemberPage] = useState(0);
  const [saving, setSaving] = useState(false);

  // Reset pages when filters change
  useEffect(() => { setAvailPage(0); }, [selectedDept, searchText, memberUserIds]);

  // ─── Tree data ──────────────────────────────────────────────────
  // Build children map from departments (parent_id → children)
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, Department[]>();
    for (const dept of departments) {
      const parentId = dept.parent_id;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(dept);
    }
    return map;
  }, [departments]);

  // Build visible tree nodes with depth
  const visibleTree = useMemo(() => {
    interface TreeNode { dept: Department; depth: number; hasChildren: boolean; }
    const roots = childrenMap.get(null) || [];
    const build = (parents: Department[], depth: number): TreeNode[] => {
      const result: TreeNode[] = [];
      for (const dept of parents) {
        const children = childrenMap.get(dept.id) || [];
        result.push({ dept, depth, hasChildren: children.length > 0 });
        if (expandedDeptIds.has(dept.id)) {
          result.push(...build(children, depth + 1));
        }
      }
      return result;
    };
    return build(roots, 0);
  }, [departments, childrenMap, expandedDeptIds]);

  // Count available (non-member) users per department
  const deptAvailableCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of allUsers) {
      if (u.department_id != null && !memberUserIds.has(u.id)) {
        const deptId = String(u.department_id);
        counts.set(deptId, (counts.get(deptId) || 0) + 1);
      }
    }
    return counts;
  }, [allUsers, memberUserIds]);

  const toggleExpandDept = useCallback((id: string) => {
    setExpandedDeptIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Available users: not in memberUserIds, filtered by dept + search
  const availableUsers = useMemo(() => {
    const query = searchText.toLowerCase().trim();
    return allUsers.filter(u => {
      if (memberUserIds.has(u.id)) return false;
      if (selectedDept != null && String(u.department_id) !== selectedDept) return false;
      if (query) {
        const fullName = `${u.lastname}${u.firstname}`.toLowerCase();
        return fullName.includes(query) || u.login.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
      }
      return true;
    });
  }, [allUsers, memberUserIds, selectedDept, searchText]);

  // Member list as UserData[]
  const memberUsers = useMemo(() => {
    const memberSet = new Set(memberUserIds);
    return allUsers.filter(u => memberSet.has(u.id));
  }, [allUsers, memberUserIds]);

  // Pagination
  const availTotalPages = Math.ceil(availableUsers.length / PAGE_SIZE);
  const memberTotalPages = Math.ceil(memberUsers.length / PAGE_SIZE);
  const pagedAvailable = availableUsers.slice(availPage * PAGE_SIZE, (availPage + 1) * PAGE_SIZE);
  const pagedMembers = memberUsers.slice(memberPage * PAGE_SIZE, (memberPage + 1) * PAGE_SIZE);

  // Toggle selection for available users
  const toggleAvailable = (id: string) => {
    setSelectedAvailable(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllAvailable = () => {
    if (pagedAvailable.every(u => selectedAvailable.has(u.id))) {
      setSelectedAvailable(prev => {
        const next = new Set(prev);
        pagedAvailable.forEach(u => next.delete(u.id));
        return next;
      });
    } else {
      setSelectedAvailable(prev => {
        const next = new Set(prev);
        pagedAvailable.forEach(u => next.add(u.id));
        return next;
      });
    }
  };

  // Toggle selection for member users
  const toggleMember = (id: string) => {
    setSelectedMember(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllMembers = () => {
    if (pagedMembers.every(u => selectedMember.has(u.id))) {
      setSelectedMember(prev => {
        const next = new Set(prev);
        pagedMembers.forEach(u => next.delete(u.id));
        return next;
      });
    } else {
      setSelectedMember(prev => {
        const next = new Set(prev);
        pagedMembers.forEach(u => next.add(u.id));
        return next;
      });
    }
  };

  // Add selected available users to members
  const handleAddMembers = () => {
    if (selectedAvailable.size === 0) return;
    setMemberUserIds(prev => {
      const next = new Set(prev);
      selectedAvailable.forEach(id => next.add(id));
      return next;
    });
    setSelectedAvailable(new Set());
    setMemberPage(0);
  };

  // Remove selected members
  const handleRemoveMembers = () => {
    if (selectedMember.size === 0) return;
    setMemberUserIds(prev => {
      const next = new Set(prev);
      selectedMember.forEach(id => next.delete(id));
      return next;
    });
    setSelectedMember(new Set());
    setAvailPage(0);
  };

  // Save
  const handleSave = async () => {
    if (!groupName.trim()) return;
    setSaving(true);
    try {
      await onSave(groupName.trim(), Array.from(memberUserIds));
    } finally {
      setSaving(false);
    }
  };

  const renderPagination = (page: number, totalPages: number, setPage: (p: number) => void) => {
    if (totalPages <= 1) return null;
    const pageNumbers: number[] = [];
    const start = Math.max(0, Math.min(page - 1, totalPages - 3));
    const end = Math.min(totalPages, start + 3);
    for (let i = start; i < end; i++) pageNumbers.push(i);
    return (
      <div className="flex items-center justify-center gap-0.5 py-1.5">
        <span
          onClick={() => setPage(Math.max(0, page - 1))}
          className={`px-1.5 py-0.5 text-xs font-bold rounded cursor-pointer transition-colors ${page === 0 ? 'text-[var(--text-muted)] opacity-30 cursor-not-allowed' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]'}`}
        >
          &lt;&lt;
        </span>
        {pageNumbers.map(p => (
          <span
            key={p}
            onClick={() => setPage(p)}
            className={`px-1.5 py-0.5 text-xs font-bold rounded cursor-pointer transition-colors ${p === page ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]'}`}
          >
            {p + 1}
          </span>
        ))}
        <span
          onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
          className={`px-1.5 py-0.5 text-xs font-bold rounded cursor-pointer transition-colors ${page >= totalPages - 1 ? 'text-[var(--text-muted)] opacity-30 cursor-not-allowed' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]'}`}
        >
          &gt;&gt;
        </span>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden animate-in fade-in duration-200">

      {/* ── Header: editable group name ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Users size={18} className="text-[var(--primary)] shrink-0" />
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="flex-1 min-w-0 text-base font-bold bg-transparent border-none outline-none text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              placeholder={t('groupNamePlaceholder')}
              autoFocus
            />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-2)] transition-colors cursor-pointer border-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 flex min-h-0">
          {/* Left: Department tree */}
          <div className="w-[220px] shrink-0 border-r border-[var(--border)] flex flex-col bg-[var(--bg-surface-2)]/20">
            <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <FolderTree size={13} />
                {t('orgSelect')}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
              {/* All option */}
              <div
                onClick={() => setSelectedDept(null)}
                className={`flex items-center gap-2 px-4 py-2 cursor-pointer transition-colors mx-1 rounded-lg ${
                  selectedDept === null
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-bold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)]/50'
                }`}
              >
                <Users size={14} className="shrink-0" />
                <span className="text-xs truncate flex-1">{t('all')}</span>
                <span className="text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 rounded-full">
                  {allUsers.filter(u => !memberUserIds.has(u.id)).length}
                </span>
              </div>
              {/* Tree nodes */}
              {visibleTree.map((node, idx) => {
                const { dept, depth, hasChildren } = node;
                const isExpanded = expandedDeptIds.has(dept.id);
                const availCount = deptAvailableCount.get(dept.id) || 0;
                const isSelected = selectedDept === dept.id;
                return (
                  <div
                    key={`${dept.id}-${idx}`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    className="flex items-center gap-1 pr-3 cursor-pointer transition-colors mx-1 rounded-lg"
                  >
                    {/* Expand/collapse */}
                    <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                      {hasChildren ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpandDept(dept.id); }}
                          className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] border-none bg-transparent cursor-pointer flex items-center justify-center rounded hover:bg-[var(--bg-surface-2)] transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      ) : (
                        <div className="w-3.5" />
                      )}
                    </div>
                    {/* Dept row click → select */}
                    <div
                      onClick={() => setSelectedDept(dept.id)}
                      className={`flex items-center gap-2 py-1.5 flex-1 min-w-0 rounded-lg ${
                        isSelected
                          ? 'text-[var(--primary)] font-bold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 text-[var(--text-muted)]">
                        {isExpanded && hasChildren
                          ? <FolderOpen size={13} />
                          : <FolderTree size={13} />
                        }
                      </div>
                      <span className="text-xs truncate flex-1">{dept.name}</span>
                      {availCount > 0 && (
                        <span className="text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 rounded-full leading-none">
                          {availCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Users + Members */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top: Available Users */}
            <div className="flex-1 flex flex-col min-h-0 border-b border-[var(--border)]">
              <div className="px-4 py-2 bg-[var(--bg-surface-2)]/30 border-b border-[var(--border)] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Users size={13} className="text-[var(--primary)]" />
                    {t('users')}
                  </span>
                  <div className="flex-1" />
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      type="text"
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      placeholder={t('search')}
                      className="w-36 pl-7 pr-2 py-1 rounded-lg bg-[var(--bg-app)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Available user table */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {pagedAvailable.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">
                    {t('noSearchResults')}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs font-bold text-[var(--text-muted)] border-b border-[var(--border)] bg-[var(--bg-surface-2)]/20">
                        <th className="w-8 px-3 py-1.5">
                          <div
                            onClick={toggleSelectAllAvailable}
                            className="cursor-pointer flex items-center justify-center"
                          >
                            {pagedAvailable.every(u => selectedAvailable.has(u.id)) ? (
                              <CheckSquare size={12} className="text-[var(--primary)]" />
                            ) : (
                              <Square size={12} className="text-[var(--text-muted)] opacity-50" />
                            )}
                          </div>
                        </th>
                        <th className="px-2 py-1.5">{t('name')}</th>
                        <th className="px-2 py-1.5">{t('loginId')}</th>
                        <th className="px-2 py-1.5 w-12 text-center">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {pagedAvailable.map(u => (
                        <tr
                          key={u.id}
                          onClick={() => toggleAvailable(u.id)}
                          className="hover:bg-[var(--bg-surface-2)]/30 transition-colors cursor-pointer"
                        >
                          <td className="px-3 py-1.5">
                            <div className="flex items-center justify-center">
                              {selectedAvailable.has(u.id) ? (
                                <CheckSquare size={12} className="text-[var(--primary)]" />
                              ) : (
                                <Square size={12} className="text-[var(--text-muted)] opacity-50" />
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] border border-[var(--border)] shrink-0">
                                {u.login.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-xs font-medium text-[var(--text-secondary)] truncate">
                                {u.lastname}{u.firstname}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="text-xs text-[var(--text-muted)]">{u.login}</span>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`text-xs font-bold px-1 py-0.5 rounded ${u.is_active ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' : 'text-red-500 bg-red-50 dark:bg-red-900/20 dark:text-red-400'}`}>
                              {u.is_active ? t('active') : t('inactive')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Available pagination */}
              <div className="border-t border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/10">
                {renderPagination(availPage, availTotalPages, setAvailPage)}
              </div>
            </div>

            {/* Add/Remove buttons */}
            <div className="flex items-center justify-center gap-3 px-4 py-1.5 bg-[var(--bg-surface-2)]/30 border-b border-[var(--border)] shrink-0">
              <button
                onClick={handleAddMembers}
                disabled={selectedAvailable.size === 0}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[var(--primary)] text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-none"
              >
                <Plus size={12} />
                {t('add')}
                {selectedAvailable.size > 0 && ` (${selectedAvailable.size})`}
              </button>
              <button
                onClick={handleRemoveMembers}
                disabled={selectedMember.size === 0}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-500 text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-none"
              >
                <Trash2 size={12} />
                {t('delete')}
                {selectedMember.size > 0 && ` (${selectedMember.size})`}
              </button>
            </div>

            {/* Bottom: Group Members */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-2 bg-[var(--bg-surface-2)]/30 border-b border-[var(--border)] shrink-0">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Users size={13} className="text-[var(--primary)]" />
                  {t('groupMembers')}
                  <span className="text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 rounded-full leading-none">
                    {memberUserIds.size}{t('people')}
                  </span>
                </span>
              </div>

              {/* Member table */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {pagedMembers.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">
                    {t('noMembers')}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs font-bold text-[var(--text-muted)] border-b border-[var(--border)] bg-[var(--bg-surface-2)]/20">
                        <th className="w-8 px-3 py-1.5">
                          <div
                            onClick={toggleSelectAllMembers}
                            className="cursor-pointer flex items-center justify-center"
                          >
                            {pagedMembers.every(u => selectedMember.has(u.id)) ? (
                              <CheckSquare size={12} className="text-[var(--primary)]" />
                            ) : (
                              <Square size={12} className="text-[var(--text-muted)] opacity-50" />
                            )}
                          </div>
                        </th>
                        <th className="px-2 py-1.5">{t('name')}</th>
                        <th className="px-2 py-1.5">{t('loginId')}</th>
                        <th className="px-2 py-1.5 w-12 text-center">{t('status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {pagedMembers.map(u => (
                        <tr
                          key={u.id}
                          onClick={() => toggleMember(u.id)}
                          className="hover:bg-[var(--bg-surface-2)]/30 transition-colors cursor-pointer"
                        >
                          <td className="px-3 py-1.5">
                            <div className="flex items-center justify-center">
                              {selectedMember.has(u.id) ? (
                                <CheckSquare size={12} className="text-[var(--primary)]" />
                              ) : (
                                <Square size={12} className="text-[var(--text-muted)] opacity-50" />
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] border border-[var(--border)] shrink-0">
                                {u.login.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-xs font-medium text-[var(--text-secondary)] truncate">
                                {u.lastname}{u.firstname}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="text-xs text-[var(--text-muted)]">{u.login}</span>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`text-xs font-bold px-1 py-0.5 rounded ${u.is_active ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' : 'text-red-500 bg-red-50 dark:bg-red-900/20 dark:text-red-400'}`}>
                              {u.is_active ? t('active') : t('inactive')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Member pagination */}
              <div className="border-t border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/10">
                {renderPagination(memberPage, memberTotalPages, setMemberPage)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/20">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Save}
            onClick={handleSave}
            disabled={saving || !groupName.trim()}
          >
            {saving ? t('processing') : t('save')}
          </Button>
        </div>
      </div>
  );
}
