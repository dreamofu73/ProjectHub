import { useState, useEffect, useCallback, useMemo } from 'react';
import React from 'react';
import { Users, Plus } from 'lucide-react';
import { api, addressBookApi, organizationApi } from 'shared/lib/api';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from 'ui/Toast';
import { AddressBookGroupList } from '../../components/addressbook/AddressBookGroupList';
import { AddressBookGroupDetail } from '../../components/addressbook/AddressBookGroupDetail';
import { EditMembersModal } from '../../components/addressbook/EditMembersModal';
import { MemoComposeForm } from '../memos/components/MemoComposeForm';
import { Button } from 'ui/Button';
import { Input } from 'ui/Input';
import type { UserData } from 'shared/types/user';
import type { Department, AddressBookGroup, AddressBookMember } from 'shared/types/organization';
import type { } from 'shared/types';

export default function AddressBookPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();

  // ─── Users (for member selection) ──────────────────────────────
  const [users, setUsers] = useState<UserData[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api('/api/users');
      const json = await res.json();
      if (json.success) {
        let userList = json.data as UserData[];
        const currentUserStr = localStorage.getItem('user');
        if (currentUserStr) {
          const currentUser = JSON.parse(currentUserStr);
          if (currentUser?.id) {
            userList = userList.filter((u: UserData) => u.id !== String(currentUser.id));
          }
        }
        setUsers(userList);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ─── Departments (for org tree in EditMembersModal) ────────────
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    organizationApi.listDepartments().then(res => {
      if (res.success) setDepartments(res.data);
    }).catch(() => {});
  }, []);

  // ─── Groups ────────────────────────────────────────────────────
  const [groups, setGroups] = useState<AddressBookGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AddressBookGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<AddressBookMember[]>([]);
  const [groupMembersLoading, setGroupMembersLoading] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState<'create' | 'edit' | null>(null);
  const [groupFormName, setGroupFormName] = useState('');
  const [showGroupEditModal, setShowGroupEditModal] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // ─── Compose Memo State ─────────────────────────────────────────
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeRecipients, setComposeRecipients] = useState<any[]>([]);
  const [composeTitle, setComposeTitle] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeRecipientSearch, setComposeRecipientSearch] = useState('');
  const [composeAttachedFiles, setComposeAttachedFiles] = useState<File[]>([]);
  const [composeIsReservedSend, setComposeIsReservedSend] = useState(false);
  const [composeReservedDate, setComposeReservedDate] = useState('');
  const [isSelfWriteMode, setIsSelfWriteMode] = useState(false);

  useEffect(() => {
    const handleOpenCompose = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsSelfWriteMode(!!customEvent.detail?.self);
      if (customEvent.detail?.recipients) {
        setComposeRecipients(customEvent.detail.recipients);
      } else {
        setComposeRecipients([]);
      }
      setComposeRecipientSearch('');
      setComposeTitle(customEvent.detail?.title || '');
      setComposeContent(customEvent.detail?.content || '');
      setComposeAttachedFiles([]);
      setComposeIsReservedSend(false);
      setComposeReservedDate('');
      setIsComposeOpen(true);
    };

    window.addEventListener('open_compose_memo', handleOpenCompose);
    return () => window.removeEventListener('open_compose_memo', handleOpenCompose);
  }, []);

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const res = await addressBookApi.listGroups();
      if (res.success) {
        setGroups(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Fetch members when group selected
  useEffect(() => {
    if (!selectedGroup) {
      setGroupMembers([]);
      return;
    }
    setGroupMembersLoading(true);
    addressBookApi.listMembers(selectedGroup.id)
      .then(res => {
        if (res.success) setGroupMembers(res.data);
      })
      .catch(err => console.error('Failed to fetch members:', err))
      .finally(() => setGroupMembersLoading(false));
  }, [selectedGroup]);

  // Auto-select first group
  useEffect(() => {
    if (!groupsLoading && groups.length > 0 && !selectedGroup) {
      setSelectedGroup(groups[0]);
    }
  }, [groupsLoading, groups, selectedGroup]);

  // ─── Handlers ──────────────────────────────────────────────────

  const handleOpenCreatePanel = () => {
    setIsCreatingGroup(true);
    setShowGroupEditModal(true);
  };

  const handleSaveNewGroup = async (name: string, memberUserIds: string[]) => {
    try {
      const res = await addressBookApi.createGroup({ name });
      if (res.success && res.data) {
        if (memberUserIds.length > 0) {
          await addressBookApi.addMembers(res.data.id, { user_ids: memberUserIds });
        }
        showToast(t('saved') || '저장되었습니다', 'success');
        setShowGroupEditModal(false);
        setIsCreatingGroup(false);
        await fetchGroups();
        setSelectedGroup(res.data);
        const membersRes = await addressBookApi.listMembers(res.data.id);
        if (membersRes.success) setGroupMembers(membersRes.data);
      } else {
        showToast(t('saveFailed') || '저장에 실패했습니다', 'error');
      }
    } catch (err) {
      console.error('Failed to create group:', err);
      showToast(t('saveFailed') || '저장에 실패했습니다', 'error');
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup || !groupFormName.trim()) return;
    try {
      const res = await addressBookApi.updateGroup(selectedGroup.id, { name: groupFormName.trim() });
      if (res.success) {
        setShowGroupModal(null);
        setGroupFormName('');
        fetchGroups();
      }
    } catch (err) {
      console.error('Failed to update group:', err);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupFormName.trim()) return;
    try {
      const res = await addressBookApi.createGroup({ name: groupFormName.trim() });
      if (res.success) {
        setShowGroupModal(null);
        setGroupFormName('');
        fetchGroups();
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm(t('confirmDeleteGroup') || '이 그룹을 삭제하시겠습니까?')) return;
    try {
      const res = await addressBookApi.deleteGroup(groupId);
      if (res.success) {
        if (selectedGroup?.id === groupId) setSelectedGroup(null);
        fetchGroups();
      }
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  const handleSaveGroup = async (name: string, memberUserIds: string[]) => {
    if (!selectedGroup) return;
    try {
      if (name !== selectedGroup.name) {
        const nameRes = await addressBookApi.updateGroup(selectedGroup.id, { name });
        if (!nameRes.success) {
          showToast(t('saveFailed') || '저장에 실패했습니다', 'error');
          return;
        }
      }

      const currentMemberIds = new Set(groupMembers.map(m => m.user_id));
      const newMemberIds = new Set(memberUserIds);
      const toAdd = memberUserIds.filter(id => !currentMemberIds.has(id));
      const toRemove = groupMembers.filter(m => !newMemberIds.has(m.user_id)).map(m => m.user_id);

      if (toAdd.length > 0) {
        const addRes = await addressBookApi.addMembers(selectedGroup.id, { user_ids: toAdd });
        if (!addRes.success) {
          showToast(t('saveFailed') || '저장에 실패했습니다', 'error');
          return;
        }
      }

      for (const userId of toRemove) {
        const removeRes = await addressBookApi.removeMember(selectedGroup.id, userId);
        if (!removeRes.success) {
          showToast(t('saveFailed') || '저장에 실패했습니다', 'error');
          return;
        }
      }

      showToast(t('saved') || '저장되었습니다', 'success');
      setShowGroupEditModal(false);

      await fetchGroups();
      const membersRes = await addressBookApi.listMembers(selectedGroup.id);
      if (membersRes.success) setGroupMembers(membersRes.data);
    } catch (err) {
      console.error('Failed to save group:', err);
      showToast(t('saveFailed') || '저장에 실패했습니다', 'error');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup) return;
    try {
      const res = await addressBookApi.removeMember(selectedGroup.id, userId);
      if (res.success) {
        setGroupMembers(prev => prev.filter(m => m.user_id !== userId));
        setGroups(prev => prev.map(g =>
          g.id === selectedGroup.id
            ? { ...g, member_count: Math.max(0, g.member_count - 1) }
            : g
        ));
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleSendMemoToGroup = (memberIds: string[]) => {
    const recipients = groupMembers
      .filter(m => memberIds.includes(m.user_id))
      .map(m => ({
        id: m.user_id,
        login: m.login,
        email: m.email ?? '',
        firstname: m.firstname,
        lastname: m.lastname,
        role: 'user' as const,
        groupName: selectedGroup?.name,
      }));

    if (recipients.length === 0) return;
    setComposeRecipients(recipients);
    setComposeTitle('');
    setComposeContent('');
    setComposeAttachedFiles([]);
    setComposeIsReservedSend(false);
    setComposeReservedDate('');
    setComposeRecipientSearch('');
    setIsComposeOpen(true);
  };

  const composeFilteredUsers = useMemo(() => {
    return users
      .filter(u => !composeRecipients.some(r => r.id === u.id))
      .filter(u => {
        if (!composeRecipientSearch.trim()) return true;
        const fullName = `${u.lastname}${u.firstname}`.toLowerCase();
        const login = u.login.toLowerCase();
        const search = composeRecipientSearch.toLowerCase();
        return fullName.includes(search) || login.includes(search);
      })
      .map(u => ({
        id: u.id,
        login: u.login,
        email: u.email ?? '',
        firstname: u.firstname,
        lastname: u.lastname,
        role: u.role ?? 'user',
      }));
  }, [users, composeRecipients, composeRecipientSearch]);

  const handleComposeSendMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    const currentUserId = currentUser?.id ? String(currentUser.id) : null;
    
    let targetIds: string[] = isSelfWriteMode ? [currentUserId!] : composeRecipients.map(r => String(r.id));
    if (!isSelfWriteMode && targetIds.length === 0) return showToast('수신자를 선택해주세요.', 'warning');
    if (!composeTitle.trim()) return showToast('제목을 입력해주세요.', 'warning');
    if (!composeContent.trim() || composeContent === '<p></p>') return showToast('내용을 입력해주세요.', 'warning');

    let reservedIso: string | undefined = undefined;
    if (composeIsReservedSend && composeReservedDate) {
      reservedIso = new Date(composeReservedDate).toISOString();
    }

    setComposeSending(true);
    try {
      const res = await api('/api/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_ids: targetIds,
          title: composeTitle.trim(),
          content: composeContent.trim(),
          reserved_at: reservedIso,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (composeAttachedFiles.length > 0) {
          const createdMemoIds = json.data?.memo_ids || [];
          for (const file of composeAttachedFiles) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('memo_ids', JSON.stringify(createdMemoIds));
            await api('/api/attachments', { method: 'POST', body: formData });
          }
        }
        showToast(composeIsReservedSend ? '쪽지가 예약 발송되었습니다.' : t('memoSendSuccess') || '쪽지를 보냈습니다.', 'success');
        setIsComposeOpen(false);
        setComposeRecipients([]);
        setComposeTitle('');
        setComposeContent('');
        setComposeAttachedFiles([]);
      } else {
        showToast(json.error || t('memoSendFail') || '쪽지 전송에 실패했습니다.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(t('memoSendFail') || '쪽지 전송에 실패했습니다.', 'error');
    } finally {
      setComposeSending(false);
    }
  };

  // ─── Prevent body scroll ───────────────────────────────────────
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // ─── Render ────────────────────────────────────────────────────
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const composeExistingRecipientIds = useMemo(
    () => new Set(composeRecipients.map(r => r.id)),
    [composeRecipients]
  );

  return (
    <div className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">

      {showGroupEditModal ? (
        /* ── 그룹 생성/수정 화면 ── */
        isCreatingGroup ? (
          <EditMembersModal
            groupName=""
            allUsers={users}
            departments={departments}
            existingMembers={[]}
            onSave={handleSaveNewGroup}
            onClose={() => { setShowGroupEditModal(false); setIsCreatingGroup(false); }}
            t={t}
          />
        ) : selectedGroup && (
          <EditMembersModal
            groupName={selectedGroup.name}
            allUsers={users}
            departments={departments}
            existingMembers={groupMembers}
            onSave={handleSaveGroup}
            onClose={() => setShowGroupEditModal(false)}
            t={t}
          />
        )
      ) : (
        /* ── 주소록 기본 화면 ── */
        <>
          {/* 헤더 — isComposeOpen일 때 숨김 (쪽지함과 동일) */}
          {!isComposeOpen && (
            <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-surface)] border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Users size={16} className="text-[var(--primary)]" />
                  <span>{t('addressBook') || '주소록'}</span>
                </h2>
              </div>
            </div>
          )}

          {/* 헤더 아래 인라인 그룹 생성/수정 폼 */}
          {!isComposeOpen && showGroupModal && (
            <div className="px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-surface-2)]/30 animate-in slide-in-from-top-2 duration-200">
              <div className="flex gap-2 items-center">
                <Input
                  value={groupFormName}
                  onChange={(e) => setGroupFormName(e.target.value)}
                  placeholder={t('groupNamePlaceholder') || '그룹 이름을 입력하세요'}
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      showGroupModal === 'create' ? handleCreateGroup() : handleUpdateGroup();
                    } else if (e.key === 'Escape') {
                      setShowGroupModal(null);
                    }
                  }}
                />
                <Button onClick={showGroupModal === 'create' ? handleCreateGroup : handleUpdateGroup} size="sm">
                  {showGroupModal === 'create' ? (t('create') || '생성') : (t('save') || '저장')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowGroupModal(null)}>{t('cancel') || '취소'}</Button>
              </div>
            </div>
          )}

          {/* 메인 콘텐츠 영역 — 쪽지함과 완전히 동일한 구조 */}
          <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden bg-[var(--bg-surface)]">

            {isComposeOpen ? (
              /* 쪽지 작성 폼 — 전체 영역 차지 (쪽지함과 동일) */
              <MemoComposeForm
                isSelfWriteMode={isSelfWriteMode}
                currentUser={currentUser}
                recipients={composeRecipients}
                setRecipients={setComposeRecipients}
                recipientSearch={composeRecipientSearch}
                setRecipientSearch={setComposeRecipientSearch}
                filteredUsers={composeFilteredUsers}
                title={composeTitle}
                setTitle={setComposeTitle}
                isReservedSend={composeIsReservedSend}
                setIsReservedSend={setComposeIsReservedSend}
                reservedDate={composeReservedDate}
                setReservedDate={setComposeReservedDate}
                content={composeContent}
                setContent={setComposeContent}
                attachedFiles={composeAttachedFiles}
                setAttachedFiles={setComposeAttachedFiles}
                sending={composeSending}
                handleSendMemo={handleComposeSendMemo}
                setIsComposeOpen={setIsComposeOpen}
                existingRecipientIds={composeExistingRecipientIds}
                t={t}
              />
            ) : (
              /* 주소록 탐색 모드 */
              <div className="flex flex-col flex-1 overflow-hidden p-5 gap-4">

                {/* 툴바 */}
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-xs text-[var(--text-muted)] font-medium">
                    {t('myGroups') || '내 그룹'}
                    {groups.length > 0 && (
                      <span className="ml-1">({groups.length})</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenCreatePanel}
                    className="h-8.5 px-3.5 bg-[var(--primary)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98] border-none"
                  >
                    <Plus size={13} />
                    {t('createGroup') || '그룹 생성'}
                  </button>
                </div>

                {/* 그룹 목록 + 상세 */}
                <div className="flex-1 overflow-hidden flex min-h-0 flex-row gap-0">
                  <div className="flex flex-col overflow-hidden border-r border-[var(--border)] min-w-[250px] w-[280px] shrink-0">
                    <AddressBookGroupList
                      groups={groups}
                      loading={groupsLoading}
                      selectedGroupId={selectedGroup?.id || null}
                      onSelectGroup={setSelectedGroup}
                      t={t}
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[var(--bg-surface)]">
                    <AddressBookGroupDetail
                      group={selectedGroup}
                      members={groupMembers}
                      loading={groupMembersLoading}
                      onAddMembers={() => setShowGroupEditModal(true)}
                      onRemoveMember={handleRemoveMember}
                      onSendMemo={handleSendMemoToGroup}
                      onDeleteGroup={() => selectedGroup && handleDeleteGroup(selectedGroup.id)}
                      t={t}
                    />
                  </div>
                </div>

              </div>
            )}

          </div>
        </>
      )}

    </div>
  );
}
