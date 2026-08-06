import { TableMap } from '@tiptap/pm/tables';
import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';

/** 표를 이보다 좁게 만들 수 없다 (px) */
export const MIN_TABLE_WIDTH = 120;
/** 행을 이보다 낮게 만들 수 없다 (px) */
export const MIN_ROW_HEIGHT = 24;
/** 열을 이보다 좁게 만들 수 없다 (px) */
export const MIN_COLUMN_WIDTH = 40;

interface FoundNode {
  pos: number;
  node: PMNode;
}

/**
 * $pos에서 위로 올라가며 typeName에 맞는 조상을 찾는다.
 * $pos.before(d)는 depth d 노드의 절대 위치(setNodeMarkup에 사용 가능)를 반환한다.
 */
export function findAncestorNode($pos: ResolvedPos, typeName: string): FoundNode | null {
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === typeName) return { pos: $pos.before(d), node };
  }
  return null;
}

/** 표의 셀은 tableCell 또는 tableHeader 두 종류다 */
function findCellNode($pos: ResolvedPos): FoundNode | null {
  return findAncestorNode($pos, 'tableCell') || findAncestorNode($pos, 'tableHeader');
}

/** 커서가 놓인 표 노드 */
export function findTableNode(editor: Editor | null): FoundNode | null {
  if (!editor) return null;
  return findAncestorNode(editor.state.selection.$from, 'table');
}

/** 표 노드 위치에 대응하는 실제 DOM 요소 */
function tableElementAt(editor: Editor, tablePos: number): HTMLTableElement | null {
  const dom = editor.view.nodeDOM(tablePos);
  if (dom instanceof HTMLTableElement) return dom;
  if (dom instanceof HTMLElement) return dom.querySelector('table');
  return null;
}

/** 커서가 놓인 표의 실제 DOM 요소 */
export function findTableElement(editor: Editor | null): HTMLTableElement | null {
  const found = findTableNode(editor);
  return found && editor ? tableElementAt(editor, found.pos) : null;
}

/**
 * style 문자열을 선언 단위로 다룬다.
 * 정규식으로 `width`를 찾으면 `min-width`까지 함께 걸리기 때문에 선언을 쪼개서 이름을 정확히 비교한다.
 */
function splitDeclarations(style: unknown): string[] {
  return (typeof style === 'string' ? style : '')
    .split(';')
    .map(declaration => declaration.trim())
    .filter(Boolean);
}

function declarationName(declaration: string): string {
  return declaration.slice(0, declaration.indexOf(':')).trim().toLowerCase();
}

/** style 문자열에서 특정 속성 값만 읽는다 */
function readStyleProp(style: unknown, prop: string): string {
  const found = splitDeclarations(style).find(d => declarationName(d) === prop);
  return found ? found.slice(found.indexOf(':') + 1).trim() : '';
}

/** style 문자열에서 특정 속성들을 지우고, value가 있으면 prop을 새로 붙인다 */
function writeStyleProp(style: unknown, prop: string, value: string | null, alsoRemove: string[] = []): string {
  const drop = new Set([prop, ...alsoRemove]);
  const kept = splitDeclarations(style).filter(d => !drop.has(declarationName(d)));
  if (value) kept.push(`${prop}: ${value}`);
  return kept.length ? `${kept.join('; ')};` : '';
}

/** 표 노드 style의 width 값 (WidthAwareTableView에서도 사용) */
export function readWidthFromStyle(style: unknown): string {
  return readStyleProp(style, 'width');
}

/** '600px' → 600, 그 외('100%', 'auto', 빈 값) → null */
function parsePx(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(\d+(?:\.\d+)?)px$/i);
  return match ? Math.round(parseFloat(match[1])) : null;
}

/* ────────────────────────────── 열 너비 ──────────────────────────────
 * 열 너비는 해당 열에 속한 셀들의 style width로 저장한다.
 * Tiptap 기본 방식(colwidth 속성 + colgroup)은 sanitize 과정에서 지워져 저장·복원되지 않는다.
 * ------------------------------------------------------------------ */

export interface CellContext {
  tablePos: number;
  table: PMNode;
  /** 셀이 시작하는 열 */
  col: number;
  /** 셀이 끝나는 열 (colspan이 1이면 col과 같다) — 우측 경계 드래그 대상 */
  lastCol: number;
  columnCount: number;
}

/** 셀이 표의 몇 번째 열에 있는지 알아낸다 */
export function findCellContext(editor: Editor | null, $pos?: ResolvedPos): CellContext | null {
  if (!editor) return null;
  const at = $pos || editor.state.selection.$from;
  const cell = findCellNode(at);
  const table = findAncestorNode(at, 'table');
  if (!cell || !table) return null;

  try {
    const map = TableMap.get(table.node);
    const rect = map.findCell(cell.pos - (table.pos + 1));
    return {
      tablePos: table.pos,
      table: table.node,
      col: rect.left,
      lastCol: rect.right - 1,
      columnCount: map.width,
    };
  } catch {
    return null;
  }
}

