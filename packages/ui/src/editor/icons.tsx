/** lucide-react에 없는 표 열/행 삭제 아이콘 */

interface EditorIconProps {
  size?: number;
  className?: string;
}

export const DeleteColumnIcon = ({ size = 14, className = '' }: EditorIconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <path d="M14 10l4 4m0-4l-4 4" />
  </svg>
);

export const DeleteRowIcon = ({ size = 14, className = '' }: EditorIconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <path d="M10 14l4 4m0-4l-4 4" />
  </svg>
);
