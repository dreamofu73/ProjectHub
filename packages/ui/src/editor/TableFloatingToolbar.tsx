import { useState } from 'react';
import {
  Maximize2, MoveHorizontal, MoveVertical, PaintBucket, Paintbrush, TableCellsMerge, TableCellsSplit, TableColumnsSplit, TableRowsSplit, Trash2,
} from 'lucide-react';
import { ColorSwatches } from './ColorSwatches';
import { EDITOR_COLORS } from './constants';
import {
  AddColumnLeftIcon, AddColumnRightIcon, AddRowAboveIcon, AddRowBelowIcon,
  DeleteColumnIcon, DeleteRowIcon,
} from './icons';
import { MIN_COLUMN_WIDTH, MIN_ROW_HEIGHT, MIN_TABLE_WIDTH } from './tableStyle';
import { ToolbarButton } from './toolbar/ToolbarButton';
import { MENU_PANEL_CLASS } from './toolbar/ToolbarButton';
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

interface SizePreset {
  label: string;
  /** 적용할 값 — 빈 문자열이면 지정 해제(콘텐츠에 맞춤) */
  value: string;
}

interface SizePanelProps {
  title: string;
  /** style에 저장된 현재 값 ('' | 'auto' | '100%' | 'NNNpx') */
  current: string;
  /** 지정 값이 없을 때 입력창을 채울 실제 렌더 크기(px) */
  renderedPx: number;
  min: number;
  presets: SizePreset[];
  onApply: (value: string | null) => void;
  onClose: () => void;
  popovers: PopoverApi;
  panelRef: React.RefObject<HTMLDivElement | null>;
}

const PRESET_CLASS = 'flex-1 text-[10px] px-2 py-1 rounded border transition-colors';
const PRESET_ACTIVE_CLASS = 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-600 dark:text-indigo-300';
const PRESET_IDLE_CLASS = 'border-border text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800';

/** 표 너비 / 셀 너비 / 행 높이 공통 설정 패널 — px 수치 입력(Enter로 적용) + 프리셋 버튼 */
function SizePanel({ title, current, renderedPx, min, presets, onApply, onClose, popovers, panelRef }: SizePanelProps) {
  const isPx = /^\d+px$/i.test(current);
  // 지정 값이 없으면 실제 렌더 크기를 채워 바로 조절할 수 있게 한다
  const [localValue, setLocalValue] = useState(
    isPx ? current.replace(/px/gi, '').trim() : String(renderedPx || ''),
  );
  // 콘텐츠에 맞춤은 표 너비에서 'auto'로 저장되므로 미지정과 같게 본다
  const activeValue = current === 'auto' ? '' : current;

  const apply = (value: string | null) => {
    onApply(value);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const size = parseInt(localValue, 10);
      if (!isNaN(size) && size >= min) apply(`${size}px`);
    }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      ref={panelRef}
      className={`${MENU_PANEL_CLASS} dark:border-slate-700 shadow-xl p-2 rounded-md w-44`}
      onKeyDown={popovers.handleMenuKeyDown}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{title}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-16 border border-border rounded px-1 py-0.5 text-right bg-transparent text-xs"
          />
          <span className="text-[10px] text-slate-400">px</span>
        </div>
      </div>
      <div className="flex gap-1">
        {presets.map(preset => (
          <button
            key={preset.label}
            type="button"
            onClick={() => apply(preset.value || null)}
            className={`${PRESET_CLASS} ${activeValue === preset.value ? PRESET_ACTIVE_CLASS : PRESET_IDLE_CLASS}`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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

        {/* 표 너비 */}
        <div className="relative" ref={popovers.refs.tableWidth}>
          <ToolbarButton
            onClick={() => popovers.toggle('tableWidth')}
            title={labels.tableWidth}
            haspopup="dialog"
            expanded={popovers.isOpen('tableWidth')}
            className={NEUTRAL_CLASS}
          >
            <Maximize2 size={12} />
          </ToolbarButton>
          {popovers.isOpen('tableWidth') && (
            <SizePanel
              title={labels.tableWidth}
              current={commands.getTableWidth()}
              renderedPx={commands.getRenderedTableWidth()}
              min={MIN_TABLE_WIDTH}
              presets={[
                { label: labels.fitContent, value: '' },
                { label: labels.fullWidth, value: '100%' },
              ]}
              onApply={commands.setTableWidth}
              onClose={() => popovers.close('tableWidth')}
              popovers={popovers}
              panelRef={popovers.refs.tableWidth}
            />
          )}
        </div>

        {/* 셀(열) 너비 */}
        <div className="relative" ref={popovers.refs.cellWidth}>
          <ToolbarButton
            onClick={() => popovers.toggle('cellWidth')}
            title={labels.cellWidth}
            haspopup="dialog"
            expanded={popovers.isOpen('cellWidth')}
            className={NEUTRAL_CLASS}
          >
            <MoveHorizontal size={12} />
          </ToolbarButton>
          {popovers.isOpen('cellWidth') && (
            <SizePanel
              title={labels.cellWidth}
              current={commands.getColumnWidth()}
              renderedPx={commands.getRenderedColumnWidth()}
              min={MIN_COLUMN_WIDTH}
              presets={[{ label: labels.fitContent, value: '' }]}
              onApply={commands.setColumnWidth}
              onClose={() => popovers.close('cellWidth')}
              popovers={popovers}
              panelRef={popovers.refs.cellWidth}
            />
          )}
        </div>

        {/* 행 높이 */}
        <div className="relative" ref={popovers.refs.rowHeight}>
          <ToolbarButton
            onClick={() => popovers.toggle('rowHeight')}
            title={labels.rowHeight}
            haspopup="dialog"
            expanded={popovers.isOpen('rowHeight')}
            className={NEUTRAL_CLASS}
          >
            <MoveVertical size={12} />
          </ToolbarButton>
          {popovers.isOpen('rowHeight') && (
            <SizePanel
              title={labels.rowHeight}
              current={commands.getRowHeight()}
              renderedPx={commands.getRenderedRowHeight()}
              min={MIN_ROW_HEIGHT}
              presets={[
                { label: labels.fitContent, value: '' },
                { label: '48px', value: '48px' },
              ]}
              onApply={commands.setRowHeight}
              onClose={() => popovers.close('rowHeight')}
              popovers={popovers}
              panelRef={popovers.refs.rowHeight}
            />
          )}
        </div>

        <Divider />

        {/* 열 추가/삭제 */}
        <ToolbarButton keepSelection onClick={() => commands.addColumn('before')} title={labels.addColumnLeft} className={NEUTRAL_CLASS}>
          <AddColumnLeftIcon size={14} />
        </ToolbarButton>
        <ToolbarButton keepSelection onClick={() => commands.addColumn('after')} title={labels.addColumnRight} className={NEUTRAL_CLASS}>
          <AddColumnRightIcon size={14} />
        </ToolbarButton>
        <ToolbarButton keepSelection onClick={commands.deleteColumn} title={labels.deleteColumn} className={DANGER_CLASS}>
          <DeleteColumnIcon size={14} />
        </ToolbarButton>

        <Divider />

        {/* 행 추가/삭제 */}
        <ToolbarButton keepSelection onClick={() => commands.addRow('before')} title={labels.addRowAbove} className={NEUTRAL_CLASS}>
          <AddRowAboveIcon size={14} />
        </ToolbarButton>
        <ToolbarButton keepSelection onClick={() => commands.addRow('after')} title={labels.addRowBelow} className={NEUTRAL_CLASS}>
          <AddRowBelowIcon size={14} />
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
