/**
 * 공용 상태 배지 컴포넌트.
 * 테이블/상세/간트 차트에서 상태별 색상을 단일 소스로 통일하기 위해 사용한다.
 * 상태값은 프로젝트별 커스텀 문자열일 수 있으므로 알려진 키는 컬러 매핑,
 * 그 외에는 기본 회색으로 폴백한다.
 */
const statusColors: Record<string, { bg: string; border: string; text: string }> = {
  new: { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' },
  in_progress: { bg: '#fff3e0', border: '#ff9800', text: '#e65100' },
  resolved: { bg: '#f3e5f5', border: '#9c27b0', text: '#6a1b9a' },
  closed: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },
  default: { bg: '#f5f5f5', border: '#9e9e9e', text: '#424242' },
};

export function getStatusColor(status: string | null | undefined): { bg: string; border: string; text: string } {
  return statusColors[(status || '').toLowerCase()] || statusColors.default;
}

interface TaskStatusBadgeProps {
  status?: string | null;
  className?: string;
}

export function TaskStatusBadge({ status, className = '' }: TaskStatusBadgeProps) {
  const colors = getStatusColor(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}
      style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
    >
      {status || '-'}
    </span>
  );
}
