import { Link } from 'react-router-dom';
import { AlertCircle, Calendar, User } from 'lucide-react';
import { Badge } from 'ui/Badge';

import type { Issue } from 'shared/types';

interface IssuesCardViewProps {
  issues: Issue[];
  selectedIssues: string[];
  onSelectIssue: (id: string) => void;
  onOpenDetail?: (issue: Issue) => void;
  selectedIssueId?: string | null;
  projectId?: string;
  formatDate: (date: string, options?: Intl.DateTimeFormatOptions) => string;
  t: (key: string) => string;
  isOverdue: (date: string | null) => boolean;
  isDueSoon: (date: string | null) => boolean;
  getAvatarColor: (name: string) => string;
  getInitials: (name: string) => string;
  TRACKER_CONFIG: Record<string, { emoji: string; color: string }>;
  PRIORITY_CONFIG: Record<string, { color: string; label: string }>;
  STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string }>;
  trackerLabels: Record<string, string>;
  priorityLabels: Record<string, string>;
  statusLabels: Record<string, string>;
}

export function IssuesCardView({
  issues,
  selectedIssues,
  onSelectIssue,
  projectId,
  formatDate,
  t,
  isOverdue,
  isDueSoon,
  getAvatarColor,
  getInitials,
  TRACKER_CONFIG,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  trackerLabels,
  priorityLabels,
  statusLabels,
  onOpenDetail,
  selectedIssueId,
}: IssuesCardViewProps) {
  return (
    <div className="p-4 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
      {issues.map((issue, idx) => {
        const overdue = isOverdue(issue.due_date) && issue.status !== 'closed' && issue.status !== 'resolved';
        const dueSoon = isDueSoon(issue.due_date) && issue.status !== 'closed' && issue.status !== 'resolved';
        const trackerCfg = TRACKER_CONFIG[issue.tracker] || { emoji: '•', color: '#6b7280' };
        const priorityCfg = PRIORITY_CONFIG[issue.priority] || { color: '#6b7280', label: issue.priority };
        const statusCfg = STATUS_CONFIG[issue.status] || { color: '#6b7280', bg: 'transparent', dot: '#6b7280' };
        const isSelected = selectedIssues.includes(issue.id);
        const isDetailSelected = selectedIssueId === issue.id;

        return (
          <div
            key={issue.id}
            onClick={onOpenDetail ? () => onOpenDetail(issue) : undefined}
            className={`relative overflow-hidden p-4 rounded-[14px] cursor-pointer transition-all duration-200 hover:shadow-md border ${
              isSelected || isDetailSelected
                ? 'bg-indigo-50/10 border-indigo-500/30 dark:bg-indigo-950/10 dark:border-indigo-500/30' 
                : overdue 
                  ? 'bg-[var(--bg-surface)] border-red-500/20' 
                  : 'bg-[var(--bg-surface)] border-[var(--border)]'
            }`}
            style={{
              animation: `slideUpFade 0.3s ease ${idx * 0.04}s both`,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* 상태 컬러 바 */}
            <div 
              className="absolute top-0 left-0 w-[3px] h-full rounded-[14px_0_0_14px]" 
              style={{ background: statusCfg.color }} 
            />

            <div className="pl-2">
              {/* 헤더 */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[0.72rem] font-bold text-[var(--text-muted)] font-mono">
                    #{issue.id}
                  </span>
                  <span className="text-[0.72rem] font-bold" style={{ color: trackerCfg.color }}>
                    {trackerCfg.emoji} {trackerLabels[issue.tracker] || issue.tracker}
                  </span>
                  {!projectId && (
                    <Link
                      to={`/projects/${issue.project_identifier}/dashboard`}
                      className="text-[0.72rem] font-semibold text-[var(--text-muted)] bg-[var(--bg-surface-2)] px-1.75 py-0.5 rounded-full border border-[var(--border)]"
                    >
                      {issue.project_name}
                    </Link>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => { e.stopPropagation(); onSelectIssue(issue.id); }}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-[var(--primary)] shrink-0"
                />
              </div>

              {/* 제목 */}
              {onOpenDetail ? (
                <span className="text-[0.9rem] font-semibold text-[var(--text-primary)] block mb-2.5 leading-relaxed">
                  {issue.subject}
                </span>
              ) : (
                <Link
                  to={`/projects/${issue.project_identifier}/issues/${issue.id}`}
                  className="text-[0.9rem] font-semibold text-[var(--text-primary)] block mb-2.5 leading-relaxed hover:text-[var(--primary)]"
                >
                  {issue.subject}
                </Link>
              )}

              {/* 하단 메타 */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant={issue.status}>
                    {statusLabels[issue.status] || issue.status}
                  </Badge>
                  <span className="flex items-center gap-1 text-[0.72rem] font-semibold" style={{ color: priorityCfg.color }}>
                    <span className="w-1.25 h-1.25 rounded-full inline-block" style={{ background: priorityCfg.color }} />
                    {priorityLabels[issue.priority] || issue.priority}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {issue.due_date && (
                    <span className={`text-[0.72rem] font-semibold flex items-center gap-0.75 ${
                      overdue ? 'text-[var(--danger)]' : dueSoon ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'
                    }`}>
                      {overdue ? <AlertCircle size={11} /> : <Calendar size={11} />}
                      {formatDate(issue.due_date, { month: 'numeric', day: 'numeric' })}
                    </span>
                  )}
                  {issue.assigned_name ? (
                    <div className="flex items-center gap-1.25">
                      <span 
                        className="w-5.5 h-5.5 rounded-full flex items-center justify-center text-white text-[0.6rem] font-bold"
                        style={{ background: getAvatarColor(issue.assigned_name) }}
                      >
                        {getInitials(issue.assigned_name)}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">{issue.assigned_name}</span>
                    </div>
                  ) : (
                    <span className="text-[0.72rem] text-[var(--text-muted)] flex items-center gap-0.75">
                      <User size={11} className="opacity-50" /> {t('unassigned')}
                    </span>
                  )}
                </div>
              </div>

              {/* 수정일 */}
              <div className="mt-2 text-[0.7rem] text-[var(--text-muted)]">
                {t('updatedAtFormat').replace('{date}', formatDate(issue.updated_at, { year: 'numeric', month: 'numeric', day: 'numeric' }))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