/**
 * 한 열에 속한 셀들의 style width를 갱신한다.
 * 여러 열에 걸친 병합 셀은 특정 열의 너비를 대표할 수 없으므로 건너뛴다.
 * 명시적 너비를 줄 때는 함께 걸려 있는 min-width를 걷어낸다 — 남겨두면 그 값 아래로 줄어들지 않는다.
 */
function setColumnWidth(tr: Transaction, table: PMNode, tableStart: number, col: number, width: string | null): void {
  const map = TableMap.get(table);
  if (col < 0 || col >= map.width) return;

  const seen = new Set<number>();
  for (let row = 0; row < map.height; row++) {
    const rel = map.map[row * map.width + col];
    if (seen.has(rel)) continue;
    seen.add(rel);

    const cell = table.nodeAt(rel);
    if (!cell || ((cell.attrs.colspan as number) || 1) > 1) continue;
    tr.setNodeMarkup(tableStart + rel, undefined, {
      ...cell.attrs,
      colwidth: null,
      style: writeStyleProp(cell.attrs.style, 'width', width, width ? ['min-width'] : []),
    });
  }
}

/** 지정한 표의 특정 열 너비를 저장한다 (드래그 리사이즈용) */
export function applyColumnWidthAt(editor: Editor | null, tablePos: number, col: number, width: string | null): void {
  if (!editor || tablePos < 0) return;
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return;

  const tr = editor.state.tr;
  setColumnWidth(tr, table, tablePos + 1, col, width);
  if (tr.docChanged) editor.view.dispatch(tr);
  editor.view.focus();
}

/** 커서가 놓인 열의 너비를 저장한다 */
export function applyColumnWidth(editor: Editor | null, width: string | null): void {
  const context = findCellContext(editor);
  if (!context) return;
  applyColumnWidthAt(editor, context.tablePos, context.col, width);
}

/** 셀 style에 저장된 너비 ('' | 'NNNpx') */
export function readColumnWidth(editor: Editor | null): string {
  if (!editor) return '';
  const cell = findCellNode(editor.state.selection.$from);
  return cell ? readStyleProp(cell.node.attrs.style, 'width') : '';
}

/** 현재 렌더된 셀 너비(px) — 입력창 기본값용 */
export function measureColumnWidth(editor: Editor | null): number {
  if (!editor) return 0;
  const cell = findCellNode(editor.state.selection.$from);
  if (!cell) return 0;
  const dom = editor.view.nodeDOM(cell.pos);
  return dom instanceof HTMLElement ? Math.round(dom.getBoundingClientRect().width) : 0;
}

/* ────────────────────────────── 표 너비 ────────────────────────────── */

/** 현재 렌더된 열 너비(px)를 DOM에서 읽는다 */
function measureColumnWidths(tableEl: HTMLTableElement | null, columnCount: number): number[] {
  const widths = new Array<number>(columnCount).fill(0);
  const firstRow = tableEl?.rows?.[0];
  if (!firstRow) return widths;

  let col = 0;
  for (const cell of Array.from(firstRow.cells)) {
    const span = cell.colSpan || 1;
    const each = cell.getBoundingClientRect().width / span;
    for (let i = 0; i < span && col < columnCount; i++, col++) widths[col] = each;
  }
  return widths;
}

/** 열 하나라도 명시적 너비를 갖고 있는지 */
function hasExplicitColumnWidth(table: PMNode): boolean {
  let found = false;
  table.descendants(node => {
    if (found) return false;
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      if (readStyleProp(node.attrs.style, 'width') || node.attrs.colwidth) found = true;
    }
    return !found;
  });
  return found;
}

/** 값들의 합이 target이 되도록 비례 조정하고, 반올림 오차는 마지막 항목에서 보정한다 */
function scaleToTotal(values: number[], target: number, min: number): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!values.length || total <= 0) return [];

  const scaled = values.map(value => Math.max(min, Math.round((value * target) / total)));
  const drift = target - scaled.reduce((sum, value) => sum + value, 0);
  scaled[scaled.length - 1] = Math.max(min, scaled[scaled.length - 1] + drift);
  return scaled;
}

/** 표 style의 width를 갱신한다 — 콘텐츠에 맞춤은 'auto'로 저장한다 (지우면 .prose table의 width:100%가 이긴다) */
function writeTableWidth(tr: Transaction, table: PMNode, tablePos: number, width: string | null): void {
  tr.setNodeMarkup(tablePos, undefined, {
    ...table.attrs,
    style: writeStyleProp(table.attrs.style, 'width', width || 'auto'),
  });
}

/**
 * 열 너비를 목표 표 너비에 맞춰 비례 조정한다.
 * 열 너비를 함께 줄이지 않으면 표가 목표 너비까지 줄어들지 않는다.
 * 명시적 너비를 쓰는 열이 없으면 모두 지워 표 너비 안에서 자동 분배되게 둔다.
 */
function writeColumnWidths(
  tr: Transaction,
  table: PMNode,
  tablePos: number,
  tableEl: HTMLTableElement | null,
  targetPx: number | null,
): void {
  const map = TableMap.get(table);
  if (targetPx === null || !hasExplicitColumnWidth(table)) {
    for (let col = 0; col < map.width; col++) setColumnWidth(tr, table, tablePos + 1, col, null);
    return;
  }
  scaleToTotal(measureColumnWidths(tableEl, map.width), targetPx, MIN_COLUMN_WIDTH)
    .forEach((value, col) => setColumnWidth(tr, table, tablePos + 1, col, `${value}px`));
}

