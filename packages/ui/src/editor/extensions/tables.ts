import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';

/** table/tr/td가 인라인 style 속성을 보존하도록 확장 (테두리·배경·행 높이 저장용) */
const styleAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute('style'),
  renderHTML: (attributes: Record<string, unknown>) => {
    if (!attributes.style) return {};
    return { style: attributes.style as string };
  },
};

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
