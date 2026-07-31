import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Users,
  UserPlus,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronRight,
  Search,
  Check,
  UserMinus,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from 'ui/Card';
import { Button } from 'ui/Button';
import { api } from 'shared/lib/api';
import { ConfirmDialog } from 'ui/ConfirmDialog';
import type { UserInfo, UserGroup, UserGroupMember } from 'shared/types';

interface UserGroupManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupSelect?: (memberIds: string[]) => void;
  t: (key: string) => string;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export function UserGroupManager({
  isOpen,
  onClose,
  onGroupSelect,
  t,
  showToast,
}: UserGroupManagerProps) {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<Record<string, UserGroupMember[]>>({});
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [expandedMemberSearch, setExpandedMemberSearch] = useState(false);
  const [expandedMemberResults, setExpandedMemberResults] = useState<UserInfo[]>([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await api('/api/chat/user-groups');
      const json = await res.json();
      if (json.success) setGroups(json.data || []);
    } catch {
      showToast(t('errOccurred'), 'error');
    }
  }, [showToast, t]);

  useEffect(() => {
    if (isOpen) {
      fetchGroups();
      setIsCreating(false);
      setNewGroupName('');
      setNewGroupMemberIds([]);
      setSearchQuery('');
      setExpandedGroupId(null);
      setEditingGroupId(null);
      setExpandedMemberSearch(false);
    }
  }, [isOpen, fetchGroups]);

  // Fetch all users for member selection
  useEffect(() => {
    if (isOpen && (isCreating || expandedGroupId !== null)) {
      api('/api/users')
        .then((res) => res.json())
        .then((json) => {
          if (json.success) setAllUsers(json.data || []);
        });
    }
  }, [isOpen, isCreating, expandedGroupId]);

  // Fetch members for expanded group
  useEffect(() => {
    if (expandedGroupId !== null && !groupMembers[expandedGroupId]) {
      api(`/api/chat/user-groups/${expandedGroupId}/members`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setGroupMembers((prev) => ({
              ...prev,
              [expandedGroupId]: json.data || [],
            }));
          }
        });
    }
  }, [expandedGroupId, groupMembers]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsCreatingGroup(true);
    try {
      const res = await api('/api/chat/user-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          member_ids: newGroupMemberIds,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(t('chatGroupCreateSuccess'), 'success');
        setIsCreating(false);
        setNewGroupName('');
        setNewGroupMemberIds([]);
        fetchGroups();
      } else {
        showToast(json.error || t('errOccurred'), 'error');
      }
    } catch {
      showToast(t('errOccurred'), 'error');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleDeleteGroup = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(groupId);
  };

  const doDeleteGroup = async (groupId: string) => {
    try {
      const res = await api(`/api/chat/user-groups/${groupId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        showToast(t('chatGroupDeleteSuccess'), 'success');
        if (expandedGroupId === groupId) setExpandedGroupId(null);
        fetchGroups();
      } else {
        showToast(json.error || t('errOccurred'), 'error');
      }
    } catch {
      showToast(t('errOccurred'), 'error');
    }
  };

  const handleUpdateGroupName = async (groupId: string) => {
    if (!editGroupName.trim()) return;
    try {
      const res = await api(`/api/chat/user-groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editGroupName.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(t('chatGroupUpdateSuccess'), 'success');
        setEditingGroupId(null);
        fetchGroups();
      } else {
        showToast(json.error || t('errOccurred'), 'error');
      }
    } catch {
      showToast(t('errOccurred'), 'error');
    }
  };

  const handleRemoveMember = async (groupId: string, userId: string) => {
    try {
      const res = await api(
        `/api/chat/user-groups/${groupId}/members/${userId}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (json.success) {
        setGroupMembers((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] || []).filter((m) => m.user_id !== userId),
        }));
        showToast(t('chatGroupRemoveMember'), 'success');
      }
    } catch {
      showToast(t('errOccurred'), 'error');
    }
  };

  const handleAddMembersToGroup = async (groupId: string, userIds: string[]) => {
    if (userIds.length === 0) return;
    setIsAddingMembers(true);
    try {
      const res = await api(`/api/chat/user-groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: userIds }),
      });
      const json = await res.json();
      if (json.success) {
        // Re-fetch members
        const mRes = await api(`/api/chat/user-groups/${groupId}/members`);
        const mJson = await mRes.json();
        if (mJson.success) {
          setGroupMembers((prev) => ({
            ...prev,
            [groupId]: mJson.data || [],
          }));
        }
        setExpandedMemberSearch(false);
        setMemberSearchQuery('');
        showToast(t('chatGroupAddMembers'), 'success');
      }
    } catch {
      showToast(t('errOccurred'), 'error');
    } finally {
      setIsAddingMembers(false);
    }
  };

  const toggleNewGroupMember = (userId: string) => {
    setNewGroupMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const searchMembersDebounced = (query: string) => {
    setMemberSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) {
      setExpandedMemberResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api(`/api/users?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        if (json.success) {
          // Filter out users already in the group
          const currentMembers = groupMembers[expandedGroupId!] || [];
          const memberUserIds = currentMembers.map((m) => m.user_id);
          setExpandedMemberResults(
            (json.data || []).filter((u: UserInfo) => !memberUserIds.includes(u.id))
          );
        }
      } catch { /* ignore */ }
    }, 300);
  };

  const searchNewGroupMembersDebounced = (query: string) => {
    setSearchQuery(query);
  };

  const getFilteredUsersForNewGroup = () => {
    if (!searchQuery.trim()) return allUsers;
    const q = searchQuery.toLowerCase();
    return allUsers.filter(
      (u) =>
        u.login.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.firstname && u.firstname.toLowerCase().includes(q)) ||
        (u.lastname && u.lastname.toLowerCase().includes(q))
    );
  };

  const getUserName = (user: { firstname?: string; lastname?: string; login: string }) => {
    if (user.firstname || user.lastname)
      return `${user.firstname || ''} ${user.lastname || ''}`.trim();
    return user.login;
  };

  const getInitials = (user: { firstname?: string; lastname?: string; login: string }) => {
    if (user.firstname) return user.firstname.slice(0, 2).toUpperCase();
    return user.login.slice(0, 2).toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        title={t('delete')}
        message={t('chatGroupDeleteConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        danger
        onConfirm={() => { const id = confirmDeleteId; setConfirmDeleteId(null); if (id) doDeleteGroup(id); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <Card className="relative w-full max-w-lg shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 z-10 animate-zoom-in max-h-[85vh] flex flex-col">
        <CardHeader
          title={t('chatGroupManageTitle')}
          action={
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 transition-colors"
            >
              <X size={16} />
            </button>
          }
        />
        <CardBody className="flex flex-col flex-1 overflow-hidden">
          {/* Create Group Form */}
          {isCreating ? (
            <div className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50 mb-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('chatGroupCreate')}
                </h4>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewGroupName('');
                    setNewGroupMemberIds([]);
                  }}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('chatGroupNamePlaceholder')}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-400 dark:focus:border-indigo-600 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                  autoFocus
                />
              </div>

              {/* Member selection for new group */}
              <div className="flex flex-col gap-2">
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {t('chatGroupAddMembers')}
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={t('chatSearchUsers')}
                    value={searchQuery}
                    onChange={(e) => searchNewGroupMembersDebounced(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-400 dark:focus:border-indigo-600 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded border-none bg-transparent cursor-pointer text-slate-400"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <div className="max-h-[140px] overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                  {getFilteredUsersForNewGroup().map((user) => {
                    const isSelected = newGroupMemberIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleNewGroupMember(user.id)}
                        className={`w-full text-left flex items-center justify-between px-2.5 py-2 rounded-lg border transition-all cursor-pointer text-xs ${
                          isSelected
                            ? 'border-indigo-300 dark:border-indigo-700/60 bg-indigo-50 dark:bg-indigo-950/20'
                            : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 bg-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isSelected
                                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {getInitials(user)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {getUserName(user)}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                              {user.email}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {isSelected && <Check size={9} />}
                        </div>
                      </button>
                    );
                  })}
                  {getFilteredUsersForNewGroup().length === 0 && (
                    <div className="py-4 text-center text-xs text-slate-400">
                      {t('chatNoUsersFound')}
                    </div>
                  )}
                </div>
                {newGroupMemberIds.length > 0 && (
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                    {t('chatGroupSelectMemberCount').replace(
                      '{count}',
                      newGroupMemberIds.length.toString()
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsCreating(false);
                    setNewGroupName('');
                    setNewGroupMemberIds([]);
                  }}
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  isLoading={isCreatingGroup}
                  disabled={!newGroupName.trim()}
                  onClick={handleCreateGroup}
                >
                  {t('chatGroupCreateBtn')}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700/50 bg-indigo-50/50 dark:bg-indigo-950/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100/50 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer mb-3"
            >
              <Plus size={14} />
              {t('chatGroupCreate')}
            </button>
          )}

          {/* Group List */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 custom-scrollbar">
            {groups.length === 0 && !isCreating && (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Users size={24} className="text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {t('chatGroupNoGroups')}
                </p>
              </div>
            )}

            {groups.map((group) => {
              const isExpanded = expandedGroupId === group.id;
              const isEditing = editingGroupId === group.id;
              const members = groupMembers[group.id] || [];
              const memberCount = members.length;

              return (
                <div
                  key={group.id}
                  className={`rounded-xl border transition-all ${
                    isExpanded
                      ? 'border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/30 dark:bg-indigo-950/10'
                      : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  {/* Group Header */}
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                    onClick={() =>
                      setExpandedGroupId(isExpanded ? null : group.id)
                    }
                  >
                    <div className="text-slate-400 dark:text-slate-500 transition-transform">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                      <Users size={14} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editGroupName}
                            onChange={(e) => setEditGroupName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateGroupName(group.id);
                              if (e.key === 'Escape') setEditingGroupId(null);
                            }}
                            className="flex-1 px-2 py-0.5 text-sm bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded outline-none text-slate-800 dark:text-slate-200"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateGroupName(group.id)}
                            className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded border-none bg-transparent cursor-pointer text-indigo-600 dark:text-indigo-400"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setEditingGroupId(null)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded border-none bg-transparent cursor-pointer text-slate-400"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {group.name}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">
                            {memberCount > 0
                              ? t('chatGroupMemberCount').replace('{count}', memberCount.toString())
                              : t('chatGroupNoGroups')}
                          </div>
                        </>
                      )}
                    </div>

                    {!isEditing && (
                      <div
                        className="flex items-center gap-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {onGroupSelect && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              let targetMembers = groupMembers[group.id];
                              if (!targetMembers) {
                                try {
                                  const res = await api(`/api/chat/user-groups/${group.id}/members`);
                                  const json = await res.json();
                                  if (json.success) {
                                    targetMembers = json.data || [];
                                    setGroupMembers((prev) => ({
                                      ...prev,
                                      [group.id]: targetMembers!,
                                    }));
                                  }
                                } catch { /* ignore */ }
                              }
                              if (targetMembers && targetMembers.length > 0) {
                                const memberIds = targetMembers.map((m) => m.user_id);
                                onGroupSelect(memberIds);
                                onClose();
                              }
                            }}
                            className="p-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg border-none bg-transparent cursor-pointer text-indigo-500 dark:text-indigo-400 transition-colors"
                            title={t('chatSelectFromGroup')}
                          >
                            <UserPlus size={13} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGroupId(group.id);
                            setEditGroupName(group.name);
                          }}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteGroup(group.id, e)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expanded Members View */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0">
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                        {/* Add member search */}
                        <div className="mb-2">
                          {expandedMemberSearch ? (
                            <div className="flex items-center gap-1.5">
                              <div className="relative flex-1">
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder={t('chatSearchUsers')}
                                  value={memberSearchQuery}
                                  onChange={(e) => searchMembersDebounced(e.target.value)}
                                  className="w-full pl-7 pr-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-indigo-400 text-slate-800 dark:text-slate-200 placeholder-slate-400 transition-colors"
                                  autoFocus
                                />
                              </div>
                              <button
                                onClick={() => {
                                  setExpandedMemberSearch(false);
                                  setMemberSearchQuery('');
                                  setExpandedMemberResults([]);
                                }}
                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border-none bg-transparent cursor-pointer text-slate-400"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setExpandedMemberSearch(true)}
                              className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg border border-dashed border-indigo-200 dark:border-indigo-800/50 bg-transparent cursor-pointer font-medium transition-colors"
                            >
                              <UserPlus size={12} />
                              {t('chatGroupAddMembers')}
                            </button>
                          )}
                          {expandedMemberSearch && expandedMemberResults.length > 0 && (
                            <div className="mt-1.5 max-h-[100px] overflow-y-auto flex flex-col gap-1 custom-scrollbar bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5">
                              {expandedMemberResults.map((user) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  disabled={isAddingMembers}
                                  onClick={() =>
                                    handleAddMembersToGroup(group.id, [user.id])
                                  }
                                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer border-none bg-transparent text-xs"
                                >
                                  <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-400 shrink-0">
                                    {getInitials(user)}
                                  </div>
                                  <span className="text-slate-800 dark:text-slate-200 truncate">
                                    {getUserName(user)}
                                  </span>
                                  <span className="text-xs text-slate-400 truncate">
                                    {user.email}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Member list */}
                        <div className="flex flex-col gap-1">
                          {members.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800/60 transition-colors group"
                            >
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs shrink-0">
                                {getInitials(member)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                                  {getUserName(member)}
                                </div>
                                <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                                  {member.email}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  handleRemoveMember(group.id, member.user_id)
                                }
                                className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded border-none bg-transparent cursor-pointer text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                                title={t('chatGroupRemoveMember')}
                              >
                                <UserMinus size={11} />
                              </button>
                            </div>
                          ))}
                          {members.length === 0 && (
                            <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                              {t('chatNoUsersFound')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardBody>
        <div className="px-6 py-3 flex justify-end border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 shrink-0">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
