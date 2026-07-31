import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TableHeader } from '@tiptap/extension-table-header';
import { Indent } from '../../IndentExtension';
import { LineHeight } from '../../LineHeightExtension';
import { CustomStyle } from './CustomStyle';
import { CustomOrderedList, CustomBulletList } from './lists';
import { CustomTable, CustomTableRow, CustomTableCell } from './tables';

// --- 커스텀 Indent 확장 커맨드 타입 보강 ---
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

/** HTMLEditor가 사용하는 Tiptap 확장 세트 (placeholder는 인스턴스마다 다름) */
export const buildExtensions = (placeholder: string) => [
  StarterKit.configure({
    orderedList: false,
    bulletList: false,
    link: false,
    underline: false,
  }),
  Placeholder.configure({
    placeholder,
  }),
  CustomOrderedList,
  CustomBulletList,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Indent,
  LineHeight,
  Underline,
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      class: 'text-indigo-600 hover:text-indigo-800 underline',
      rel: 'noopener noreferrer',
    },
  }),
  Image,
  CustomStyle,
  CustomTable.configure({
    resizable: true,
    HTMLAttributes: {
      class: 'border-collapse table-auto',
    },
  }),
  CustomTableRow,
  TableHeader,
  CustomTableCell,
];

export { CustomStyle } from './CustomStyle';
export { CustomOrderedList, CustomBulletList } from './lists';
export { CustomTable, CustomTableRow, CustomTableCell } from './tables';
