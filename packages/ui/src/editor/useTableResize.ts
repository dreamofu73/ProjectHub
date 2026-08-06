import { useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
  MIN_COLUMN_WIDTH,
  MIN_ROW_HEIGHT,
  MIN_TABLE_WIDTH,
  applyColumnWidthAt,
  applyRowHeightAt,
  applyTableSizeAt,
  findAncestorNode,
  findCellContext,
} from './tableStyle';

/** 셀 경계에서 이 거리 안쪽이면 리사이즈 영역으로 본다 (px) */
const RESIZE_HANDLE_PX = 6;
/**
 * 표 우측 하단 코너의 판정 범위 (px).
 * 바깥쪽은 넉넉히 잡아 경계선을 겨냥해도 걸리게 하고, 안쪽은 좁게 잡아
 * 마지막 셀에서 글자를 클릭하려는 조작을 빼앗지 않는다.
 */
const CORNER_INSIDE_PX = 8;
const CORNER_OUTSIDE_PX = 12;

/** row: 행 높이(셀 하단), column: 열 너비(셀 우측), table: 표 전체(표 우측 하단 코너) */
type Axis = 'row' | 'column' | 'table';

const CURSORS: Record<Axis, string> = {
  row: 'row-resize',
  column: 'col-resize',
  table: 'nwse-resize',
};

/**
 * 표 경계를 드래그해 크기를 조절하고, 결과를 style 속성에 저장한다.
 * - 셀 하단 → 행 높이 (tr의 height)
 * - 셀 우측 → 열 너비 (해당 열 셀들의 width)
 * - 표 우측 하단 코너 → 표 전체 크기 (표의 width + 행 높이 비례 분배)
 *
 * 드래그 중에는 ProseMirror가 관리하는 DOM(td/tr)을 건드리지 않는다. 셀의 style을 직접 바꾸면
 * ProseMirror의 MutationObserver가 해당 노드를 dirty로 표시해 다시 그리면서 미리보기가 지워지기 때문에,
 * 뷰포트에 고정된 가이드만 움직이고 실제 크기는 마우스를 뗄 때 트랜잭션으로 한 번에 반영한다.
 */
