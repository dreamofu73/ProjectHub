import { UserPlus, Edit2, X, EyeOff, Eye, Save, Building2 } from 'lucide-react';
import { Button } from 'ui/Button';
import { Input, Select } from 'ui/Input';
import type { UserData } from 'shared/types/user';
import { useFocusTrap } from '../../hooks/useFocusTrap';


interface UserModalProps {
  showModal: 'create' | 'edit';
  currentUser: Partial<UserData>;
  setCurrentUser: (user: Partial<UserData>) => void;
  password?: string;
  setPassword?: (password: string) => void;
  showPassword?: boolean;
  setShowPassword?: (show: boolean) => void;
  error: string;
  onClose: () => void;
  onSubmit: () => void;
  t: (key: string) => string;
  departments: { id: string; name: string; parent_id: string | null; parent_name: string | null; description: string }[];
  organizationName: string;
}

export function UserModal({
  showModal,
  currentUser,
  setCurrentUser,
  password = '',
  setPassword,
  showPassword = false,
  setShowPassword,
  error,
  onClose,
  onSubmit,
  t,
  departments,
  organizationName,
}: UserModalProps) {
  const containerRef = useFocusTrap(!!showModal);

  return (
    <div className="fixed inset-0 z-[999] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal Body */}
      <div 
        ref={containerRef}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-zoom-in flex flex-col max-h-[70vh]"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {showModal === 'create' ? (
                <UserPlus size={20} className="text-primary" />
              ) : (
                <Edit2 size={20} className="text-primary" />
              )}
              {showModal === 'create'
                ? t('addNewUser') || '새 사용자 추가'
                : t('editUserInfo') || '사용자 정보 수정'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full border-none bg-transparent cursor-pointer text-slate-500 dark:text-slate-400"
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <Input
              label={t('loginId') || '아이디'}
              value={currentUser.login || ''}
              onChange={(e) =>
                setCurrentUser({ ...currentUser, login: e.target.value })
              }
              disabled={showModal === 'edit'}
              required
              fullWidth
            />
            <Input
              label={t('email') || '이메일'}
              value={currentUser.email || ''}
              onChange={(e) =>
                setCurrentUser({ ...currentUser, email: e.target.value })
              }
              required
              fullWidth
            />
            {showModal === 'create' && setPassword && setShowPassword && (
              <Input
                label={t('password') || '비밀번호'}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border-none bg-transparent cursor-pointer text-slate-500 dark:text-slate-400 transition-colors flex items-center justify-center"
                    title={
                      showPassword
                        ? t('hidePassword') || '비밀번호 숨기기'
                        : t('showPasswordLabel') || '비밀번호 보기'
                    }
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('firstNameLabel') || '이름(First)'}
                value={currentUser.firstname || ''}
                onChange={(e) =>
                  setCurrentUser({ ...currentUser, firstname: e.target.value })
                }
              />
              <Input
                label={t('lastNameLabel') || '성(Last)'}
                value={currentUser.lastname || ''}
                onChange={(e) =>
                  setCurrentUser({ ...currentUser, lastname: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('role') || '권한'}
                </label>
                <Select
                  required
                  value={currentUser.role}
                  onChange={(e) =>
                    setCurrentUser({
                      ...currentUser,
                      role: e.target.value as any,
                    })
                  }
                  options={[
                    { value: 'user', label: t('regularUser') || '일반 사용자' },
                    {
                      value: 'overseer',
                      label: t('overseer') || '프로젝트 감시자',
                    },
                    { value: 'admin', label: t('admin') || '시스템 관리자' },
                  ]}
                  fullWidth
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('status') || '상태'}
                </label>
                <Select
                  required
                  value={currentUser.is_active?.toString()}
                  onChange={(e) =>
                    setCurrentUser({
                      ...currentUser,
                      is_active: Number(e.target.value),
                    })
                  }
                  options={[
                    { value: '1', label: t('activeUser') || '활성' },
                    { value: '0', label: t('inactiveUser') || '비활성' },
                  ]}
                  fullWidth
                />
              </div>
            </div>

            {/* 조직 정보 */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3">
                <Building2 size={14} /> 조직 정보
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">조직</label>
                  <input
                    type="text"
                    value={organizationName}
                    disabled
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">부서</label>
                  <select
                    value={currentUser.department_id?.toString() || ''}
                    onChange={(e) =>
                      setCurrentUser({
                        ...currentUser,
                        department_id: e.target.value ? e.target.value : null,
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    <option value="">부서 없음</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={onClose} fullWidth>
                {t('cancel') || '취소'}
              </Button>
              <Button icon={Save} onClick={onSubmit} fullWidth>
                {showModal === 'create'
                  ? t('submitAdd') || '추가하기'
                  : t('submitUpdate') || '수정완료'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
