import type { Editor } from '@tiptap/react';
import type { HTMLEditorLabels } from '../labels';
import type { PopoverApi } from '../usePopovers';
import type { EditorCommands } from '../useEditorCommands';

/** 모든 툴바 그룹이 공유하는 props */
export interface ToolbarGroupProps {
  editor: Editor | null;
  labels: HTMLEditorLabels;
  commands: EditorCommands;
  popovers: PopoverApi;
  disabled: boolean;
  isSourceMode: boolean;
}

/** 셀렉트형 트리거 버튼 공통 클래스 (스타일/글꼴/크기 콤보) */
export const SELECT_TRIGGER_CLASS = 'flex items-center justify-between gap-1.5 px-2 py-1 h-8 text-xs rounded border border-border bg-white dark:bg-slate-950 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer';

/** 드롭다운 항목 공통 클래스 */
export const MENU_ITEM_CLASS = 'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-none bg-transparent';

export const activeTextClass = (isActive: boolean) =>
  isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-foreground';
