import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';

export interface FloatingPos {
  top: number;
  left: number;
  visible: boolean;
}

const HIDDEN: FloatingPos = { top: 0, left: 0, visible: false };
/** 표 위 44px, 링크 위 36px 지점에 플로팅 툴바를 띄운다 */
const TABLE_TOOLBAR_OFFSET = 44;
const LINK_TOOLBAR_OFFSET = 36;

interface Params {
  editor: Editor | null;
  isSourceMode: boolean;
  contentRef: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
}

/**
 * 커서 위치에 따라 표/링크 플로팅 툴바의 노출 여부와 좌표를 계산한다.
 * DOM selectionchange와 Tiptap selectionUpdate를 모두 구독해 마우스/키보드/명령 이동을 모두 반영한다.
 */
export function useEditorSelectionState({ editor, isSourceMode, contentRef, scrollRef }: Params) {
  const [isInsideTable, setIsInsideTable] = useState(false);
  const [canMerge, setCanMerge] = useState(false);
  const [canSplit, setCanSplit] = useState(false);
  const [tableToolbarPos, setTableToolbarPos] = useState<FloatingPos>(HIDDEN);
  const [activeLinkHref, setActiveLinkHref] = useState<string | null>(null);
  const [linkToolbarPos, setLinkToolbarPos] = useState<FloatingPos>(HIDDEN);

  const clearTableState = useCallback(() => {
    setIsInsideTable(false);
    setCanMerge(false);
    setCanSplit(false);
    setTableToolbarPos(HIDDEN);
  }, []);

  const clearLinkState = useCallback(() => {
    setActiveLinkHref(null);
    setLinkToolbarPos(HIDDEN);
  }, []);

  // 콘텐츠 영역 기준 상대 좌표 (스크롤 보정 포함)
  const toContentOffset = useCallback((rect: DOMRect, offsetY: number) => {
    const contentEl = contentRef.current;
    if (!contentEl) return null;
    const contentRect = contentEl.getBoundingClientRect();
    const scrollTop = scrollRef.current?.scrollTop || 0;
    return {
      top: Math.max(4, rect.top - contentRect.top + scrollTop - offsetY),
      left: rect.left - contentRect.left + rect.width / 2,
    };
  }, [contentRef, scrollRef]);

  const updateTableState = useCallback(() => {
    if (!editor) return;

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      clearTableState();
      return;
    }

    // DOM을 거슬러 올라가며 셀/표 조상을 찾는다
    const rootElement = editor.view.dom;
    let node: Node | null = domSelection.getRangeAt(0).startContainer;
    let foundTable = false;
    let tableElement: HTMLTableElement | null = null;
    while (node && node !== rootElement) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') {
        foundTable = true;
        let walk: Node | null = node;
        while (walk && walk !== rootElement) {
          if (walk.nodeName === 'TABLE') {
            tableElement = walk as HTMLTableElement;
            break;
          }
          walk = walk.parentNode;
        }
        break;
      }
      node = node.parentNode;
    }

    if (!foundTable) {
      clearTableState();
      return;
    }
    setIsInsideTable(true);

    if (tableElement) {
      const pos = toContentOffset(tableElement.getBoundingClientRect(), TABLE_TOOLBAR_OFFSET);
      if (pos) setTableToolbarPos({ top: pos.top, left: 0, visible: true });
    }

    // 다중 셀 선택(CellSelection) 여부 → 병합 가능
    const selection = editor.state.selection as { $anchorCell?: unknown };
    setCanMerge(typeof selection?.$anchorCell !== 'undefined');

    // colspan/rowspan이 있는 병합 셀 → 분할 가능
    const cellAttrs = editor.getAttributes('tableCell') || editor.getAttributes('tableHeader') || {};
    setCanSplit(Boolean((cellAttrs.colspan && cellAttrs.colspan > 1) || (cellAttrs.rowspan && cellAttrs.rowspan > 1)));
  }, [editor, clearTableState, toContentOffset]);

  const updateLinkState = useCallback(() => {
    if (!editor || isSourceMode || !editor.isActive('link')) {
      clearLinkState();
      return;
    }
    const href = editor.getAttributes('link').href as string | undefined;
    if (!href) {
      clearLinkState();
      return;
    }
    setActiveLinkHref(href);

    const sel = editor.state.selection;
    const tryClosest = (pos: number): Element | null => {
      if (pos < 0) return null;
      const { node } = editor.view.domAtPos(pos);
      return node instanceof Element ? node.closest('a') : null;
    };
    const linkEl = tryClosest(sel.$from.pos) ?? tryClosest(sel.$from.pos - 1) ?? tryClosest(sel.$to.pos) ?? null;
    const pos = linkEl ? toContentOffset(linkEl.getBoundingClientRect(), LINK_TOOLBAR_OFFSET) : null;
    setLinkToolbarPos(pos ? { ...pos, visible: true } : HIDDEN);
  }, [editor, isSourceMode, clearLinkState, toContentOffset]);

  /** 포커스가 플로팅 도구(패널 입력창 등) 안에 있는지 — 에디터 컨테이너 안이지만 본문 밖이면 우리 UI다 */
  const isFocusInFloatingUI = useCallback(() => {
    const active = document.activeElement;
    if (!active || !editor) return false;
    return !!contentRef.current?.contains(active) && !editor.view.dom.contains(active);
  }, [editor, contentRef]);

  const updateSelectionState = useCallback(() => {
    // 패널의 숫자 입력창에 포커스가 가면 selectionchange가 발생하는데, 이때 선택 상태를 갱신하면
    // 커서가 표 밖으로 나간 것으로 판정돼 도구 모음과 패널이 통째로 사라진다.
    if (isFocusInFloatingUI()) return;
    updateTableState();
    updateLinkState();
  }, [isFocusInFloatingUI, updateTableState, updateLinkState]);

  useEffect(() => {
    document.addEventListener('selectionchange', updateSelectionState);
    return () => document.removeEventListener('selectionchange', updateSelectionState);
  }, [updateSelectionState]);

  useEffect(() => {
    if (!editor) return;
    editor.on('selectionUpdate', updateSelectionState);
    return () => {
      editor.off('selectionUpdate', updateSelectionState);
    };
  }, [editor, updateSelectionState]);

  return {
    isInsideTable,
    canMerge,
    canSplit,
    tableToolbarPos,
    activeLinkHref,
    linkToolbarPos,
    clearTableState,
    clearLinkState,
  };
}
