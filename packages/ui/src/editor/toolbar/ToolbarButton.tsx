import type { CSSProperties, ReactNode } from 'react';

const BASE_CLASS = 'w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors';

interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  /** 생략하면 title을 aria-label로 사용 */
  label?: string;
  pressed?: boolean;
  expanded?: boolean;
  haspopup?: 'menu' | 'dialog';
  disabled?: boolean;
  /** 클릭 시 에디터 선택 영역이 풀리지 않도록 mousedown 기본동작 차단 */
  keepSelection?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** 툴바의 정사각 아이콘 버튼 공통 셸 */
export function ToolbarButton({
  onClick,
  title,
  label,
  pressed,
  expanded,
  haspopup,
  disabled,
  keepSelection = false,
  className = '',
  style,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={keepSelection ? (e) => e.preventDefault() : undefined}
      onClick={onClick}
      className={`${BASE_CLASS} ${className}`}
      style={style}
      title={title}
      aria-label={label ?? title}
      aria-pressed={pressed}
      aria-haspopup={haspopup}
      aria-expanded={haspopup ? expanded : undefined}
    >
      {children}
    </button>
  );
}

/** 드롭다운 패널 공통 스타일 — 그림자/테두리 변형은 호출부에서 덧붙인다 */
export const MENU_PANEL_CLASS = 'absolute left-0 mt-1 bg-white dark:bg-slate-900 border border-border rounded z-30';
