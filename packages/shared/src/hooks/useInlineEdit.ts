import { useState, useCallback, useRef } from 'react';

export interface CellPosition {
  row: number;
  col: number;
}

/** Per-cell transient save state for visual feedback. */
export type CellSaveState = 'saving' | 'success' | 'error';

export interface UseInlineEditOptions {
  rowCount: number;
  colCount: number;
  /**
   * Called when a cell edit is committed.
   * Returns true if save succeeded, false otherwise.
   */
  onSave: (row: number, col: number, value: unknown) => Promise<boolean>;
  readOnly?: boolean;
}

export interface UseInlineEditReturn {
  /** Currently focused cell (keyboard navigation target). null if none. */
  focusedCell: CellPosition | null;
  /** Currently editing cell (showing editor). null if not editing. */
  editingCell: CellPosition | null;
  /** The current edit value (type varies by column). */
  editValue: unknown;
  /** Update the edit value from within an editor. */
  setEditValue: (v: unknown) => void;
  /** Date pair edit state — for date columns with start+end. */
  editDateStart: string;
  editDateEnd: string;
  setEditDateStart: (v: string) => void;
  setEditDateEnd: (v: string) => void;
  /** Start editing a specific cell. */
  startEditing: (row: number, col: number, initialValue?: unknown) => void;
  /** Commit the current edit (save to server). */
  commitEdit: () => void;
  /** Cancel the current edit (restore original value). */
  cancelEdit: () => void;
  /** Set focus to a cell without entering edit mode. */
  setFocusedCell: (pos: CellPosition | null) => void;
  /** Per-cell save state map (key = "row:col"). */
  cellSaveStates: Map<string, CellSaveState>;
  /** Keyboard handler to attach to the table container. */
  handleTableKeyDown: (e: React.KeyboardEvent) => void;
  /** Check if a cell is currently focused. */
  isFocused: (row: number, col: number) => boolean;
  /** Check if a cell is currently in edit mode. */
  isEditing: (row: number, col: number) => boolean;
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function useInlineEdit({
  rowCount,
  colCount,
  onSave,
  readOnly = false,
}: UseInlineEditOptions): UseInlineEditReturn {
  const [focusedCell, setFocusedCell] = useState<CellPosition | null>(null);
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editValue, setEditValue] = useState<unknown>(null);
  const [editDateStart, setEditDateStart] = useState('');
  const [editDateEnd, setEditDateEnd] = useState('');
  const [cellSaveStates, setCellSaveStates] = useState<Map<string, CellSaveState>>(new Map());

  const originalValueRef = useRef<unknown>(null);
  const originalDateStartRef = useRef('');
  const originalDateEndRef = useRef('');
  const isCommittingRef = useRef(false);

  const setSaveState = useCallback((row: number, col: number, state: CellSaveState) => {
    const key = cellKey(row, col);
    setCellSaveStates((prev) => {
      const next = new Map(prev);
      next.set(key, state);
      return next;
    });
    // Auto-clear success/error after a short delay
    if (state === 'success' || state === 'error') {
      setTimeout(() => {
        setCellSaveStates((prev) => {
          const next = new Map(prev);
          if (next.get(key) === state) next.delete(key);
          return next;
        });
      }, state === 'success' ? 800 : 2000);
    }
  }, []);

  const startEditing = useCallback(
    (row: number, col: number, initialValue?: unknown) => {
      if (readOnly) return;
      setEditingCell({ row, col });
      setFocusedCell({ row, col });
      if (initialValue !== undefined) {
        setEditValue(initialValue);
      }
      originalValueRef.current = initialValue;
    },
    [readOnly],
  );

  const cancelEdit = useCallback(() => {
    setEditValue(originalValueRef.current);
    setEditDateStart(originalDateStartRef.current);
    setEditDateEnd(originalDateEndRef.current);
    setEditingCell(null);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell || isCommittingRef.current) return;
    isCommittingRef.current = true;
    const { row, col } = editingCell;

    // Close editor immediately for responsiveness
    setEditingCell(null);
    setSaveState(row, col, 'saving');

    onSave(row, col, editValue)
      .then((ok) => {
        setSaveState(row, col, ok ? 'success' : 'error');
      })
      .catch(() => {
        setSaveState(row, col, 'error');
      })
      .finally(() => {
        isCommittingRef.current = false;
      });
  }, [editingCell, editValue, onSave, setSaveState]);

  const moveFocus = useCallback(
    (dRow: number, dCol: number) => {
      setFocusedCell((prev) => {
        if (!prev) return { row: 0, col: 0 };
        let newRow = prev.row + dRow;
        let newCol = prev.col + dCol;
        // Wrap columns
        if (newCol < 0) {
          newCol = colCount - 1;
          newRow = Math.max(0, newRow - 1);
        } else if (newCol >= colCount) {
          newCol = 0;
          newRow = Math.min(rowCount - 1, newRow + 1);
        }
        // Clamp rows
        newRow = Math.max(0, Math.min(rowCount - 1, newRow));
        return { row: newRow, col: newCol };
      });
    },
    [rowCount, colCount],
  );

  const handleTableKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (readOnly) return;
      // If currently editing, the cell editor handles its own keys
      if (editingCell) return;

      if (!focusedCell) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveFocus(-1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveFocus(1, 0);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          moveFocus(0, -1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveFocus(0, 1);
          break;
        case 'Tab':
          e.preventDefault();
          moveFocus(0, e.shiftKey ? -1 : 1);
          break;
        case 'Enter':
        case 'F2':
          e.preventDefault();
          // Signal: start editing the focused cell
          // The table component listens and calls startEditing with the cell's current value
          startEditing(focusedCell.row, focusedCell.col);
          break;
        case 'Escape':
          e.preventDefault();
          setFocusedCell(null);
          break;
        default:
          // Printable character → start editing with that character as initial value
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            startEditing(focusedCell.row, focusedCell.col, e.key);
          }
          break;
      }
    },
    [readOnly, editingCell, focusedCell, moveFocus, startEditing],
  );

  const isFocused = useCallback(
    (row: number, col: number) => {
      return focusedCell?.row === row && focusedCell?.col === col;
    },
    [focusedCell],
  );

  const isEditing = useCallback(
    (row: number, col: number) => {
      return editingCell?.row === row && editingCell?.col === col;
    },
    [editingCell],
  );

  return {
    focusedCell,
    editingCell,
    editValue,
    setEditValue,
    editDateStart,
    editDateEnd,
    setEditDateStart: (v: string) => {
      setEditDateStart(v);
      originalDateStartRef.current = originalDateStartRef.current || v;
    },
    setEditDateEnd: (v: string) => {
      setEditDateEnd(v);
      originalDateEndRef.current = originalDateEndRef.current || v;
    },
    startEditing,
    commitEdit,
    cancelEdit,
    setFocusedCell,
    cellSaveStates,
    handleTableKeyDown,
    isFocused,
    isEditing,
  };
}