export function useTableResize(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;

    let guide: HTMLDivElement | null = null;
    let axis: Axis | null = null;
    /** 드래그 시작 좌표와 시작 크기 */
    let origin = { x: 0, y: 0 };
    let startWidth = 0;
    let startHeight = 0;
    let minWidth = MIN_COLUMN_WIDTH;
    let minHeight = MIN_ROW_HEIGHT;
    /** 커밋 대상 — 행이면 rowPos, 열/표면 tablePos(+col) */
    let rowPos = -1;
    let tablePos = -1;
    let col = -1;
    /** 가이드를 놓을 기준 좌표 (행이면 행 사각형, 열이면 셀 좌상단 + 표 높이, 표면 표 사각형) */
    let anchor = { left: 0, top: 0, width: 0, height: 0 };

    const isCell = (target: EventTarget | null): target is HTMLElement => {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === 'TD' || el.tagName === 'TH');
    };

    const within = (distance: number, limit: number) => distance <= limit && distance >= -1;

    /**
     * 코너에 걸린 표를 찾는다. 셀에는 안쪽 여백이 있어 커서가 문단 위에 놓이는 경우가 많고
     * 경계 바깥을 겨냥하기도 하므로, 이벤트 대상이 아니라 표의 사각형 좌표로 직접 판정한다.
     */
    const nearCornerEdge = (distance: number) => distance <= CORNER_INSIDE_PX && distance >= -CORNER_OUTSIDE_PX;

    const cornerTable = (e: MouseEvent): HTMLTableElement | null => {
      for (const table of Array.from(dom.querySelectorAll('table'))) {
        const rect = table.getBoundingClientRect();
        if (nearCornerEdge(rect.right - e.clientX) && nearCornerEdge(rect.bottom - e.clientY)) return table;
      }
      return null;
    };

    /** 셀 경계 판정 — 행(하단)이 열(우측)보다 우선이다 */
    const cellEdgeAxis = (cell: HTMLElement, e: MouseEvent): Axis | null => {
      const rect = cell.getBoundingClientRect();
      if (within(rect.bottom - e.clientY, RESIZE_HANDLE_PX)) return 'row';
      if (within(rect.right - e.clientX, RESIZE_HANDLE_PX)) return 'column';
      return null;
    };

    const resolveCell = (cell: HTMLElement) => {
      try {
        return editor.state.doc.resolve(editor.view.posAtDOM(cell, 0));
      } catch {
        return null;
      }
    };

    const nextWidth = (e: MouseEvent) => Math.max(minWidth, Math.round(startWidth + (e.clientX - origin.x)));
    const nextHeight = (e: MouseEvent) => Math.max(minHeight, Math.round(startHeight + (e.clientY - origin.y)));

    /** 행/열은 2px 선, 표는 바뀔 크기를 보여주는 사각형 테두리로 표시한다 */
    const drawGuide = (width: number, height: number) => {
      if (!guide) {
        guide = document.createElement('div');
        guide.style.cssText = 'position:fixed; z-index:50; pointer-events:none; box-sizing:border-box;';
        document.body.appendChild(guide);
      }
      const outline = axis === 'table';
      guide.style.background = outline ? 'transparent' : 'rgb(99 102 241)';
      guide.style.border = outline ? '2px solid rgb(99 102 241)' : 'none';
      guide.style.left = `${axis === 'column' ? anchor.left + width : anchor.left}px`;
      guide.style.top = `${axis === 'row' ? anchor.top + height : anchor.top}px`;
      guide.style.width = `${axis === 'row' ? anchor.width : axis === 'column' ? 2 : width}px`;
      guide.style.height = `${axis === 'column' ? anchor.height : axis === 'row' ? 2 : height}px`;
    };

    const removeGuide = () => {
      guide?.remove();
      guide = null;
    };

    const startRowResize = (cell: HTMLElement): boolean => {
      const $pos = resolveCell(cell);
      const row = cell.closest('tr');
      const found = $pos && findAncestorNode($pos, 'tableRow');
      if (!row || !found) return false;

      const rect = row.getBoundingClientRect();
      rowPos = found.pos;
      startHeight = rect.height;
      minHeight = MIN_ROW_HEIGHT;
      anchor = { left: rect.left, top: rect.top, width: rect.width, height: 0 };
      return true;
    };

    const startColumnResize = (cell: HTMLElement): boolean => {
      const $pos = resolveCell(cell);
      const context = $pos && findCellContext(editor, $pos);
      const table = cell.closest('table');
      if (!context || !table) return false;

      const cellRect = cell.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      tablePos = context.tablePos;
      col = context.lastCol;
      startWidth = cellRect.width;
      minWidth = MIN_COLUMN_WIDTH;
      anchor = { left: cellRect.left, top: tableRect.top, width: 0, height: tableRect.height };
      return true;
    };

    /** 표 위치는 첫 셀에서 거슬러 올라가 얻는다 — 표 요소는 노드 뷰 안쪽이라 좌표를 직접 풀기 어렵다 */
    const startTableResize = (table: HTMLTableElement): boolean => {
      const cell = table.querySelector('td, th');
      const $pos = cell instanceof HTMLElement ? resolveCell(cell) : null;
      const context = $pos && findCellContext(editor, $pos);
      if (!context) return false;

      const rect = table.getBoundingClientRect();
      tablePos = context.tablePos;
      startWidth = rect.width;
      startHeight = rect.height;
      minWidth = MIN_TABLE_WIDTH;
      minHeight = MIN_ROW_HEIGHT * Math.max(1, table.rows.length);
      anchor = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      return true;
    };

    /** 커서 변경은 에디터 루트에만 적용한다 — 루트의 속성 변경은 ProseMirror가 무시한다 */
    const handleDomMouseMove = (e: MouseEvent) => {
      if (axis) return;
      const hovered = cornerTable(e) ? 'table' : isCell(e.target) ? cellEdgeAxis(e.target, e) : null;
      dom.style.cursor = hovered ? CURSORS[hovered] : '';
    };

    const handleDomMouseLeave = () => {
      if (!axis) dom.style.cursor = '';
    };

    const handleMouseDown = (e: MouseEvent) => {
      // 표 코너가 셀 경계보다 우선한다 — 마지막 셀에서는 둘이 겹친다
      const corner = cornerTable(e);
      const nextAxis: Axis | null = corner ? 'table' : isCell(e.target) ? cellEdgeAxis(e.target, e) : null;
      if (!nextAxis) return;

      const started =
        nextAxis === 'table' ? startTableResize(corner as HTMLTableElement)
        : nextAxis === 'row' ? startRowResize(e.target as HTMLElement)
        : startColumnResize(e.target as HTMLElement);
      if (!started) return;

      e.preventDefault();
      axis = nextAxis;
      origin = { x: e.clientX, y: e.clientY };
      document.body.style.cursor = CURSORS[nextAxis];
      drawGuide(startWidth, startHeight);
    };

    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!axis) return;
      drawGuide(nextWidth(e), nextHeight(e));
    };

    /** 드래그 상태와 커서를 원상복구한다 — 커밋 여부와 무관하게 항상 거쳐야 하는 경로다 */
    const endDrag = () => {
      const finished = axis;
      axis = null;
      document.body.style.cursor = '';
      dom.style.cursor = '';
      removeGuide();
      return finished;
    };

    const handleDocumentMouseUp = (e: MouseEvent) => {
      if (!axis) return;
      const width = nextWidth(e);
      const height = nextHeight(e);
      const finished = endDrag();

      if (finished === 'row') applyRowHeightAt(editor, rowPos, `${height}px`);
      else if (finished === 'column') applyColumnWidthAt(editor, tablePos, col, `${width}px`);
      else applyTableSizeAt(editor, tablePos, width, height);

      rowPos = -1;
      tablePos = -1;
      col = -1;
      // mousedown에서 preventDefault로 포커스 이동을 막았으므로 여기서 되돌려준다 — 안 하면 글자 커서가 사라진다
      editor.view.focus();
    };

    /** 창 밖에서 버튼을 떼면 mouseup이 오지 않는다 — 그대로 두면 리사이즈 커서가 남는다 */
    const handleWindowBlur = () => {
      if (axis) endDrag();
    };

    dom.addEventListener('mousemove', handleDomMouseMove);
    dom.addEventListener('mousedown', handleMouseDown);
    dom.addEventListener('mouseleave', handleDomMouseLeave);
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      dom.removeEventListener('mousemove', handleDomMouseMove);
      dom.removeEventListener('mousedown', handleMouseDown);
      dom.removeEventListener('mouseleave', handleDomMouseLeave);
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
      endDrag();
    };
  }, [editor]);
}
