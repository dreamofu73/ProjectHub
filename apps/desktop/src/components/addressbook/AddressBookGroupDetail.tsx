import { Users, Send, X, User, Edit2, Trash2 } from 'lucide-react';
import type { AddressBookGroup, AddressBookMember } from 'shared/types/organization';

interface AddressBookGroupDetailProps {
  group: AddressBookGroup | null;
  members: AddressBookMember[];
  loading: boolean;
  onAddMembers: () => void;
  onRemoveMember: (userId: string) => void;
  onSendMemo: (memberIds: string[]) => void;
  onDeleteGroup: () => void;
  t: (key: string) => string;
}

export function AddressBookGroupDetail({
  group,
  members,
  loading,
  onAddMembers,
  onRemoveMember,
  onSendMemo,
  onDeleteGroup,
  t,
}: AddressBookGroupDetailProps) {
  if (!group) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-4 select-none bg-[var(--bg-surface-2)]/20">
        <div className="w-16 h-16 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center shadow-inner border border-[var(--border)]">
          <Users size={24} className="text-[var(--text-muted)] opacity-60" />
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-[var(--text-secondary)]">{t('selectGroup') || '그룹을 선택하세요.'}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t('selectGroupHint') || '목록에서 확인하려는 그룹을 선택하세요.'}</p>
        </div>
      </div>
    );
  }

  const allMemberIds = members.map((m) => m.user_id);

  const handleRemoveMember = (userId: string) => {
    if (window.confirm(t('confirmRemoveMember') || '이 구성원을 그룹에서 제거하시겠습니까?')) {
      onRemoveMember(userId);
    }
  };

  return (
    <div className="flex flex-col h-full select-none overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">
      {/* 헤더 영역 */}
      <div className="relative shrink-0">
        {/* 그라데이션 배너 */}
        <div className="h-24 bg-gradient-to-r from-[var(--primary)]/20 to-[var(--primary)]/5 border-b border-[var(--border)]" />

        {/* 그룹 정보 */}
        <div className="px-6 pb-5">
          <div className="flex justify-between items-end -mt-10 mb-3">
            <div className="w-20 h-20 rounded-2xl bg-[var(--bg-surface)] p-1 shadow-sm border border-[var(--border)]">
              <div className="w-full h-full rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
                <Users size={28} className="text-[var(--primary)]" />
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-2">
              <button
                onClick={onDeleteGroup}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20 text-xs font-bold transition-colors cursor-pointer"
              >
                <Trash2 size={12} />
                {t('deleteGroup') || '그룹삭제'}
              </button>
              <div className="w-px h-4 bg-[var(--border)] mx-1" />
              <button
                onClick={onAddMembers}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--primary)] bg-[var(--primary)] text-white hover:opacity-90 text-xs font-bold transition-colors cursor-pointer"
              >
                <Edit2 size={12} />
                {t('editGroup') || '그룹 수정'}
              </button>
              <button
                onClick={() => onSendMemo(allMemberIds)}
                disabled={members.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={12} />
                {t('sendMemo') || '쪽지 보내기'}
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-[var(--text-primary)]">
              {group.name}
            </h2>
          </div>
        </div>
      </div>

      {/* 구성원 목록 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
            <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin mr-2" />
            <span className="text-xs font-medium">{t('loading') || '로딩 중...'}</span>
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)] gap-3">
            <User size={20} className="opacity-60" />
            <p className="text-xs font-medium">{t('noMembers') || '그룹에 구성원이 없습니다.'}</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-surface-2)]/50">
                <th className="p-3 pl-6 w-12">{/* avatar */}</th>
                <th className="p-3">{t('name') || '이름'}</th>
                <th className="p-3 w-1/4">{t('login') || '아이디'}</th>
                <th className="p-3 w-1/4 hidden md:table-cell">{t('email') || '이메일'}</th>
                <th className="p-3 w-16 text-center">{t('actions') || '관리'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="hover:bg-[var(--bg-surface-2)]/30 transition-colors"
                >
                  <td className="p-3 pl-6">
                    <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] border border-[var(--border)]">
                      {member.login.slice(0, 2).toUpperCase()}
                    </div>
                  </td>
                  <td className="p-3 min-w-0">
                    <span className="text-xs font-medium text-[var(--text-secondary)] truncate block">
                      {member.lastname}{member.firstname}
                    </span>
                  </td>
                  <td className="p-3 min-w-0">
                    <span className="text-xs text-[var(--text-muted)] truncate block">
                      {member.login}
                    </span>
                  </td>
                  <td className="p-3 min-w-0 hidden md:table-cell">
                    <span className="text-xs text-[var(--text-muted)] truncate block">
                      {member.email}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer border-none"
                      title={t('removeMember') || '제거'}
                    >
                      <X size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
