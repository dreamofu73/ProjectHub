import { useState, useEffect } from 'react';
import { User, Mail, Calendar, Shield, Trash2, Info, BarChart3, Clock, Bug, FolderKanban, PenTool } from 'lucide-react';
import { api } from 'shared/lib/api';

interface MemberData {
  id: string;
  firstname: string;
  lastname: string;
  login: string;
  email: string;
  role: string;
  created_at: string;
}

interface MemberDetailPanelProps {
  member: MemberData | null;
  isArchived?: boolean;
  onDelete: (id: string) => void;
  formatDate: (date: string) => string;
  t: (key: string) => string;
}

export function MemberDetailPanel({
  member,
  isArchived,
  onDelete,
  formatDate,
  t,
}: MemberDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'activity'>('basic');
  const [activity, setActivity] = useState<{
    assigned_issues: number;
    created_issues: number;
    projects_count: number;
    last_activity: string | null;
  } | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    if (!member) return;
    let isMounted = true;
    setLoadingActivity(true);
    api(`/api/users/${member.id}/activity`)
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
  }, [member]);

  if (!member) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-4 select-none bg-[var(--bg-surface-2)]/20">
        <div className="w-16 h-16 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center shadow-inner border border-[var(--border)]">
          <User size={24} className="text-[var(--text-muted)] opacity-60" />
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-[var(--text-secondary)]">선택된 멤버가 없습니다.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">목록에서 확인하려는 멤버를 선택하세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full select-none bg-[var(--bg-surface)] text-[var(--text-primary)]">
      {/* ── 프로필 헤더 ── */}
      <div className="relative shrink-0">
        <div className="h-20 bg-gradient-to-r from-[var(--primary)]/20 to-[var(--primary)]/5 border-b border-[var(--border)]" />
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-10 mb-3">
            <div className="w-20 h-20 rounded-2xl bg-[var(--bg-surface)] p-1 shadow-sm border border-[var(--border)]">
              <div className="w-full h-full rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-2xl font-extrabold text-[var(--primary)]">
                {member.login.slice(0, 2).toUpperCase()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isArchived && (
                <button onClick={() => onDelete(member.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-sm font-bold transition-colors cursor-pointer">
                  <Trash2 size={14} />
                  {t('delete') || '삭제'}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">{member.firstname} {member.lastname}</span>
            <span className="text-sm text-[var(--text-muted)] font-medium">@{member.login}</span>
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
          기본 정보
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
          활동 요약
        </button>
      </div>

      {/* ── 탭 콘텐츠 ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5 custom-scrollbar">
        {activeTab === 'basic' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--bg-surface-2)]/40 p-4 rounded-xl border border-[var(--border)] flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]"><Mail size={14} /> 이메일</div>
              <span className="text-sm font-semibold text-[var(--text-primary)] truncate" title={member.email}>{member.email || '-'}</span>
            </div>
            <div className="bg-[var(--bg-surface-2)]/40 p-4 rounded-xl border border-[var(--border)] flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]"><Shield size={14} /> 권한</div>
              <span className="text-sm font-bold text-[var(--text-secondary)]">{member.role}</span>
            </div>
            <div className="bg-[var(--bg-surface-2)]/40 p-4 rounded-xl border border-[var(--border)] flex flex-col gap-1 col-span-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)]"><Calendar size={14} /> 가입일</div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{formatDate(member.created_at)}</span>
            </div>
          </div>
        ) : (
          loadingActivity ? (
            <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin" /></div>
          ) : activity ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 shrink-0"><Clock size={18} /></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--text-muted)]">최근 활동</span>
                  <span className="text-sm font-bold text-[var(--text-primary)] truncate">{activity.last_activity ? formatDate(activity.last_activity) : '기록 없음'}</span>
                </div>
              </div>
              <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-500 shrink-0"><Bug size={18} /></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--text-muted)]">할당된 이슈</span>
                  <span className="text-sm font-bold text-[var(--text-primary)] truncate">{activity.assigned_issues}개</span>
                </div>
              </div>
              <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 shrink-0"><PenTool size={18} /></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--text-muted)]">작성한 이슈</span>
                  <span className="text-sm font-bold text-[var(--text-primary)] truncate">{activity.created_issues}개</span>
                </div>
              </div>
              <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)] flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500 shrink-0"><FolderKanban size={18} /></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-[var(--text-muted)]">참여 프로젝트</span>
                  <span className="text-sm font-bold text-[var(--text-primary)] truncate">{activity.projects_count}개</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-[var(--text-muted)]">활동 정보를 불러올 수 없습니다.</div>
          )
        )}
      </div>
    </div>
  );
}
