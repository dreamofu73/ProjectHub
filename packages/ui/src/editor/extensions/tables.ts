import { Table, TableView } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { readWidthFromStyle } from '../tableStyle';

/** table/tr/td가 인라인 style 속성을 보존하도록 확장 (테두리·배경·행 높이·표 너비 저장용) */
const styleAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute('style'),
  renderHTML: (attributes: Record<string, unknown>) => {
    if (!attributes.style) return {};
    return { style: attributes.style as string };
  },
};

/**
 * Tiptap 기본 TableView는 colgroup 합계로 table의 width/min-width를 매번 덮어쓴다.
 * 그 결과 (1) 사용자가 지정한 표 너비가 지워지고 (2) min-width 탓에 표가 줄어들지 않는다.
 * 이 뷰는 갱신 때마다 style 속성을 다시 적용해 사용자가 지정한 너비가 최종 값이 되도록 한다.
 */
export class WidthAwareTableView extends TableView {
  constructor(node: PMNode, cellMinWidth: number, view?: EditorView, HTMLAttributes?: Record<string, unknown>) {
    super(node, cellMinWidth, view, HTMLAttributes);
    this.syncStyle(node);
  }

  update(node: PMNode): boolean {
    const updated = super.update(node);
    if (updated) this.syncStyle(node);
    return updated;
  }

  /** updateColumns가 계산한 너비는 사용자 지정 너비가 없을 때만 유지한다 */
  private syncStyle(node: PMNode): void {
    const style = typeof node.attrs.style === 'string' ? node.attrs.style : '';
    const computedWidth = this.table.style.width;
    const computedMinWidth = this.table.style.minWidth;

    this.table.style.cssText = style;

    const userWidth = readWidthFromStyle(style);
    if (userWidth) {
      this.table.style.width = userWidth;
      // 열 너비 합계로 계산된 min-width가 남으면 표가 지정 너비까지 줄어들지 못한다
      this.table.style.minWidth = '';
    } else {
      this.table.style.width = computedWidth;
      this.table.style.minWidth = computedMinWidth;
    }
  }
}

export const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: styleAttribute,
    };
  },
});

export const CustomTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: styleAttribute,
    };
  },
});

export const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: styleAttribute,
    };
  },
});
