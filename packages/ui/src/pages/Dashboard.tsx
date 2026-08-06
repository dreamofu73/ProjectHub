import { useState, useEffect } from 'react';
import { FolderKanban, Bug, Clock, UserCheck, Activity, ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { useLanguage } from 'shared/hooks/LanguageContext';
import { api } from 'shared/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../shadcn/card';
import type { Issue, DashboardActivity, ProjectSummary } from 'shared/types';

interface DashboardData {
  total_projects: number;
  active_projects: number;
  total_issues: number;
  open_issues: number;
  my_open_issues: number;
  issues_by_status: { status: string; count: number }[];
  issues_by_tracker: { tracker: string; count: number }[];
  my_issues: Issue[];
  recent_activities: DashboardActivity[];
  projects_summary: ProjectSummary[];
}

const STATUS_COLORS: Record<string, string> = {
  new: 'var(--status-new)',
  in_progress: 'var(--status-in_progress)',
  resolved: 'var(--status-resolved)',
  feedback: 'var(--status-feedback)',
  closed: 'var(--status-closed)',
  rejected: 'var(--status-rejected)',
};

export default function Dashboard() {
  const { language, formatDateTime, t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await api('/api/dashboard');
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || t('dashFetchError'));
        }
      } catch {
        setError(t('serverError'));
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="flex flex-col gap-1">
          <div className="h-8 w-44 bg-[var(--bg-surface-2)]! rounded-md" />
          <div className="h-5 w-72 bg-[var(--bg-surface-2)]! rounded-md" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-28 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
          <div className="lg:col-span-2 h-[450px] bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]" />
          <div className="flex flex-col gap-4 min-w-0">
            <div className="h-[120px] bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]" />
            <div className="h-[314px] bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]" />
          </div>
        </div>
        <div className="flex flex-col gap-2.5 mt-2">
          <div className="h-5 w-32 bg-[var(--bg-surface-2)]! rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 min-w-0">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-28 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/30 max-w-md mx-auto mt-12">
        <CardContent className="text-center py-10">
          <p className="text-destructive font-semibold">{error || t('loadDataFailed')}</p>
          <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>{t('retry')}</Button>
        </CardContent>
      </Card>
    );
  }

  const formatActivity = (act: DashboardActivity) => {
    const time = formatDateTime(act.created_at, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const user = act.user_name || act.user_login;
    const project = act.project_name ? `[${act.project_name}]` : '';
    const subject = act.subject_title;
    const actionType = act.action_type || 'created';

    // t() already resolves per language — no per-language map needed here.
    const actionKeys: Record<string, string> = {
      created: 'createdAction',
      updated: 'updatedAction',
      deleted: 'deletedAction',
      commented: 'commentedAction',
      posted: 'postedAction',
      invited: 'invitedAction',
    };
    const action = actionKeys[actionType] ? t(actionKeys[actionType]) : actionType;

    const renderText = () => {
      if (language === 'en' || language === 'es') return (
        <><span className="font-semibold text-foreground">{user}</span> {action} <span className="font-semibold">{subject}</span>{project && <> in <Link to={`/projects/${act.project_identifier}/dashboard`} className="font-medium text-primary hover:underline">{project}</Link></>}</>
      );
      return (
        <><span className="font-semibold text-foreground">{user}</span>{t('activitySubjectParticle')} {project && <><Link to={`/projects/${act.project_identifier}/dashboard`} className="font-medium text-primary hover:underline">{project}</Link></>}<span className="font-semibold">{subject}</span>{t('activityObjectParticle')} {action}</>
      );
    };

    return (
      <div key={act.id} className="flex gap-3 py-3 group">
        <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-2)]! flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/10 transition-colors">
          <Activity size={13} className="text-[var(--text-muted)] group-hover:text-primary transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[var(--text-secondary)] leading-snug">{renderText()}</div>
          <div className="text-xs text-muted-foreground mt-1">{time}</div>
        </div>
      </div>
    );
  };

  const statusLabels: Record<string, string> = {
    new: t('new'), in_progress: t('in_progress'), resolved: t('resolved'),
    feedback: t('feedback'), closed: t('closed'), rejected: t('rejected')
  };
  const trackerLabels: Record<string, string> = {
    bug: t('bug'), feature: t('feature'), task: t('task'), support: t('support'), enhancement: t('enhancement')
  };

  const resolvedClosed = data.issues_by_status
    ?.filter(i => i.status === 'resolved' || i.status === 'closed')
    ?.reduce((sum, i) => sum + i.count, 0) || 0;
  const resolveRate = data.total_issues > 0 ? Math.round((resolvedClosed / data.total_issues) * 100) : 0;

  const statCards = [
    {
      label: t('projects'),
      value: data.total_projects,
      icon: FolderKanban,
      color: 'text-[var(--primary)]',
      bg: 'bg-[var(--primary-bg)]',
      to: '/projects',
    },
    {
      label: t('issues'),
      value: data.total_issues,
      icon: Bug,
      color: 'text-[var(--primary)]',
      bg: 'bg-[var(--primary-bg)]',
      to: '/issues',
    },
    {
      label: t('openIssues'),
      value: data.open_issues,
      icon: Clock,
      color: 'text-[var(--primary)]',
      bg: 'bg-[var(--primary-bg)]',
      to: '/issues?status=new,in_progress,feedback,resolved',
    },
    {
      label: t('myTasks'),
      value: data.my_open_issues,
      icon: UserCheck,
      color: 'text-[var(--primary)]',
      bg: 'bg-[var(--primary-bg)]',
      to: '/issues?assigned_to=me&status=new,in_progress,feedback,resolved',
    },
  ];

  return (
    <div className="flex flex-col gap-5 min-w-0 overflow-hidden">
      {/* Page Header */}
      <div className="stagger-1 flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">{t('dashboard')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('dashboardDesc')}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-0 stagger-2">
        {statCards.map((s) => (
          <Link key={s.label} to={s.to} className="no-underline group">
            <Card className="border border-[var(--border)] bg-[var(--bg-surface)] shadow-none hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                    <s.icon size={20} className={s.color} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-semibold leading-none">{s.label}</div>
                    <div className="text-2xl font-black text-[var(--text-primary)] tabular-nums mt-1.5 leading-none">{s.value}</div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main Content (Grid & Rows) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0 stagger-3">
        {/* Issue Status Card */}
        <Card className="border border-[var(--border)] bg-[var(--bg-surface)] shadow-none rounded-xl overflow-hidden min-w-0">
          <CardHeader className="px-4 py-3.5 border-b border-[var(--border)]">
            <CardTitle className="text-sm font-bold text-[var(--text-primary)]">
              {t('issueStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-row items-center gap-5">
            {/* Donut chart - Left */}
            <div className="flex items-center justify-center shrink-0">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" className="stroke-[var(--border)]" strokeWidth="6.5" fill="transparent" />
                  {(() => {
                    const C = 2 * Math.PI * 32;
                    let accumulated = 0;
                    return data.issues_by_status
                      ?.filter(item => item.count > 0)
                      .map(item => {
                        const segLen = (item.count / data.total_issues) * C;
                        const offset = -accumulated;
                        accumulated += segLen;
                        return (
                          <circle
                            key={item.status}
                            cx="40" cy="40" r="32"
                            stroke={STATUS_COLORS[item.status]}
                            strokeWidth="6.5"
                            fill="transparent"
                            strokeDasharray={`${segLen} ${C}`}
                            strokeDashoffset={offset}
                            strokeLinecap="butt"
                          />
                        );
                      });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black text-[var(--text-primary)] tabular-nums leading-none">{resolveRate}%</span>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider leading-none mt-1 flex items-center gap-0.5">
                    <TrendingUp size={10} />
                    {t('resolveRate')}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bars - Right */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              {data.issues_by_status?.map((item) => {
                const pct = data.total_issues > 0 ? Math.round((item.count / data.total_issues) * 100) : 0;
                const color = STATUS_COLORS[item.status] || 'var(--status-closed)';
                return (
                  <div key={item.status} className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-xs leading-none">
                      <span className="font-semibold text-[var(--text-secondary)]">{statusLabels[item.status] || item.status}</span>
                      <span className="text-muted-foreground tabular-nums font-medium">{item.count} ({pct}%)</span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-2)]!">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border border-[var(--border)] bg-[var(--bg-surface)] shadow-none rounded-xl overflow-hidden">
          <CardHeader className="px-4 py-3.5 border-b border-[var(--border)]">
            <CardTitle className="text-sm font-bold text-[var(--text-primary)]">{t('recentActivities')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(!data.recent_activities || data.recent_activities.length === 0) ? (
              <div className="py-10 text-center text-sm text-muted-foreground">{t('noActivity')}</div>
            ) : (
              <div className="overflow-y-auto custom-scrollbar max-h-[340px]">
                <div className="px-4 py-2 divide-y divide-[var(--border)]">
                  {data.recent_activities.map((act) => formatActivity(act))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assigned to Me Issues */}
      <div className="stagger-4">
        <Card className="border border-[var(--border)] bg-[var(--bg-surface)] shadow-none rounded-xl overflow-hidden flex flex-col">
          <CardHeader className="px-4 py-3.5 border-b border-[var(--border)] flex flex-row items-center justify-between space-y-0 shrink-0">
            <CardTitle className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              {t('assignedToMeIssues')}
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {data.my_issues?.length || 0}
              </span>
            </CardTitle>
            <Link to="/issues" className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors no-underline">
              {t('viewAll')}
              <ArrowRight size={13} />
            </Link>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto custom-scrollbar">
            {(!data.my_issues || data.my_issues.length === 0) ? (
              <div className="py-14 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--primary-bg)] text-[var(--primary)] mb-4">
                  <UserCheck size={24} />
                </div>
                <p className="text-[var(--text-primary)] font-semibold text-sm">{t('noAssignedIssues')}</p>
                <p className="text-[var(--text-muted)] text-xs mt-1 max-w-xs mx-auto">{t('noAssignedIssuesDesc')}</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {data.my_issues.map((issue) => (
                  <div key={issue.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-surface-2)]/60! transition-colors group">
                    <Badge variant={issue.tracker} className="shrink-0 text-xs py-0.5 px-2 h-6">{trackerLabels[issue.tracker] || issue.tracker}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground/60">#{issue.id}</span>
                        <Link
                          to={`/projects/${issue.project_identifier}/issues/${issue.id}`}
                          className="font-semibold text-[var(--text-primary)] hover:text-primary transition-colors truncate block no-underline"
                        >
                          {issue.subject}
                        </Link>
                      </div>
                      <span className="text-xs text-muted-foreground leading-none mt-0.5 block">{issue.project_name}</span>
                    </div>
                    <Badge variant={issue.status} className="shrink-0 text-xs py-0.5 px-2 h-6">{statusLabels[issue.status] || issue.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Active Projects (Full Width) */}
      <div className="stagger-5 mt-2">
        <Card className="border border-[var(--border)] bg-[var(--bg-surface)] shadow-none rounded-xl overflow-hidden">
          <CardHeader className="px-4 py-3.5 border-b border-[var(--border)] flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold text-[var(--text-primary)]">
              {t('activeProjects')}
              <span className="ml-1.5 text-xs font-semibold text-muted-foreground bg-[var(--bg-surface-2)]! px-2 py-0.5 rounded">
                {data.active_projects ?? data.projects_summary?.length ?? 0}
              </span>
            </CardTitle>
            <Link to="/projects" className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors no-underline">
              {t('viewAll')}
              <ArrowRight size={13} />
            </Link>
          </CardHeader>
          <CardContent className="p-4">
            {(!data.projects_summary || data.projects_summary.length === 0) ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t('noActiveProjects')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 min-w-0">
                {data.projects_summary.map((project) => (
                  <div
                    key={project.id}
                    className="border border-[var(--border)] bg-[var(--bg-surface)] rounded-xl p-4 flex flex-col justify-between min-h-[130px] hover:shadow-md hover:border-primary/30 hover:bg-[var(--bg-surface-2)]/60! hover:-translate-y-0.5 transition-all duration-300 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <Link to={`/projects/${project.identifier}/dashboard`} className="font-bold text-sm text-[var(--text-primary)] hover:text-primary transition-colors no-underline truncate max-w-[80%]">
                          {project.name}
                        </Link>
                        <Badge variant="outline" className="text-xs py-0 px-1.5 hover:bg-transparent shrink-0">
                          {project.identifier}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 min-h-[32px] leading-relaxed">
                        {project.description || t('noDescription')}
                      </p>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-[var(--border)] pt-2.5 mt-2.5">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <span>{t('openIssues')}:</span>
                        <strong className="text-[var(--text-primary)] font-extrabold">{project.open_issues}</strong>
                      </span>
                      <Link to={`/projects/${project.identifier}/dashboard`} className="font-bold text-primary flex items-center gap-0.5 no-underline group-hover:translate-x-0.5 transition-transform">
                        {t('goTo')} <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
