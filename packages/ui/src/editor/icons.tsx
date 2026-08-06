/**
 * lucide-react에 없는 표 행/열 편집 아이콘.
 * 모두 같은 도형 언어를 쓴다 — 표 사각형 + 편집 대상 칸을 가르는 구분선 + 동작 기호(＋ / ✕).
 * 기호가 놓인 위치가 곧 동작이 일어나는 칸이다.
 */

interface EditorIconProps {
  size?: number;
  className?: string;
}

const BASE_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** 왼쪽 칸에 ＋ — 왼쪽에 열 추가 */
export const AddColumnLeftIcon = ({ size = 14, className = '' }: EditorIconProps) => (
  <svg width={size} height={size} {...BASE_PROPS} className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <path d="M8 9.5v5M5.5 12h5" />
  </svg>
);

/** 오른쪽 칸에 ＋ — 오른쪽에 열 추가 */
export const AddColumnRightIcon = ({ size = 14, className = '' }: EditorIconProps) => (
  <svg width={size} height={size} {...BASE_PROPS} className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <path d="M16 9.5v5M13.5 12h5" />
  </svg>
);

/** 위쪽 칸에 ＋ — 위에 행 추가 */
export const AddRowAboveIcon = ({ size = 14, className = '' }: EditorIconProps) => (
  <svg width={size} height={size} {...BASE_PROPS} className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <path d="M12 5.5v5M9.5 8h5" />
  </svg>
);

/** 아래쪽 칸에 ＋ — 아래에 행 추가 */
export const AddRowBelowIcon = ({ size = 14, className = '' }: EditorIconProps) => (
  <svg width={size} height={size} {...BASE_PROPS} className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <path d="M12 13.5v5M9.5 16h5" />
  </svg>
);

/** 오른쪽 칸에 ✕ — 열 삭제 */
export const DeleteColumnIcon = ({ size = 14, className = '' }: EditorIconProps) => (
  <svg width={size} height={size} {...BASE_PROPS} className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <path d="M14 10l4 4m0-4l-4 4" />
  </svg>
);

/** 아래쪽 칸에 ✕ — 행 삭제 */
export const DeleteRowIcon = ({ size = 14, className = '' }: EditorIconProps) => (
  <svg width={size} height={size} {...BASE_PROPS} className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <path d="M10 14l4 4m0-4l-4 4" />
  </svg>
);
