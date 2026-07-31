import { useEffect } from 'react';
import type { Editor } from '@tiptap/react';

const RESIZE_HANDLE_PX = 5;
const MIN_ROW_HEIGHT = 24;

/**
 * 표 셀 하단 경계를 드래그해 행 높이를 조절하고, 결과를 tableRow의 style 속성에 저장한다.
 * Tiptap 기본 확장은 열 리사이즈만 제공하므로 행은 직접 DOM 이벤트로 처리한다.
 */
export function useTableRowResize(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;
    let resizingRow: HTMLTableRowElement | null = null;

    const isNearBottomEdge = (target: HTMLElement, clientY: number) => {
      const rect = target.getBoundingClientRect();
      return rect.bottom - clientY <= RESIZE_HANDLE_PX && rect.bottom - clientY >= -1;
    };

    const isCell = (target: EventTarget | null): target is HTMLElement => {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === 'TD' || el.tagName === 'TH');
    };

    const handleDomMouseMove = (e: MouseEvent) => {
      if (isResizing) return;
      if (!isCell(e.target)) return;
      e.target.style.cursor = isNearBottomEdge(e.target, e.clientY) ? 'row-resize' : '';
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!isCell(e.target)) return;
      if (!isNearBottomEdge(e.target, e.clientY)) return;
      e.preventDefault();
      isResizing = true;
      startY = e.clientY;
      resizingRow = e.target.parentElement as HTMLTableRowElement;
      startHeight = resizingRow.getBoundingClientRect().height;
      document.body.style.cursor = 'row-resize';
    };

    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizingRow) return;
      const newHeight = Math.max(MIN_ROW_HEIGHT, startHeight + (e.clientY - startY));
      resizingRow.style.height = `${newHeight}px`;
    };

    const handleDocumentMouseUp = () => {
      if (!isResizing || !resizingRow) return;
      isResizing = false;
      document.body.style.cursor = '';

      const newHeight = resizingRow.style.height;
      try {
        const pos = editor.view.posAtDOM(resizingRow, 0);
        const nodePos = pos - 1;
        const node = editor.view.state.doc.nodeAt(nodePos);
        if (node && node.type.name === 'tableRow') {
          const currentStyle = (node.attrs.style as string) || '';
          const cleanStyle = currentStyle.replace(/\bheight\s*:[^;]+;?/gi, '').trim();
          const newStyle = cleanStyle ? `${cleanStyle}; height: ${newHeight};` : `height: ${newHeight};`;
          editor.view.dispatch(editor.view.state.tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, style: newStyle }));
        }
      } catch (err) {
        console.error('Failed to save row height', err);
      }
      resizingRow = null;
    };

    dom.addEventListener('mousemove', handleDomMouseMove);
    dom.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      dom.removeEventListener('mousemove', handleDomMouseMove);
      dom.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [editor]);
}
