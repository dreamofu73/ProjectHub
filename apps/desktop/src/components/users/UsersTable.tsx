import { CheckCircle, XCircle, Key, Edit2, Trash2 } from 'lucide-react';
import { Badge } from 'ui/Badge';
import type { UserData } from 'shared/types/user';

interface UsersTableProps {
  users: UserData[];
  loading: boolean;
  onResetPassword: (user: UserData) => void;
  onEdit: (user: UserData) => void;
  onDelete: (id: string) => void;
  formatDate: (date: string) => string;
  t: (key: string) => string;
}

export function UsersTable({
  users,
  loading,
  onResetPassword,
  onEdit,
  onDelete,
  formatDate,
  t,
}: UsersTableProps) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>{t('loginId') || '아이디'}</th>
            <th>{t('firstName') || '이름'}</th>
            <th>{t('email') || '이메일'}</th>
            <th>{t('role') || '권한'}</th>
            <th>{t('status') || '상태'}</th>
            <th>{t('signupDate') || '가입일'}</th>
            <th className="w-24">{t('actions') || '작업'}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="text-center py-12">
                <div className="spinner mx-auto" />
              </td>
            </tr>
          ) : users.length > 0 ? (
            users.map((u) => (
              <tr key={u.id}>
                <td className="font-bold text-gray-900">{u.login}</td>
                <td>
                  {u.firstname} {u.lastname}
                </td>
                <td className="text-sm text-secondary">{u.email}</td>
                <td>
                  <Badge
                    variant={
                      u.role === 'admin'
                        ? 'danger'
                        : u.role === 'overseer'
                        ? 'info'
                        : 'default'
                    }
                  >
                    {u.role === 'admin'
                      ? t('admin')
                      : u.role === 'overseer'
                      ? t('overseer')
                      : t('regularUser') || '일반'}
                  </Badge>
                </td>
                <td>
                  {u.is_active === 1 ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-success">
                      <CheckCircle size={14} /> {t('activeUser') || '활성'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-muted">
                      <XCircle size={14} /> {t('inactiveUser') || '비활성'}
                    </span>
                  )}
                </td>
                <td className="text-xs text-muted">{formatDate(u.created_at)}</td>
                <td>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onResetPassword(u)}
                      title={t('resetPassword') || '비밀번호 초기화'}
                      className="p-1.5 hover:bg-gray-100 rounded border-none bg-transparent cursor-pointer text-secondary hover:text-warning transition-colors"
                    >
                      <Key size={16} />
                    </button>
                    <button
                      onClick={() => onEdit(u)}
                      title={t('edit') || '사용자 수정'}
                      className="p-1.5 hover:bg-gray-100 rounded border-none bg-transparent cursor-pointer text-secondary hover:text-primary transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(u.id)}
                      disabled={u.id === '1'}
                      className={`p-1.5 hover:bg-danger-bg rounded border-none bg-transparent cursor-pointer transition-colors ${
                        u.id === '1'
                          ? 'opacity-30 cursor-not-allowed'
                          : 'text-secondary hover:text-danger'
                      }`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="text-center py-20 text-muted">
                {t('noUsersFound') || '검색된 사용자가 없습니다.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
