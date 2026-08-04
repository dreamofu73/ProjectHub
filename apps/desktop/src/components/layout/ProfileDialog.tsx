import { useState } from 'react';
import { User as UserIcon, Eye, EyeOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from 'ui/shadcn/dialog';
import { Label } from 'ui/shadcn/label';
import { Input } from 'ui/shadcn/input';
import { Avatar, AvatarFallback } from 'ui/shadcn/avatar';
import { Separator } from 'ui/shadcn/separator';

import type { User } from 'shared/types';


interface ProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string) => string;
  user: User | null;
  initials: string;
  roleColor: string;
  roleLabel: string;
  email: string;
  setEmail: (val: string) => void;
  lastname: string;
  setLastname: (val: string) => void;
  firstname: string;
  setFirstname: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  newPasswordConfirm: string;
  setNewPasswordConfirm: (val: string) => void;
  isUpdating: boolean;
  handleSaveProfile: (e: React.FormEvent) => void;
}

export function ProfileDialog({
  isOpen,
  onOpenChange,
  t,
  user,
  initials,
  roleColor,
  roleLabel,
  email,
  setEmail,
  lastname,
  setLastname,
  firstname,
  setFirstname,
  newPassword,
  setNewPassword,
  newPasswordConfirm,
  setNewPasswordConfirm,
  isUpdating,
  handleSaveProfile
}: ProfileDialogProps) {
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl gap-0 p-0 overflow-hidden"
        showCloseButton={true}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <UserIcon size={16} className="text-primary" />
            {t('editProfile')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSaveProfile}>
          <div className="px-6 py-5 flex flex-col gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 shrink-0">
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-bold text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{user?.login}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${roleColor}`} />
                  {roleLabel}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-email" className="text-xs font-bold text-slate-700 dark:text-slate-350">{t('email')}</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@projecthub.com"
                disabled={isUpdating}
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="profile-lastname" className="text-xs font-bold text-slate-700 dark:text-slate-350">{t('lastname')}</Label>
                <Input
                  id="profile-lastname"
                  type="text"
                  value={lastname}
                  onChange={(e) => setLastname(e.target.value)}
                  placeholder="Hong"
                  disabled={isUpdating}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-firstname" className="text-xs font-bold text-slate-700 dark:text-slate-350">{t('firstname')}</Label>
                <Input
                  id="profile-firstname"
                  type="text"
                  value={firstname}
                  onChange={(e) => setFirstname(e.target.value)}
                  placeholder="Gildong"
                  disabled={isUpdating}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="profile-pwd" className="text-xs font-bold text-slate-700 dark:text-slate-350">{t('newPassword')}</Label>
                <div className="relative">
                  <Input
                    id="profile-pwd"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isUpdating}
                    className="h-9 text-sm pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 top-1.5 p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors flex items-center justify-center"
                    title={showNewPassword ? t('hidePassword') : t('showPasswordLabel')}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-pwd-confirm" className="text-xs font-bold text-slate-700 dark:text-slate-350">{t('newPasswordConfirm')}</Label>
                <div className="relative">
                  <Input
                    id="profile-pwd-confirm"
                    type={showNewPasswordConfirm ? 'text' : 'password'}
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    disabled={isUpdating}
                    className="h-9 text-sm pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPasswordConfirm(!showNewPasswordConfirm)}
                    className="absolute right-2 top-1.5 p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors flex items-center justify-center"
                    title={showNewPasswordConfirm ? t('hidePassword') : t('showPasswordLabel')}
                  >
                    {showNewPasswordConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isUpdating}
              className="flex-1 h-9 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-lg transition-all cursor-pointer border-none"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="flex-1 h-9 text-white text-sm font-semibold rounded-lg transition-all cursor-pointer border-none flex items-center justify-center gap-2"
              style={{ background: 'var(--primary)' }}
            >
              {isUpdating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('processing')}
                </>
              ) : (
                t('save')
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
