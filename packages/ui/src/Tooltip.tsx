import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  position?: 'right' | 'top' | 'bottom' | 'left';
  delay?: number;
  disabled?: boolean;
}

export function Tooltip({ children, content, position = 'right', delay = 200, disabled = false }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const showTooltip = () => {
    if (disabled) return;
    timeoutRef.current = window.setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        let top = 0;
        let left = 0;

        if (position === 'right') {
          top = rect.top + rect.height / 2;
          left = rect.right + 12;
        } else if (position === 'top') {
          top = rect.top - 8;
          left = rect.left + rect.width / 2;
        } else if (position === 'bottom') {
          top = rect.bottom + 8;
          left = rect.left + rect.width / 2;
        } else if (position === 'left') {
          top = rect.top + rect.height / 2;
          left = rect.left - 12;
        }

        setCoords({ top, left });
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Ensure tooltip hides if disabled changes to true while visible
  useEffect(() => {
    if (disabled && isVisible) {
      hideTooltip();
    }
  }, [disabled, isVisible]);

  return (
    <>
      <div 
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="flex w-full h-full"
      >
        {children}
      </div>
      
      {isVisible && createPortal(
        <div 
          className="fixed z-[9999] px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 rounded-lg shadow-xl pointer-events-none animate-fade-in"
          style={{
            top: coords.top,
            left: coords.left,
            transform: position === 'right' || position === 'left' ? 'translateY(-50%)' : 'translateX(-50%)',
          }}
        >
          {content}
          <div 
            className="absolute w-2 h-2 bg-slate-900 dark:bg-slate-800 transform rotate-45"
            style={{
              ...(position === 'right' ? { left: -4, top: 'calc(50% - 4px)' } : {}),
              ...(position === 'left' ? { right: -4, top: 'calc(50% - 4px)' } : {}),
              ...(position === 'top' ? { bottom: -4, left: 'calc(50% - 4px)' } : {}),
              ...(position === 'bottom' ? { top: -4, left: 'calc(50% - 4px)' } : {}),
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
}