/** 행 높이를 목표 표 높이에 맞춰 비례 조정한다 */
function writeRowHeights(
  tr: Transaction,
  table: PMNode,
  tablePos: number,
  tableEl: HTMLTableElement | null,
  targetPx: number,
): void {
  const measured = tableEl ? Array.from(tableEl.rows).map(row => row.getBoundingClientRect().height) : [];
  const scaled = scaleToTotal(measured, targetPx, MIN_ROW_HEIGHT);
  if (!scaled.length) return;

  let index = 0;
  table.forEach((row, offset) => {
    const height = scaled[index++];
    if (row.type.name !== 'tableRow' || height === undefined) return;
    tr.setNodeMarkup(tablePos + 1 + offset, undefined, {
      ...row.attrs,
      style: writeStyleProp(row.attrs.style, 'height', `${height}px`),
    });
  });
}

/**
 * 표 너비를 적용한다.
 * - `'600px'`: 열 너비를 합이 목표 너비가 되도록 비례 조정한다.
 * - `'100%'` / `null`(콘텐츠에 맞춤): 열 너비를 모두 지워 열이 자동 분배되게 한다.
 */
export function applyTableWidth(editor: Editor | null, width: string | null): void {
  if (!editor) return;
  const found = findTableNode(editor);
  if (!found) return;

  const tr = editor.state.tr;
  writeTableWidth(tr, found.node, found.pos, width);
  writeColumnWidths(tr, found.node, found.pos, tableElementAt(editor, found.pos), parsePx(width));
  editor.view.dispatch(tr);
  // 패널 입력창에 있던 포커스를 본문으로 되돌려 도구 모음이 계속 표에 붙어 있게 한다
  editor.view.focus();
}

/**
 * 표 크기를 한 트랜잭션으로 적용한다 (우측 하단 코너 드래그용).
 * 너비는 열에, 높이는 행에 비례 분배되므로 되돌리기 한 번으로 원래 크기로 돌아간다.
 */
export function applyTableSizeAt(editor: Editor | null, tablePos: number, widthPx: number, heightPx: number): void {
  if (!editor || tablePos < 0) return;
  const table = editor.state.doc.nodeAt(tablePos);
  if (!table || table.type.name !== 'table') return;

  const tableEl = tableElementAt(editor, tablePos);
  const tr = editor.state.tr;
  writeTableWidth(tr, table, tablePos, `${widthPx}px`);
  writeColumnWidths(tr, table, tablePos, tableEl, widthPx);
  writeRowHeights(tr, table, tablePos, tableEl, heightPx);
  if (tr.docChanged) editor.view.dispatch(tr);
}

/** 표 style에 저장된 너비 ('' | 'auto' | '100%' | 'NNNpx') */
export function readTableWidth(editor: Editor | null): string {
  const found = findTableNode(editor);
  return found ? readWidthFromStyle(found.node.attrs.style) : '';
}

/** 현재 렌더된 표 너비(px) — 입력창 기본값용 */
export function measureTableWidth(editor: Editor | null): number {
  const tableEl = findTableElement(editor);
  return tableEl ? Math.round(tableEl.getBoundingClientRect().width) : 0;
}

/* ────────────────────────────── 행 높이 ────────────────────────────── */

/** 지정한 위치의 행 높이를 style에 저장한다 (드래그 리사이즈용) */
export function applyRowHeightAt(editor: Editor | null, rowPos: number, height: string | null): void {
  if (!editor || rowPos < 0) return;
  const row = editor.state.doc.nodeAt(rowPos);
  if (!row || row.type.name !== 'tableRow') return;

  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(rowPos, undefined, {
      ...row.attrs,
      style: writeStyleProp(row.attrs.style, 'height', height),
    }),
  );
  editor.view.focus();
}

/** 커서가 놓인 행의 높이를 style에 저장한다 */
export function applyRowHeight(editor: Editor | null, height: string | null): void {
  if (!editor) return;
  const found = findAncestorNode(editor.state.selection.$from, 'tableRow');
  if (!found) return;
  applyRowHeightAt(editor, found.pos, height);
}

/** 행 style에 저장된 높이 ('' | 'NNNpx') */
export function readRowHeight(editor: Editor | null): string {
  if (!editor) return '';
  const found = findAncestorNode(editor.state.selection.$from, 'tableRow');
  return found ? readStyleProp(found.node.attrs.style, 'height') : '';
}

/** 현재 렌더된 행 높이(px) — 입력창 기본값용 */
export function measureRowHeight(editor: Editor | null): number {
  if (!editor) return 0;
  const found = findAncestorNode(editor.state.selection.$from, 'tableRow');
  if (!found) return 0;
  const dom = editor.view.nodeDOM(found.pos);
  return dom instanceof HTMLElement ? Math.round(dom.getBoundingClientRect().height) : 0;
}
