import { useState } from 'react';
import { Check, Table as TableIcon } from 'lucide-react';
import { TABLE_GRID_SIZE } from '../constants';
import { useFlipPosition } from '../useFlipPosition';
import type { TableConfig } from '../useEditorCommands';
import { MENU_PANEL_CLASS, ToolbarButton } from './ToolbarButton';
import type { ToolbarGroupProps } from './types';

type Props = Pick<ToolbarGroupProps, 'labels' | 'commands' | 'popovers'>;

const DEFAULT_CONFIG: TableConfig = {
  rows: 3,
  cols: 3,
  borderWidth: '1px',
  borderColor: '#cccccc',
  backgroundColor: '',
};

const NO_HOVER = { r: -1, c: -1 };

/** 표 삽입 — 10x10 그리드 선택 + 상세 설정(테두리/배경) */
export function TableInsertMenu({ labels, commands, popovers }: Props) {
  const [config, setConfig] = useState<TableConfig>(DEFAULT_CONFIG);
  const [hovered, setHovered] = useState(NO_HOVER);
  const [showDetails, setShowDetails] = useState(false);

  const isOpen = popovers.isOpen('table');
  const tableAlign = useFlipPosition(popovers.refs.table, isOpen, 260);
  const previewCols = hovered.r >= 0 ? hovered.c + 1 : config.cols;
  const previewRows = hovered.r >= 0 ? hovered.r + 1 : config.rows;

  const insert = (rows: number, cols: number) => {
    commands.insertTable(rows, cols, config);
    popovers.close('table');
  };

  return (
    <div className="relative" ref={popovers.refs.table}>
      <ToolbarButton
        onClick={() => popovers.toggle('table')}
        title={labels.table}
        haspopup="menu"
        expanded={isOpen}
        className="text-slate-600 dark:text-slate-400"
      >
        <TableIcon size={14} />
      </ToolbarButton>

      {isOpen && (
        <div className={`${MENU_PANEL_CLASS} ${tableAlign} dark:border-slate-700 shadow-xl p-3 rounded-md flex flex-col gap-3 w-64`} onKeyDown={popovers.handleMenuKeyDown}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">
              {labels.insertTable} <span className="text-indigo-500">{previewCols}x{previewRows}</span>
            </span>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
            >
              {labels.detailSettings}
            </button>
          </div>

          <div className="flex flex-col gap-0.5" onMouseLeave={() => setHovered(NO_HOVER)}>
            {Array.from({ length: TABLE_GRID_SIZE }).map((_, r) => (
              <div key={r} className="flex gap-0.5">
                {Array.from({ length: TABLE_GRID_SIZE }).map((_, c) => {
                  const isHighlighted = r <= hovered.r && c <= hovered.c;
                  return (
                    <div
                      key={c}
                      onMouseEnter={() => { setHovered({ r, c }); setConfig(prev => ({ ...prev, rows: r + 1, cols: c + 1 })); }}
                      onClick={() => insert(r + 1, c + 1)}
                      className={`w-5 h-5 border cursor-pointer ${isHighlighted ? 'bg-indigo-100 border-indigo-300 dark:bg-indigo-900/40 dark:border-indigo-700' : 'bg-white border-slate-200 hover:border-indigo-400 dark:bg-slate-800 dark:border-slate-700'}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {showDetails && (
            <div className="flex flex-col gap-2 pt-2 border-t border-border text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">{labels.columnCount}</span>
                <input type="number" min="1" max="20" value={config.cols} onChange={(e) => setConfig(prev => ({ ...prev, cols: parseInt(e.target.value) || 1 }))} className="w-16 border border-border rounded px-1 py-0.5 text-right bg-transparent" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">{labels.rowCount}</span>
                <input type="number" min="1" max="20" value={config.rows} onChange={(e) => setConfig(prev => ({ ...prev, rows: parseInt(e.target.value) || 1 }))} className="w-16 border border-border rounded px-1 py-0.5 text-right bg-transparent" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">{labels.borderWidth}</span>
                <select value={config.borderWidth} onChange={(e) => setConfig(prev => ({ ...prev, borderWidth: e.target.value }))} className="w-24 border border-border rounded px-1 py-0.5 bg-transparent">
                  <option value="0px">{labels.none}</option>
                  <option value="1px">1px</option>
                  <option value="2px">2px</option>
                  <option value="3px">3px</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">{labels.borderColor}</span>
                <input type="color" value={config.borderColor} onChange={(e) => setConfig(prev => ({ ...prev, borderColor: e.target.value }))} className="w-24 h-6 border border-border rounded p-0 cursor-pointer" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">{labels.cellBackgroundColor}</span>
                <input type="color" value={config.backgroundColor || '#ffffff'} onChange={(e) => setConfig(prev => ({ ...prev, backgroundColor: e.target.value }))} className="w-24 h-6 border border-border rounded p-0 cursor-pointer" />
              </div>
              <div className="flex justify-end mt-1">
                <button type="button" onClick={() => insert(config.rows, config.cols)} className="flex items-center gap-1 text-indigo-500 hover:text-indigo-600 font-bold">
                  <Check size={14} /> {labels.apply}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
