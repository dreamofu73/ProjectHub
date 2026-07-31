import {
  BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart,
  PaintBucket, Paintbrush, TableCellsMerge, TableCellsSplit, TableColumnsSplit, TableRowsSplit, Trash2,
} from 'lucide-react';
import { ColorSwatches } from './ColorSwatches';
import { EDITOR_COLORS } from './constants';
import { DeleteColumnIcon, DeleteRowIcon } from './icons';
import { ToolbarButton } from './toolbar/ToolbarButton';
import type { HTMLEditorLabels } from './labels';
import type { PopoverApi } from './usePopovers';
import type { EditorCommands } from './useEditorCommands';
import type { FloatingPos } from './useEditorSelectionState';

interface Props {
  labels: HTMLEditorLabels;
  commands: EditorCommands;
  popovers: PopoverApi;
  visible: boolean;
  position: FloatingPos;
  canMerge: boolean;
  canSplit: boolean;
  onDeleteTable: () => void;
}

const NEUTRAL_CLASS = 'text-slate-600 dark:text-slate-400';
const DANGER_CLASS = 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 text-red-500';
const Divider = () => <div className="w-px h-4 bg-border mx-0.5" />;

/** 커서가 표 안에 있을 때 표 위에 뜨는 플로팅 도구 모음 */
export function TableFloatingToolbar({
  labels, commands, popovers, visible, position, canMerge, canSplit, onDeleteTable,
}: Props) {
  const toggleClass = (enabled: boolean) =>
    `disabled:opacity-30 disabled:cursor-not-allowed ${enabled ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40' : 'text-slate-500 dark:text-slate-400'}`;

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 z-20 transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
      }`}
      style={{ top: `${position.top}px` }}
    >
      <div className="flex items-center gap-0.5 px-2 py-1 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-lg ring-1 ring-black/5 dark:ring-white/10 select-none whitespace-nowrap">
        <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px] mr-1 tracking-wide pl-1 whitespace-nowrap">{labels.tableTools}</span>

        {/* 셀 병합/분할 */}
        <ToolbarButton keepSelection onClick={commands.mergeCells} disabled={!canMerge} title={labels.mergeCells} className={toggleClass(canMerge)}>
          <TableCellsMerge size={12} />
        </ToolbarButton>
        <ToolbarButton keepSelection onClick={commands.splitCell} disabled={!canSplit} title={labels.splitCell} className={toggleClass(canSplit)}>
          <TableCellsSplit size={12} />
        </ToolbarButton>

        <Divider />

        {/* 헤더 토글 */}
        <ToolbarButton keepSelection onClick={commands.toggleHeaderColumn} title={labels.toggleHeaderColumn} className={NEUTRAL_CLASS}>
          <TableColumnsSplit size={12} />
        </ToolbarButton>
        <ToolbarButton keepSelection onClick={commands.toggleHeaderRow} title={labels.toggleHeaderRow} className={NEUTRAL_CLASS}>
          <TableRowsSplit size={12} />
        </ToolbarButton>

        <Divider />

        {/* 셀 배경/테두리 색 */}
        <div className="relative" ref={popovers.refs.cellBg}>
          <ToolbarButton
            onClick={() => popovers.toggle('cellBg')}
            title={labels.cellBackgroundColor}
            haspopup="dialog"
            expanded={popovers.isOpen('cellBg')}
            className={NEUTRAL_CLASS}
          >
            <PaintBucket size={12} />
          </ToolbarButton>
          {popovers.isOpen('cellBg') && (
            <ColorSwatches
              colors={EDITOR_COLORS}
              labels={labels}
              includeNone
              onSelect={(c) => { commands.applyCellStyle('background-color', c); popovers.close('cellBg'); }}
            />
          )}
        </div>
        <div className="relative" ref={popovers.refs.cellBorder}>
          <ToolbarButton
            onClick={() => popovers.toggle('cellBorder')}
            title={labels.cellBorderColor}
            haspopup="dialog"
            expanded={popovers.isOpen('cellBorder')}
            className={NEUTRAL_CLASS}
          >
            <Paintbrush size={12} />
          </ToolbarButton>
          {popovers.isOpen('cellBorder') && (
            <ColorSwatches
              colors={EDITOR_COLORS}
              labels={labels}
              includeNone
              onSelect={(c) => { commands.applyCellStyle('border-color', c); popovers.close('cellBorder'); }}
            />
          )}
        </div>

        <Divider />

        {/* 열 추가/삭제 */}
        <ToolbarButton keepSelection onClick={() => commands.addColumn('before')} title={labels.addColumnLeft} className={NEUTRAL_CLASS}>
          <BetweenHorizontalStart size={14} />
        </ToolbarButton>
        <ToolbarButton keepSelection onClick={() => commands.addColumn('after')} title={labels.addColumnRight} className={NEUTRAL_CLASS}>
          <BetweenHorizontalEnd size={14} />
        </ToolbarButton>
        <ToolbarButton keepSelection onClick={commands.deleteColumn} title={labels.deleteColumn} className={DANGER_CLASS}>
          <DeleteColumnIcon size={14} />
        </ToolbarButton>

        <Divider />

        {/* 행 추가/삭제 */}
        <ToolbarButton keepSelection onClick={() => commands.addRow('before')} title={labels.addRowAbove} className={NEUTRAL_CLASS}>
          <BetweenVerticalStart size={14} />
        </ToolbarButton>
        <ToolbarButton keepSelection onClick={() => commands.addRow('after')} title={labels.addRowBelow} className={NEUTRAL_CLASS}>
          <BetweenVerticalEnd size={14} />
        </ToolbarButton>
        <ToolbarButton keepSelection onClick={commands.deleteRow} title={labels.deleteRow} className={DANGER_CLASS}>
          <DeleteRowIcon size={14} />
        </ToolbarButton>

        <Divider />

        {/* 표 삭제 */}
        <ToolbarButton
          keepSelection
          onClick={onDeleteTable}
          title={labels.deleteTable}
          className="hover:bg-red-100 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400"
        >
          <Trash2 size={12} />
        </ToolbarButton>
      </div>
    </div>
  );
}
