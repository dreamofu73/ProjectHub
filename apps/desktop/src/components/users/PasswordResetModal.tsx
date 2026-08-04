import { Key, X, EyeOff, Eye, Save } from 'lucide-react';
import { Button } from 'ui/Button';
import { Input } from 'ui/Input';
import type { UserData } from 'shared/types/user';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface PasswordResetModalProps {
  currentUser: Partial<UserData>;
  password?: string;
  setPassword?: (password: string) => void;
  showPassword?: boolean;
  setShowPassword?: (show: boolean) => void;
  error: string;
  onClose: () => void;
  onSubmit: () => void;
  t: (key: string) => string;
}

export function PasswordResetModal({
  currentUser,
  password = '',
  setPassword,
  showPassword = false,
  setShowPassword,
  error,
  onClose,
  onSubmit,
  t,
}: PasswordResetModalProps) {
  const containerRef = useFocusTrap(true);

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
        className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-zoom-in flex flex-col max-h-[70vh]"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Key size={20} className="text-amber-500" />
              {t('resetPassword')}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full border-none bg-transparent cursor-pointer text-slate-500 dark:text-slate-400"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mb-4">
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('targetUser')}
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100">
              <span className="font-bold">{currentUser.login}</span> ({currentUser.firstname}{' '}
              {currentUser.lastname})
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg mb-4 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            {setPassword && setShowPassword && (
              <Input
                label={t('newPassword')}
                type={showPassword ? 'text' : 'password'}
                placeholder={t('enterNewPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                autoFocus
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border-none bg-transparent cursor-pointer text-slate-500 dark:text-slate-400 transition-colors flex items-center justify-center"
                    title={
                      showPassword
                        ? t('hidePassword')
                        : t('showPasswordLabel')
                    }
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            )}

            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={onClose} fullWidth>
                {t('cancel')}
              </Button>
              <Button
                variant="warning"
                icon={Save}
                onClick={onSubmit}
                fullWidth
                disabled={!password}
              >
                {t('runReset')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
