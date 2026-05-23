import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, Search, Users } from 'lucide-react';
import { Card, CardBody, CardHeader } from 'ui/Card';
import { Button } from 'ui/Button';
import { Input } from 'ui/Input';
import { UserGroupManager } from './UserGroupManager';
import type { UserInfo } from 'shared/types';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  newRoomName: string;
  setNewRoomName: (val: string) => void;
  handleCreateRoom: (e: React.FormEvent) => void;
  isCreatingRoom: boolean;
  createRoomUsers: UserInfo[];
  createRoomSelectedUsers: string[];
  handleToggleCreateRoomUser: (userId: string) => void;
  t: (key: string) => string;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export function CreateRoomModal({
  isOpen,
  onClose,
  newRoomName,
  setNewRoomName,
  handleCreateRoom,
  isCreatingRoom,
  createRoomUsers,
  createRoomSelectedUsers,
  handleToggleCreateRoomUser,
  t,
  showToast,
}: CreateRoomModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setDebouncedQuery('');
    }
  }, [isOpen]);

  const filteredUsers = createRoomUsers.filter((user) => {
    if (!debouncedQuery.trim()) return true;
    const q = debouncedQuery.toLowerCase();
    return (
      (user.login && user.login.toLowerCase().includes(q)) ||
      (user.email && user.email.toLowerCase().includes(q)) ||
      (user.firstname && user.firstname.toLowerCase().includes(q)) ||
      (user.lastname && user.lastname.toLowerCase().includes(q))
    );
  });

  const handleGroupSelect = useCallback(
    (memberIds: string[]) => {
      // Add all group members to selected users (avoiding duplicates)
      memberIds.forEach((id) => {
        if (!createRoomSelectedUsers.includes(id)) {
          handleToggleCreateRoomUser(id);
        }
      });
    },
    [createRoomSelectedUsers, handleToggleCreateRoomUser]
  );

  const getSelectedUserInfo = (userId: string) => {
    return createRoomUsers.find((u) => u.id === userId);
  };

  const getUserName = (user: UserInfo) => {
    if (user.firstname || user.lastname)
      return `${user.firstname || ''} ${user.lastname || ''}`.trim();
    return user.login;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <Card className="relative w-full max-w-md shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 z-10 animate-zoom-in">
        <CardHeader
          title={t('chatNewRoomTitle')}
          action={
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 transition-colors"
            >
              <X size={16} />
            </button>
          }
        />
        <form onSubmit={handleCreateRoom} className="flex flex-col h-full max-h-[80vh]">
          <CardBody className="flex flex-col gap-4 flex-1 overflow-hidden">
            <Input
              label={t('chatRoomNameLabel')}
              placeholder={t('chatRoomNamePlaceholder')}
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              required
              fullWidth
            />

            {/* Selected users chips */}
            {createRoomSelectedUsers.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest select-none">
                  {t('chatGroupSelectMemberCount').replace(
                    '{count}',
                    createRoomSelectedUsers.length.toString()
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {createRoomSelectedUsers.map((userId) => {
                    const user = getSelectedUserInfo(userId);
                    if (!user) return null;
                    return (
                      <span
                        key={userId}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-full text-xs font-medium text-indigo-700 dark:text-indigo-300"
                      >
                        <span className="truncate max-w-[100px]">
                          {getUserName(user)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleCreateRoomUser(userId)}
                          className="ml-0.5 p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 rounded-full border-none bg-transparent cursor-pointer text-indigo-500 dark:text-indigo-400 flex items-center justify-center"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search input + Group button */}
            <div className="flex flex-col gap-2 flex-1 overflow-hidden min-h-[180px]">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest select-none">
                  {t('chatInviteSelectUser') || '초대할 사용자 선택'}
                </div>
                <button
                  type="button"
                  onClick={() => setIsGroupManagerOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-transparent cursor-pointer transition-colors"
                >
                  <Users size={11} />
                  {t('chatSelectFromGroup')}
                </button>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder={t('chatSearchUsers')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-400 dark:focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded border-none bg-transparent cursor-pointer text-slate-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* User list */}
              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-1.5">
                {filteredUsers.map((user) => {
                  const isSelected = createRoomSelectedUsers.includes(user.id);
                  const initials = user.firstname
                    ? user.firstname.slice(0, 2).toUpperCase()
                    : user.login.slice(0, 2).toUpperCase();
                  const nameString = getUserName(user);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleToggleCreateRoomUser(user.id)}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-300 dark:border-indigo-700/60 bg-indigo-50 dark:bg-indigo-950/20'
                          : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 bg-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected
                              ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {initials}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {nameString}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check size={11} />}
                      </div>
                    </button>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                    {t('chatNoUsersFound')}
                  </div>
                )}
              </div>
            </div>
          </CardBody>
          <div className="px-6 py-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 shrink-0">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" isLoading={isCreatingRoom} disabled={!newRoomName.trim()}>
              {t('chatRoomCreateBtn')}
            </Button>
          </div>
        </form>
      </Card>

      {/* User Group Manager Modal */}
      <UserGroupManager
        isOpen={isGroupManagerOpen}
        onClose={() => setIsGroupManagerOpen(false)}
        onGroupSelect={handleGroupSelect}
        t={t}
        showToast={showToast}
      />
    </div>
  );
}
