import { useState, useEffect } from 'react';
import { FolderKanban, Bug, Clock, UserCheck, Activity, ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from 'ui/Badge';
import { Button } from 'ui/Button';
import { useLanguage } from '../context/LanguageContext';
import { api } from 'shared/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from 'ui/shadcn/card';
import { ScrollArea } from 'ui/shadcn/scroll-area';
import type { Issue, DashboardActivity, ProjectSummary } from 'shared/types';

interface DashboardData {
  total_projects: number;
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
  new: '#6366f1',
  in_progress: '#3b82f6',
  resolved: '#10b981',
  feedback: '#f59e0b',
  closed: '#6b7280',
  rejected: '#ef4444',
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
          setError(json.error || '대시보드 데이터를 가져오는데 실패했습니다.');
        }
      } catch {
        setError('서버 연결 중 오류가 발생했습니다.');
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
          <div className="h-8 w-44 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-5 w-72 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-28 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-[450px] bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800" />
          <div className="flex flex-col gap-4">
            <div className="h-[120px] bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800" />
            <div className="h-[314px] bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800" />
          </div>
        </div>
        <div className="flex flex-col gap-2.5 mt-2">
          <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-28 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800" />
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
          <p className="text-destructive font-semibold">{error || '데이터를 로드할 수 없습니다.'}</p>
          <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>다시 시도</Button>
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

    const actionLabels: Record<string, Record<typeof language, string>> = {
      created:   { ko: '생성했습니다.', en: 'created.',  ja: '作成しました。', zh: '创建了。' },
      updated:   { ko: '수정했습니다.', en: 'updated.',  ja: '編集しました。', zh: '编辑了。' },
      deleted:   { ko: '삭제했습니다.', en: 'deleted.',  ja: '削除しました。', zh: '删除了。' },
      commented: { ko: '댓글을 작성했습니다.', en: 'commented on.', ja: 'コメントしました。', zh: '发表了评论。' },
      posted:    { ko: '게시글을 작성했습니다.', en: 'posted.', ja: '投稿しました。', zh: '发布了帖子。' },
      invited:   { ko: '초대했습니다.', en: 'invited.', ja: '招待しました。', zh: '邀请了。' },
    };
    const action = actionLabels[actionType]?.[language] || actionType;

    const renderText = () => {
      if (language === 'en') return (
        <><span className="font-semibold text-foreground">{user}</span> {action} <span className="font-semibold">{subject}</span>{project && <> in <Link to={`/projects/${act.project_identifier}/dashboard`} className="font-medium text-primary hover:underline">{project}</Link></>}</>
      );
      return (
        <><span className="font-semibold text-foreground">{user}</span>님이 {project && <><Link to={`/projects/${act.project_identifier}/dashboard`} className="font-medium text-primary hover:underline">{project}</Link></>}<span className="font-semibold">{subject}</span>을(를) {action}</>
      );
    };

    return (
      <div key={act.id} className="flex gap-3 py-3 group">
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/10 transition-colors">
          <Activity size={13} className="text-slate-400 group-hover:text-primary transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-slate-700 dark:text-slate-300 leading-snug">{renderText()}</div>
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
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      to: '/projects',
    },
    {
      label: t('issues'),
      value: data.total_issues,
      icon: Bug,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      to: '/issues',
    },
    {
      label: t('openIssues'),
      value: data.open_issues,
      icon: Clock,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      to: '/issues?status=new,in_progress,feedback,resolved',
    },
    {
      label: t('myTasks'),
      value: data.my_open_issues,
      icon: UserCheck,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      to: '/issues?assigned_to=me&status=new,in_progress,feedback,resolved',
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Page Header */}
      <div className="stagger-1 flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{t('dashboard')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('dashboardDesc')}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-2">
        {statCards.map((s) => (
          <Link key={s.label} to={s.to} className="no-underline group">
            <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-none hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                    <s.icon size={20} className={s.color} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-semibold leading-none">{s.label}</div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums mt-1.5 leading-none">{s.value}</div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-300 dark:text-slate-700 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Main Content (Grid & Rows) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-3">
        {/* Issue Status Card */}
        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-none rounded-xl overflow-hidden shrink-0">
          <CardHeader className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
              {t('issueStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-row items-center gap-5">
            {/* Donut chart - Left */}
            <div className="flex items-center justify-center shrink-0">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="6.5" fill="transparent" />
                  <circle
                    cx="40" cy="40" r="32"
                    className="stroke-primary transition-[stroke-dashoffset] duration-800 ease-out"
                    strokeWidth="6.5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 32}
                    strokeDashoffset={2 * Math.PI * 32 * (1 - resolveRate / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums leading-none">{resolveRate}%</span>
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
                const color = STATUS_COLORS[item.status] || '#6b7280';
                return (
                  <div key={item.status} className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-xs leading-none">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{statusLabels[item.status] || item.status}</span>
                      <span className="text-muted-foreground tabular-nums font-medium">{item.count} ({pct}%)</span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
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
        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-none rounded-xl overflow-hidden">
          <CardHeader className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">{t('recentActivities')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(!data.recent_activities || data.recent_activities.length === 0) ? (
              <div className="py-10 text-center text-sm text-muted-foreground">{t('noActivity')}</div>
            ) : (
              <ScrollArea className="max-h-[260px]">
                <div className="px-4 py-2 divide-y divide-slate-50 dark:divide-slate-800/30">
                  {data.recent_activities.map((act) => formatActivity(act))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assigned to Me Issues */}
      <div className="stagger-4">
        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-none rounded-xl overflow-hidden flex flex-col">
          <CardHeader className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between space-y-0 shrink-0">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
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
          <CardContent className="p-0 overflow-auto">
            {(!data.my_issues || data.my_issues.length === 0) ? (
              <div className="py-14 text-center text-sm text-muted-foreground">
                {t('noAssignedIssues')}
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800/40">
                {data.my_issues.map((issue) => (
                  <div key={issue.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                    <Badge variant={issue.tracker} className="shrink-0 text-xs py-0.5 px-2 h-6">{trackerLabels[issue.tracker] || issue.tracker}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground/60">#{issue.id}</span>
                        <Link
                          to={`/projects/${issue.project_identifier}/issues/${issue.id}`}
                          className="font-semibold text-slate-850 dark:text-slate-200 hover:text-primary transition-colors truncate block no-underline"
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
        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-none rounded-xl overflow-hidden">
          <CardHeader className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
              {t('activeProjects')}
              <span className="ml-1.5 text-xs font-semibold text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                {data.projects_summary?.length || 0}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {data.projects_summary.map((project) => (
                  <div
                    key={project.id}
                    className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-4 flex flex-col justify-between min-h-[130px] hover:shadow-md hover:border-primary/30 hover:bg-slate-50/40 dark:hover:bg-slate-800/20 hover:-translate-y-0.5 transition-all duration-300 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <Link to={`/projects/${project.identifier}/dashboard`} className="font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-primary transition-colors no-underline truncate max-w-[80%]">
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
                    <div className="flex justify-between items-center text-xs border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-2.5">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <span>{t('openIssues')}:</span>
                        <strong className="text-slate-900 dark:text-slate-100 font-extrabold">{project.open_issues}</strong>
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
