import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight,
  IndentDecrease, IndentIncrease, List as ListIcon, MoveVertical,
} from 'lucide-react';
import { BULLET_LIST_STYLES, LINE_HEIGHTS, ORDERED_LIST_TYPES } from '../constants';
import { MENU_PANEL_CLASS, ToolbarButton } from './ToolbarButton';
import type { ToolbarGroupProps } from './types';

type Props = Pick<ToolbarGroupProps, 'editor' | 'labels' | 'commands' | 'popovers'>;

const ALIGNMENTS = [
  { value: 'left', Icon: AlignLeft },
  { value: 'center', Icon: AlignCenter },
  { value: 'right', Icon: AlignRight },
  { value: 'justify', Icon: AlignJustify },
] as const;

const SMALL_TOGGLE_CLASS = 'w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800';
const ACTIVE_TOGGLE_CLASS = 'bg-slate-100 dark:bg-slate-800 text-indigo-500 font-bold';

/** 정렬 / 리스트 / 들여쓰기 / 줄간격 */
export function ParagraphGroup({ editor, labels, commands, popovers }: Props) {
  const activeAlign = ALIGNMENTS.find(a => editor?.isActive({ textAlign: a.value }));
  const ActiveAlignIcon = activeAlign?.Icon ?? AlignLeft;
  const hasList = editor?.isActive('bulletList') || editor?.isActive('orderedList') || editor?.isActive('taskList');

  return (
    <div className="flex items-center gap-0.5 border-r border-border pr-2">
      {/* 정렬 */}
      <div className="relative" ref={popovers.refs.align}>
        <button
          type="button"
          onClick={() => popovers.toggle('align')}
          className="flex items-center justify-center h-7 px-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 gap-0.5"
          title={labels.align}
          aria-label={labels.align}
          aria-haspopup="menu"
          aria-expanded={popovers.isOpen('align')}
        >
          <ActiveAlignIcon size={14} className={activeAlign ? 'text-indigo-500' : ''} />
        </button>
        {popovers.isOpen('align') && (
          <div className={`${MENU_PANEL_CLASS} left-0 dark:border-slate-700 shadow-lg p-1 flex flex-col gap-0.5`} onKeyDown={popovers.handleMenuKeyDown}>
            {ALIGNMENTS.map(({ value, Icon }) => {
              const isActive = !!editor?.isActive({ textAlign: value });
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => { editor?.chain().focus().setTextAlign(value).run(); popovers.close('align'); }}
                  className={`w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${isActive ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500' : ''}`}
                  aria-pressed={isActive}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 리스트 */}
      <div className="relative" ref={popovers.refs.list}>
        <button
          type="button"
          onClick={() => popovers.toggle('list')}
          className="flex items-center justify-center h-7 px-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 gap-0.5"
          title={labels.list}
          aria-label={labels.list}
          aria-haspopup="menu"
          aria-expanded={popovers.isOpen('list')}
        >
          <ListIcon size={14} className={hasList ? 'text-indigo-500' : ''} />
        </button>
        {popovers.isOpen('list') && (
          <div className={`${MENU_PANEL_CLASS} left-0 dark:border-slate-700 shadow-lg p-2 flex flex-col gap-2 w-max`} onKeyDown={popovers.handleMenuKeyDown}>
            <div className="flex items-center gap-1">
              {ORDERED_LIST_TYPES.map(({ type, glyph, title }) => (
                <button
                  key={type}
                  type="button"
                  title={title}
                  className={`${SMALL_TOGGLE_CLASS} ${editor?.isActive('orderedList', { type }) ? ACTIVE_TOGGLE_CLASS : ''}`}
                  onClick={() => { commands.setOrderedListType(type); popovers.close('list'); }}
                >
                  <span className="text-xs font-serif">{glyph}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center gap-1">
              {BULLET_LIST_STYLES.map(({ style, glyph, title, glyphClass }) => (
                <button
                  key={style}
                  type="button"
                  title={title}
                  className={`${SMALL_TOGGLE_CLASS} ${editor?.isActive('bulletList', { style }) ? ACTIVE_TOGGLE_CLASS : ''}`}
                  onClick={() => { commands.setBulletListStyle(style); popovers.close('list'); }}
                >
                  <span className={glyphClass}>{glyph}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-border" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={SMALL_TOGGLE_CLASS}
                onClick={() => { editor?.chain().focus().clearNodes().run(); popovers.close('list'); }}
                title={labels.none}
                aria-label={labels.none}
              >
                <span className="text-xs font-bold text-slate-400">Ø</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ToolbarButton onClick={() => editor?.chain().focus().outdent().run()} title={labels.outdent}>
        <IndentDecrease size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor?.chain().focus().indent().run()} title={labels.indent}>
        <IndentIncrease size={14} />
      </ToolbarButton>

      {/* 줄간격 */}
      <div className="relative" ref={popovers.refs.lineHeight}>
        <button
          type="button"
          onClick={() => popovers.toggle('lineHeight')}
          className="flex items-center justify-center h-7 px-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 gap-0.5"
          title={labels.lineHeight}
          aria-label={labels.lineHeight}
          aria-haspopup="menu"
          aria-expanded={popovers.isOpen('lineHeight')}
        >
          <MoveVertical size={14} />
        </button>
        {popovers.isOpen('lineHeight') && (
          <div className={`${MENU_PANEL_CLASS} left-0 dark:border-slate-700 shadow-lg p-1 flex flex-col gap-0.5 w-24`} onKeyDown={popovers.handleMenuKeyDown}>
            {LINE_HEIGHTS.map(lh => (
              <button
                key={lh}
                type="button"
                onClick={() => { editor?.chain().focus().setLineHeight(lh).run(); popovers.close('lineHeight'); }}
                className={`w-full text-left px-3 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive({ lineHeight: lh }) ? ACTIVE_TOGGLE_CLASS : ''}`}
              >
                {lh}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
