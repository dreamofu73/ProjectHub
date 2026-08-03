// 공유 이슈 설정: 색상, 아이콘, 헬퍼 — i18n label은 컴포넌트에서 t()로 처리

export const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  new:         { color: '#4f46e5', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.25)',  dot: '#6366f1' },
  in_progress: { color: '#2563eb', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)',  dot: '#3b82f6' },
  resolved:    { color: '#059669', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)',  dot: '#10b981' },
  feedback:    { color: '#d97706', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  dot: '#f59e0b' },
  closed:      { color: '#475569', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)', dot: '#64748b' },
  rejected:    { color: '#dc2626', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.25)',   dot: '#ef4444' },
};

export const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  low:       { color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)', label: '낮음' },
  normal:    { color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.2)',   label: '보통' },
  high:      { color: '#d97706', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.2)',   label: '높음' },
  urgent:    { color: '#dc2626', bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.2)',   label: '긴급' },
  immediate: { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  border: 'rgba(124,58,237,0.2)',  label: '즉시' },
};

export const TRACKER_CONFIG: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
  bug:         { emoji: '🐛', color: '#e11d48', bg: 'rgba(225,29,72,0.08)',   border: 'rgba(225,29,72,0.22)' },
  feature:     { emoji: '✨', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  border: 'rgba(124,58,237,0.22)' },
  task:        { emoji: '✅', color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.22)' },
  support:     { emoji: '💬', color: '#d97706', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.22)' },
  enhancement: { emoji: '⚡', color: '#059669', bg: 'rgba(5,150,105,0.08)',   border: 'rgba(5,150,105,0.22)' },
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
