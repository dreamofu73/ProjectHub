import { CheckCircle, XCircle, User, CheckSquare, Square, Minus, Shield, Eye } from 'lucide-react';
import type { UserData } from 'shared/types/user';

interface UserListProps {
  users: UserData[];
  loading: boolean;
  selectedUserId: string | null;
  onSelectUser: (user: UserData) => void;
  selectedIds: Set<string>;
  toggleSelectRow: (id: string, e: React.MouseEvent) => void;
  toggleSelectAll: () => void;
  t: (key: string) => string;
}

export function UserList({
  users,
  loading,
  selectedUserId,
  onSelectUser,
  selectedIds,
  toggleSelectRow,
  toggleSelectAll,
  t,
}: UserListProps) {
  const formatShortDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-[var(--text-muted)]">
        <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin mx-auto mb-2" />
        <p className="font-medium text-xs">로딩 중...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="py-24 text-center text-[var(--text-muted)] font-medium text-xs">
        {t('noUsersFound') || '검색된 사용자가 없습니다.'}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar select-none">
      <table className="w-full text-left border-collapse table-fixed">
        <thead>
          <tr className="border-b border-[var(--border)] text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-surface-2)]/50">
            <th className="w-10 p-2 text-center">
              <div 
                className="flex items-center justify-center cursor-pointer p-1 rounded hover:bg-[var(--bg-surface-2)]"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelectAll();
                }}
                title={users.length > 0 && users.every(u => selectedIds.has(u.id)) ? '선택해제' : '전체선택'}
              >
                {users.length > 0 && users.every(u => selectedIds.has(u.id)) ? (
                  <CheckSquare size={14} className="text-[var(--primary)]" />
                ) : users.some(u => selectedIds.has(u.id)) ? (
                  <Minus size={14} className="text-[var(--primary)]" />
                ) : (
                  <Square size={14} className="text-[var(--text-muted)] opacity-60" />
                )}
              </div>
            </th>
            <th className="p-2 pl-2 text-xs font-semibold text-[var(--text-muted)]">이름</th>
            <th className="p-2 text-xs font-semibold text-[var(--text-muted)]">아이디</th>
            <th className="w-16 p-2 text-center text-xs font-semibold text-[var(--text-muted)]">권한</th>
            <th className="w-16 p-2 text-center text-xs font-semibold text-[var(--text-muted)]">상태</th>
            <th className="w-24 p-2 text-right pr-4 text-xs font-semibold text-[var(--text-muted)]">등록일</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {users.map((u) => {
            const isSelected = selectedUserId === u.id;
            const isChecked = selectedIds.has(u.id);
            return (
              <tr
                key={u.id}
                onClick={() => onSelectUser(u)}
                className={`hover:bg-[var(--bg-surface-2)]/50 cursor-pointer transition-colors ${
                  isSelected ? 'bg-[var(--primary)]/10' : ''
                }`}
              >
                <td className="p-2 text-center" onClick={(e) => toggleSelectRow(u.id, e)}>
                  <div className="flex items-center justify-center">
                    {isChecked ? (
                      <CheckSquare size={14} className="text-[var(--primary)]" />
                    ) : (
                      <Square size={14} className="text-[var(--text-muted)] opacity-65" />
                    )}
                  </div>
                </td>
                <td className="p-2 pl-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] border border-[var(--border)] shrink-0">
                      {u.login.slice(0, 2).toUpperCase()}
                    </div>
                    <span className={`text-xs truncate ${isSelected ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)] font-medium'}`}>
                      {u.firstname} {u.lastname}
                    </span>
                  </div>
                </td>
                <td className="p-2 min-w-0">
                  <span className="text-xs text-[var(--text-secondary)] truncate block">
                    {u.login}
                  </span>
                </td>

                <td className="p-2">
                  <div className="flex items-center justify-center" title={u.role === 'admin' ? t('admin') : u.role === 'overseer' ? t('overseer') : t('regularUser') || '일반'}>
                    {u.role === 'admin' ? (
                      <Shield size={14} className="text-rose-500" />
                    ) : u.role === 'overseer' ? (
                      <Eye size={14} className="text-blue-500" />
                    ) : (
                      <User size={14} className="text-[var(--text-secondary)]" />
                    )}
                  </div>
                </td>

                <td className="p-2">
                  <div className="flex items-center justify-center" title={u.is_active === 1 ? t('activeUser') || '활성' : t('inactiveUser') || '비활성'}>
                    {u.is_active === 1 ? (
                      <CheckCircle size={14} className="text-emerald-500" />
                    ) : (
                      <XCircle size={14} className="text-[var(--text-muted)]" />
                    )}
                  </div>
                </td>

                <td className="p-2 pr-4 text-right">
                  <span className="text-xs text-[var(--text-muted)] font-medium">
                    {formatShortDate(u.created_at)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
