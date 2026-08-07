/**
 * 공용 일감 상태 라벨 헬퍼.
 * 일감 상태값은 프로젝트별 커스텀 문자열(예: 'New', 'In Progress', 'Done')이므로
 * 알려진 값은 i18n 키로 변환하고, 그 외에는 원본 문자열을 그대로 보여준다.
 */
const STATUS_LABEL_KEYS: Record<string, string> = {
  new: 'new',
  open: 'new',
  backlog: 'new',
  'in progress': 'in_progress',
  in_progress: 'in_progress',
  progress: 'in_progress',
  working: 'in_progress',
  doing: 'in_progress',
  feedback: 'feedback',
  review: 'feedback',
  testing: 'feedback',
  qa: 'feedback',
  resolved: 'resolved',
  fixed: 'resolved',
  closed: 'closed',
  done: 'closed',
  completed: 'closed',
  rejected: 'rejected',
  hold: 'rejected',
  cancelled: 'rejected',
};

export function getStatusLabel(
  status: string | null | undefined,
  t: (key: string) => string,
): string {
  const key = STATUS_LABEL_KEYS[(status || '').trim().toLowerCase()];
  return key ? t(key) : status || '-';
}
