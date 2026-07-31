import React, { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';

export type PopoverKey =
  | 'heading' | 'font' | 'size' | 'color' | 'bgColor'
  | 'align' | 'list' | 'lineHeight' | 'table'
  | 'cellBg' | 'cellBorder' | 'specialChar' | 'emoji';

const POPOVER_KEYS: PopoverKey[] = [
  'heading', 'font', 'size', 'color', 'bgColor',
  'align', 'list', 'lineHeight', 'table',
  'cellBg', 'cellBorder', 'specialChar', 'emoji',
];

const CLOSED = Object.fromEntries(POPOVER_KEYS.map(k => [k, false])) as Record<PopoverKey, boolean>;

export interface PopoverApi {
  isOpen: (key: PopoverKey) => boolean;
  toggle: (key: PopoverKey) => void;
  close: (key: PopoverKey) => void;
  closeAll: () => void;
  refs: Record<PopoverKey, RefObject<HTMLDivElement | null>>;
  /** 드롭다운 메뉴 키보드 내비게이션 — ArrowUp/Down/Home/End 이동, Escape로 닫고 트리거로 포커스 복귀 */
  handleMenuKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

/**
 * 툴바 드롭다운/팝오버 13종의 열림 상태와 바깥 클릭 처리를 한곳에서 관리한다.
 * 컴포넌트마다 useState/useRef를 늘어놓지 않도록 키 기반 API를 제공한다.
 */
export function usePopovers(enabled: boolean): PopoverApi {
  const [open, setOpen] = useState<Record<PopoverKey, boolean>>(CLOSED);

  const refsRef = useRef<Record<PopoverKey, RefObject<HTMLDivElement | null>> | null>(null);
  if (!refsRef.current) {
    refsRef.current = Object.fromEntries(
      POPOVER_KEYS.map(k => [k, React.createRef<HTMLDivElement>()]),
    ) as Record<PopoverKey, RefObject<HTMLDivElement | null>>;
  }
  const refs = refsRef.current;

  const isOpen = useCallback((key: PopoverKey) => open[key], [open]);
  const toggle = useCallback((key: PopoverKey) => {
    setOpen(prev => {
      // 이미 열려있는 상태라면 닫기, 아니면 다른 모든 팝업을 닫고 현재 팝업만 열기
      if (prev[key]) return { ...CLOSED };
      return { ...CLOSED, [key]: true };
    });
  }, []);
  const close = useCallback((key: PopoverKey) => setOpen(prev => (prev[key] ? { ...prev, [key]: false } : prev)), []);
  const closeAll = useCallback(() => setOpen(prev => (POPOVER_KEYS.some(k => prev[k]) ? CLOSED : prev)), []);

  const refList = useMemo(() => POPOVER_KEYS.map(k => refs[k]), [refs]);
  useClickOutside(refList, closeAll, enabled);

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const menu = e.currentTarget;
    const items = Array.from(menu.querySelectorAll<HTMLElement>('button:not([disabled])'));
    if (items.length === 0) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAll();
      const trigger = menu.parentElement?.querySelector('button');
      trigger?.focus();
      return;
    }
    const current = document.activeElement;
    const idx = items.indexOf(current as HTMLElement);
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowDown': next = idx === -1 ? 0 : (idx + 1) % items.length; break;
      case 'ArrowUp': next = idx === -1 ? items.length - 1 : (idx - 1 + items.length) % items.length; break;
      case 'Home': next = 0; break;
      case 'End': next = items.length - 1; break;
      default: return;
    }
    e.preventDefault();
    items[next].focus();
  }, [closeAll]);

  return { isOpen, toggle, close, closeAll, refs, handleMenuKeyDown };
}
