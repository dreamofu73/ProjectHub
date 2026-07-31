import { useMemo } from 'react';
import type { Editor } from '@tiptap/react';

export interface TableConfig {
  rows: number;
  cols: number;
  borderWidth: string;
  borderColor: string;
  backgroundColor: string;
}

type TextStyleProp = 'color' | 'fontSize' | 'fontFamily' | 'backgroundColor';

/** 에디터 명령 래퍼 모음 — 툴바 컴포넌트가 editor 인스턴스를 직접 다루지 않도록 한다. */
export function useEditorCommands(editor: Editor | null) {
  return useMemo(() => ({
    /** 선택 영역의 기존 textStyle 속성을 보존하며 한 가지 속성만 갱신 */
    applyTextStyle(prop: TextStyleProp, value: string) {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      let currentAttrs: Record<string, unknown> = {};

      editor.state.doc.nodesBetween(from, to, node => {
        const mark = node.marks.find(m => m.type.name === 'textStyle');
        if (mark) {
          currentAttrs = { ...currentAttrs, ...mark.attrs };
        }
      });

      const nextAttrs = { ...currentAttrs, [prop]: value || null };
      const hasAnyAttr = Object.values(nextAttrs).some(v => v !== null);
      if (!hasAnyAttr) {
        editor.chain().focus().unsetMark('textStyle').run();
      } else {
        editor.chain().focus().setMark('textStyle', nextAttrs).run();
      }
    },

    /** 셀 인라인 style에서 해당 속성만 교체 */
    applyCellStyle(prop: string, value: string) {
      if (!editor) return;
      const currentAttrs = editor.getAttributes('tableCell') || editor.getAttributes('tableHeader') || {};
      const currentStyle = (currentAttrs.style || '') as string;
      const regex = new RegExp(`${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:[^;]+;?`, 'g');
      const cleanStyle = currentStyle.replace(regex, '').trim();
      const separator = cleanStyle && !cleanStyle.endsWith(';') ? '; ' : '';
      const newStyle = cleanStyle ? `${cleanStyle}${separator}${prop}: ${value};` : `${prop}: ${value};`;
      editor.chain().focus().setCellAttribute('style', newStyle).run();
    },

    insertTable(rows: number, cols: number, config: TableConfig) {
      if (!editor) return;
      const { borderWidth, borderColor, backgroundColor } = config;
      const borderStyle = borderWidth !== '0px' ? `${borderWidth} solid ${borderColor}` : 'none';
      const bgStyle = backgroundColor ? `background-color: ${backgroundColor};` : '';

      let tableHTML = `<table style="border-collapse: collapse; border: ${borderStyle}; ${bgStyle}">`;
      for (let r = 0; r < rows; r++) {
        tableHTML += '<tr>';
        for (let c = 0; c < cols; c++) {
          tableHTML += `<td style="border: ${borderStyle}; padding: 8px; min-width: 50px;"><p></p></td>`;
        }
        tableHTML += '</tr>';
      }
      tableHTML += '</table>';

      editor.chain().focus().insertContent(tableHTML).run();
    },

    addRow(direction: 'before' | 'after') {
      if (!editor) return;
      if (direction === 'before') editor.chain().focus().addRowBefore().run();
      else editor.chain().focus().addRowAfter().run();
    },

    deleteRow() {
      editor?.chain().focus().deleteRow().run();
    },

    addColumn(direction: 'before' | 'after') {
      if (!editor) return;
      if (direction === 'before') editor.chain().focus().addColumnBefore().run();
      else editor.chain().focus().addColumnAfter().run();
    },

    deleteColumn() {
      editor?.chain().focus().deleteColumn().run();
    },

    deleteTable() {
      editor?.chain().focus().deleteTable().run();
    },

    mergeCells() {
      editor?.chain().focus().mergeCells().run();
    },

    splitCell() {
      editor?.chain().focus().splitCell().run();
    },

    toggleHeaderColumn() {
      editor?.chain().focus().toggleHeaderColumn().run();
    },

    toggleHeaderRow() {
      editor?.chain().focus().toggleHeaderRow().run();
    },

    /** 같은 타입을 다시 고르면 해제, 다른 타입이면 교체 */
    setOrderedListType(type: string) {
      if (!editor) return;
      if (editor.isActive('orderedList')) {
        if (editor.isActive('orderedList', { type })) {
          editor.chain().focus().toggleOrderedList().run();
        } else {
          editor.chain().focus().updateAttributes('orderedList', { type }).run();
        }
      } else {
        editor.chain().focus().toggleOrderedList().updateAttributes('orderedList', { type }).run();
      }
    },

    setBulletListStyle(style: string) {
      if (!editor) return;
      if (editor.isActive('bulletList')) {
        if (editor.isActive('bulletList', { style })) {
          editor.chain().focus().toggleBulletList().run();
        } else {
          editor.chain().focus().updateAttributes('bulletList', { style }).run();
        }
      } else {
        editor.chain().focus().toggleBulletList().updateAttributes('bulletList', { style }).run();
      }
    },
  }), [editor]);
}

export type EditorCommands = ReturnType<typeof useEditorCommands>;
