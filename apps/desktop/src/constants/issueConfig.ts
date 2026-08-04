// 공유 이슈 설정: 색상, 아이콘, 헬퍼 — i18n label은 컴포넌트에서 t()로 처리

export const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  new:         { color: '#6366f1', bg: 'rgba(99,102,241,0.08)',  dot: '#6366f1' },
  in_progress: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', dot: '#3b82f6' },
  resolved:    { color: '#10b981', bg: 'rgba(16,185,129,0.08)', dot: '#10b981' },
  feedback:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', dot: '#f59e0b' },
  closed:      { color: '#6b7280', bg: 'rgba(107,114,128,0.08)',dot: '#6b7280' },
  rejected:    { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  dot: '#ef4444' },
};

export const PRIORITY_CONFIG: Record<string, { color: string; labelKey: string }> = {
  low:       { color: '#94a3b8', labelKey: 'low' },
  normal:    { color: '#3b82f6', labelKey: 'normal' },
  high:      { color: '#f59e0b', labelKey: 'high' },
  urgent:    { color: '#ef4444', labelKey: 'urgent' },
  immediate: { color: '#7c3aed', labelKey: 'immediate' },
};

export const TRACKER_CONFIG: Record<string, { emoji: string; color: string }> = {
  bug:         { emoji: '🐛', color: '#ef4444' },
  feature:     { emoji: '✨', color: '#8b5cf6' },
  task:        { emoji: '✅', color: '#3b82f6' },
  support:     { emoji: '💬', color: '#f59e0b' },
  enhancement: { emoji: '⚡', color: '#10b981' },
};

export const AVATAR_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#3b82f6','#10b981','#f59e0b','#ef4444','#14b8a6',
];

export function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name: string) {
  const parts = name.split(' ');
  return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

export function isOverdue(due_date: string | null) {
  if (!due_date) return false;
  return new Date(due_date) < new Date();
}

export function isDueSoon(due_date: string | null) {
  if (!due_date) return false;
  const d = new Date(due_date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
}

export const TRACKER_LABEL_KEYS: Record<string, string> = {
  bug: 'bug',
  feature: 'feature',
  task: 'task',
  support: 'support',
  enhancement: 'enhancement',
};

export const STATUS_LABEL_KEYS: Record<string, string> = {
  new: 'new',
  in_progress: 'in_progress',
  resolved: 'resolved',
  feedback: 'feedback',
  closed: 'closed',
  rejected: 'rejected',
};

export const PRIORITY_LABEL_KEYS: Record<string, string> = {
  low: 'low',
  normal: 'normal',
  high: 'high',
  urgent: 'urgent',
  immediate: 'immediate',
};

/** PRIORITY_CONFIG with i18n labels resolved. Call from a component that has t(). */
export function buildPriorityConfig(
  t: (key: string) => string
): Record<string, { color: string; label: string }> {
  return Object.fromEntries(
    Object.entries(PRIORITY_CONFIG).map(([k, v]) => [k, { ...v, label: t(v.labelKey) }])
  );
}
