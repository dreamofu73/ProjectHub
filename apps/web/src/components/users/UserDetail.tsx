import { useState, useEffect } from 'react';
import { User, Mail, Calendar, Shield, Edit2, Key, Trash2, CheckCircle, XCircle, Clock, Bug, FolderKanban, PenTool, Building2, Info, BarChart3 } from 'lucide-react';
import { api } from 'shared/lib/api';
import type { UserData } from 'shared/types/user';

interface UserDetailProps {
  user: UserData | null;
  onEdit: (user: UserData) => void;
  onResetPassword: (user: UserData) => void;
  onDelete: (id: string) => void;
  formatDate: (date: string) => string;
  t: (key: string) => string;
}

export function UserDetail({
  user,
  onEdit,
  onResetPassword,
  onDelete,
  formatDate,
  t,
}: UserDetailProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'activity'>('basic');
  const [activity, setActivity] = useState<{
    assigned_issues: number;
    created_issues: number;
    projects_count: number;
    last_activity: string | null;
  } | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    setLoadingActivity(true);
    api(`/api/users/${user.id}/activity`)
      .then(res => res.json())
      .then(json => {
        if (isMounted && json.success) {
          setActivity(json.data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => {
        if (isMounted) setLoadingActivity(false);
      });
    return () => { isMounted = false; };
  }, [user]);

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-4 select-none bg-[var(--bg-surface-2)]/20">
        <div className="w-16 h-16 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center shadow-inner border border-[var(--border)]">
          <User size={24} className="text-[var(--text-muted)] opacity-60" />
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-[var(--text-secondary)]">{t('noUserSelected')}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t('selectUserHint')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full select-none bg-[var(--bg-surface)] text-[var(--text-primary)]">
      {/* ── 프로필 헤더 ── */}
      <div className="relative shrink-0">
        {/* 배경 배너 */}
        <div className="h-20 bg-gradient-to-r from-[var(--primary)]/20 to-[var(--primary)]/5 border-b border-[var(--border)]" />

        {/* 아바타 + 이름 + 액션 */}
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-10 mb-3">
            <div className="w-20 h-20 rounded-2xl bg-[var(--bg-surface)] p-1 shadow-sm border border-[var(--border)]">
              <div className="w-full h-full rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-2xl font-extrabold text-[var(--primary)]">
                {user.login.slice(0, 2).toUpperCase()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onEdit(user)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] text-sm font-bold transition-colors cursor-pointer">
                <Edit2 size={14} />
                {t('edit')}
              </button>
              <button onClick={() => onResetPassword(user)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] text-sm font-bold transition-colors cursor-pointer">
                <Key size={14} />
                {t('password')}
              </button>
              <button onClick={() => onDelete(user.id)} disabled={user.id === '1'} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                <Trash2 size={14} />
                {t('delete')}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">{user.firstname} {user.lastname}</span>
            {user.is_active === 1 ? (
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold"><CheckCircle size={12} /> {t('active')}</span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold"><XCircle size={12} /> {t('inactive')}</span>
            )}
            <span className="text-sm text-[var(--text-muted)] font-medium">@{user.login}</span>
          </div>
        </div>
      </div>

      {/* ── 탭 ── */}
      <div className="flex gap-1 px-6 pt-3 pb-0 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/10">
        <button
          onClick={() => setActiveTab('basic')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-xs font-bold transition-all -mb-px ${
            activeTab === 'basic'
              ? 'text-[var(--primary)] bg-[var(--bg-surface)] border border-[var(--border)] border-b-[var(--bg-surface)]'
              : 'text-[var(--text-muted)] border border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]/60'
          }`}
        >
          <Info size={14} />
          {t('basicInfo')}
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-xs font-bold transition-all -mb-px ${
            activeTab === 'activity'
              ? 'text-[var(--primary)] bg-[var(--bg-surface)] border border-[var(--border)] border-b-[var(--bg-surface)]'
              : 'text-[var(--text-muted)] border border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]/60'
          }`}
        >
          <BarChart3 size={14} />
          {t('activitySummary')}
        </button>
      </div>

      {/* ── 탭 콘텐츠 ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5 custom-scrollbar">
        {activeTab === 'basic' ? (
          /* 기본 정보 */
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--bg-surface-2)]/40 p-4 rounded-xl border border-[var(--border)] flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]"><Mail size={14} /> {t('email')}</div>
              <span className="text-sm font-semibold text-[var(--text-primary)] truncate" title={user.email}>{user.email || '-'}</span>
            </div>
            <div className="bg-[var(--bg-surface-2)]/40 p-4 rounded-xl border border-[var(--border)] flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]"><Shield size={14} /> {t('permission')}</div>
              <span className={`text-sm font-bold ${user.role === 'admin' ? 'text-rose-500' : user.role === 'overseer' ? 'text-blue-500' : 'text-[var(--text-secondary)]'}`}>
                {user.role === 'admin' ? t('admin') : user.role === 'overseer' ? t('overseer') : t('regularUser')}
              </span>
            </div>
            <div className="bg-[var(--bg-surface-2)]/40 p-4 rounded-xl border border-[var(--border)] flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]"><Building2 size={14} /> {t('organization')}</div>
              <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{user.organization_name || '-'}</span>
            </div>
            <div className="bg-[var(--bg-surface-2)]/40 p-4 rounded-xl border border-[var(--border)] flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]"><Building2 size={14} /> {t('department')}</div>
              <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{user.department_name || '-'}</span>
            </div>
            <div className="bg-[var(--bg-surface-2)]/40 p-4 rounded-xl border border-[var(--border)] flex flex-col gap-1 col-span-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]"><Calendar size={14} /> {t('signupDate')}</div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{formatDate(user.created_at)}</span>
            </div>
          </div>
        ) : (
          /* 활동 요약 */
          loadingActivity ? (
            <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin" /></div>
          ) : activity ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 shrink-0"><Clock size={18} /></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--text-muted)]">{t('recentActivities')}</span>
                  <span className="text-sm font-bold text-[var(--text-primary)] truncate">{activity.last_activity ? formatDate(activity.last_activity) : t('noHistory')}</span>
                </div>
              </div>
              <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500 shrink-0"><Bug size={18} /></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--text-muted)]">{t('assignedIssues')}</span>
                  <span className="text-sm font-bold text-[var(--text-primary)] truncate">{t('countItems').replace('{count}', String(activity.assigned_issues))}</span>
                </div>
              </div>
              <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 shrink-0"><PenTool size={18} /></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--text-muted)]">{t('authoredIssues')}</span>
                  <span className="text-sm font-bold text-[var(--text-primary)] truncate">{t('countItems').replace('{count}', String(activity.created_issues))}</span>
                </div>
              </div>
              <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500 shrink-0"><FolderKanban size={18} /></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--text-muted)]">{t('joinedProjects')}</span>
                  <span className="text-sm font-bold text-[var(--text-primary)] truncate">{t('countItems').replace('{count}', String(activity.projects_count))}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-[var(--text-muted)]">{t('activityLoadError')}</div>
          )
        )}
      </div>
    </div>
  );
}
