import React, { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent, mergeAttributes } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import OrderedList from '@tiptap/extension-ordered-list';
import { Mark } from '@tiptap/core';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, 
  Heading1, Heading2, List as ListIcon, 
  Link as LinkIcon, Trash2, Minus,
  AlignLeft, AlignCenter, AlignRight, Table as TableIcon,
  ChevronDown, Type, AlignJustify, Check, Smile,
  TableCellsMerge, TableCellsSplit, TableColumnsSplit, TableRowsSplit,
  PaintBucket, Paintbrush, Code, Image as ImageIcon
} from 'lucide-react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

// --- Type augmentation for custom Indent extension commands ---
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

const CustomOutdentIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="12" y1="10" x2="20" y2="10" />
    <line x1="12" y1="14" x2="20" y2="14" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <path d="M8 12 L4 12 M6 10 L4 12 L6 14" />
  </svg>
);

const CustomIndentIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="12" y1="10" x2="20" y2="10" />
    <line x1="12" y1="14" x2="20" y2="14" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <path d="M4 12 L8 12 M6 10 L8 12 L6 14" />
  </svg>
);

const CustomLineHeightIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="5" y1="5" x2="5" y2="19" />
    <polyline points="2 8 5 5 8 8" />
    <polyline points="2 16 5 19 8 16" />
    <line x1="12" y1="6" x2="20" y2="6" />
    <line x1="12" y1="12" x2="20" y2="12" />
    <line x1="12" y1="18" x2="20" y2="18" />
  </svg>
);

const CustomAddColLeftIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="10" y="4" width="10" height="16" rx="1" />
    <line x1="15" y1="4" x2="15" y2="20" />
    <line x1="10" y1="12" x2="20" y2="12" />
    <path d="M6 12h-4m2-2v4" />
  </svg>
);

const CustomAddColRightIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="10" height="16" rx="1" />
    <line x1="9" y1="4" x2="9" y2="20" />
    <line x1="4" y1="12" x2="14" y2="12" />
    <path d="M18 12h4m-2-2v4" />
  </svg>
);

const CustomDeleteColIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <line x1="12" y1="4" x2="12" y2="20" />
    <path d="M14 10l4 4m0-4l-4 4" stroke="red" />
  </svg>
);

const CustomAddRowAboveIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="10" width="16" height="10" rx="1" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="12" y1="10" x2="12" y2="20" />
    <path d="M12 6v-4m-2 2h4" />
  </svg>
);

const CustomAddRowBelowIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="16" height="10" rx="1" />
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="12" y1="4" x2="12" y2="14" />
    <path d="M12 18v4m-2-2h4" />
  </svg>
);

const CustomDeleteRowIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <path d="M10 14l4 4m0-4l-4 4" stroke="red" />
  </svg>
);

// --- Custom TextStyle Mark for Font, Size, Color ---
const CustomStyle = Mark.create({
  name: 'textStyle',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: element => element.style.color || null,
        renderHTML: attributes => {
          if (!attributes.color) {
            return {};
          }
          return {
            style: `color: ${attributes.color}`,
          };
        },
      },
      fontSize: {
        default: null,
        parseHTML: element => element.style.fontSize || null,
        renderHTML: attributes => {
          if (!attributes.fontSize) {
            return {};
          }
          return {
            style: `font-size: ${attributes.fontSize}`,
          };
        },
      },
      fontFamily: {
        default: null,
        parseHTML: element => element.style.fontFamily || null,
        renderHTML: attributes => {
          if (!attributes.fontFamily) {
            return {};
          }
          return {
            style: `font-family: ${attributes.fontFamily}`,
          };
        },
      },
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || null,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) {
            return {};
          }
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
    };
  },
});

// --- Official Table Extensions ---
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import BulletList from '@tiptap/extension-bullet-list';
import { Indent } from './IndentExtension';
import { LineHeight } from './LineHeightExtension';

const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          if (!attributes.style) return {};
          return { style: attributes.style };
        },
      },
    };
  },
});

const CustomTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          if (!attributes.style) return {};
          return { style: attributes.style };
        },
      },
    };
  },
});

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
        parseHTML: element => element.getAttribute('style'),
        renderHTML: attributes => {
          if (!attributes.style) return {};
          return { style: attributes.style };
        },
      },
    };
  },
});

const orderedListTypeMap: Record<string, string> = {
  'A': 'upper-alpha',
  'a': 'lower-alpha',
  'I': 'upper-roman',
  'i': 'lower-roman',
};

const CustomOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      type: {
        default: '1',
        parseHTML: element => element.getAttribute('type') || '1',
        renderHTML: attributes => {
          if (!attributes.type || attributes.type === '1') {
            return {};
          }
          const listStyle = orderedListTypeMap[attributes.type] || 'decimal';
          return {
            type: attributes.type,
            style: `list-style-type: ${listStyle}; list-style-position: outside;`,
          };
        },
      },
    };
  },
});

const bulletListStyleMap: Record<string, string> = {
  square: 'square',
  circle: 'circle',
  disc: 'disc',
};

const CustomBulletList = BulletList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: 'disc',
        parseHTML: element => {
          const inline = element.style.listStyleType || '';
          if (!inline) return 'disc';
          const unquoted = inline.replace(/^['"]|['"]$/g, '');
          return bulletListStyleMap[unquoted] || bulletListStyleMap[inline] || inline || 'disc';
        },
        renderHTML: attributes => {
          if (!attributes.style || attributes.style === 'disc') {
            return {};
          }
          const val = attributes.style;
          const needsQuotes = val.length === 1 || !bulletListStyleMap[val];
          const cssValue = needsQuotes ? `"${val}"` : val;
          return {
            style: `list-style-type: ${cssValue}; list-style-position: outside;`,
          };
        },
      },
    };
  },
});

interface HTMLEditorProps {
  value: string;
  onChange: (val: string) => void;
  height?: number;
  disabled?: boolean;
}

const TIPTAP_EXTENSIONS = [
  StarterKit.configure({
    orderedList: false,
    bulletList: false,
    link: false,
    underline: false,
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

export function HTMLEditor({ value, onChange, height = 400, disabled = false }: HTMLEditorProps) {
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [htmlValue, setHtmlValue] = useState(value);
  const [isHeadingDropdownOpen, setIsHeadingDropdownOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isBgColorPickerOpen, setIsBgColorPickerOpen] = useState(false);
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false);
  const [isAlignDropdownOpen, setIsAlignDropdownOpen] = useState(false);
  const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
  const [isLineHeightDropdownOpen, setIsLineHeightDropdownOpen] = useState(false);
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);
  const [isSpecialCharOpen, setIsSpecialCharOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isInsideTable, setIsInsideTable] = useState(false);
  const [canMerge, setCanMerge] = useState(false);
  const [canSplit, setCanSplit] = useState(false);
  const [tableToolbarPos, setTableToolbarPos] = useState<{ top: number; visible: boolean }>({ top: 0, visible: false });
  const [isCellBgColorOpen, setIsCellBgColorOpen] = useState(false);
  const [isCellBorderColorOpen, setIsCellBorderColorOpen] = useState(false);

  const [hoveredGrid, setHoveredGrid] = useState({ r: -1, c: -1 });
  const [tableConfig, setTableConfig] = useState({
    rows: 3,
    cols: 3,
    borderWidth: '1px',
    borderColor: '#cccccc',
    backgroundColor: ''
  });
  const [showTableDetails, setShowTableDetails] = useState(false);

  const headingDropdownRef = useRef<HTMLDivElement>(null);
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const sizeDropdownRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const bgColorPickerRef = useRef<HTMLDivElement>(null);
  const alignDropdownRef = useRef<HTMLDivElement>(null);
  const listDropdownRef = useRef<HTMLDivElement>(null);
  const lineHeightDropdownRef = useRef<HTMLDivElement>(null);
  const tableSelectorRef = useRef<HTMLDivElement>(null);
  const cellBgColorRef = useRef<HTMLDivElement>(null);
  const cellBorderColorRef = useRef<HTMLDivElement>(null);
  const specialCharRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  const fonts = [
    { label: '굴림', value: 'Gulim' },
    { label: '돋움', value: 'Dotum' },
    { label: '바탕', value: 'Batang' },
    { label: '궁서', value: 'Gungsuh' },
    { label: '맑은 고딕', value: 'Malgun Gothic' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Tahoma', value: 'Tahoma' },
    { label: 'Verdana', value: 'Verdana' },
  ];

  const fontSizes = [
    { label: '48px', value: '48px' },
    { label: '36px', value: '36px' },
    { label: '24px', value: '24px' },
    { label: '18px', value: '18px' },
    { label: '14px', value: '14px' },
    { label: '12px', value: '12px' },
    { label: '11px', value: '11px' },
    { label: '10px', value: '10px' },
    { label: '9px', value: '9px' },
    { label: '8px', value: '8px' },
  ];

  const colors = [
    '#ffffff', '#f2f2f2', '#d8d8d8', '#bfbfbf', '#a5a5a5', '#7f7f7f', '#3f3f3f', '#000000',
    '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc',
    '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#9fc5e8', '#b4a7d6', '#d5a6bd',
    '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#9900ff', '#ff00ff',
    '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3d85c6', '#674ea7', '#a64d79',
    '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#0b5394', '#351c75', '#741b47',
  ];

  const specialCharacters = [
    '★', '☆', '☎', '☏', '☜', '☞', '♠', '♤', '♣', '♧', '♥', '♡', '◈', '▣', '◐', '◑', '▒', '▤', '♨', '윈', '♬', '♩', '♪', '♭', '㉿', '㈜', '№', '㏇', '™', '㏂', '㉾', '㈛', '㈝', '㈞', '㈟', '㈠', '㈡', '㈢', '㈣', '㈤', '㈥', '㈦', '㈧', '㈨', '㈩', '㈪', '㈫', '㈬', '㈭', '㈮', '㈯', '㈰', '㈱', '㈲', '㈳', '㈴', '㈵', '㈶', '㈷', '㈸', '㈹', '㈺', '㈻', '㈼', '㈽', '㈾', '㈿', '㉀', '㉁', '㉂', '㉃', '㉄', '㉅', '㉆', '㉇', '㉈', '㉉', '㉊', '㉋', '㉌', '㉍', '㉎', '㉏'
  ];

  // Tiptap Editor Initialization
  const editor = useEditor({
    extensions: TIPTAP_EXTENSIONS,
    content: value || '<p></p>',
    editable: !disabled,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      setHtmlValue(html);
      onChange(html);
    },
    onSelectionUpdate() {
      updateTableSelectionState();
    },
  });

  // Keep value synced from props
  useEffect(() => {
    if (!editor || isSourceMode) return;
    const currentHTML = editor.getHTML();
    if (currentHTML !== value) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
  }, [value, editor, isSourceMode]);

  // Keep editable state synced
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  // Row resizing logic
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;
    let resizingRow: HTMLTableRowElement | null = null;

    const handleDomMouseMove = (e: MouseEvent) => {
      if (isResizing) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'TD' || target.tagName === 'TH')) {
        const rect = target.getBoundingClientRect();
        const isNearBottom = rect.bottom - e.clientY <= 5 && rect.bottom - e.clientY >= -1;
        if (isNearBottom) {
          target.style.cursor = 'row-resize';
        } else {
          target.style.cursor = '';
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'TD' || target.tagName === 'TH')) {
        const rect = target.getBoundingClientRect();
        const isNearBottom = rect.bottom - e.clientY <= 5 && rect.bottom - e.clientY >= -1;
        if (isNearBottom) {
          e.preventDefault();
          isResizing = true;
          startY = e.clientY;
          resizingRow = target.parentElement as HTMLTableRowElement;
          startHeight = resizingRow.getBoundingClientRect().height;
          document.body.style.cursor = 'row-resize';
        }
      }
    };

    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizingRow) return;
      const newHeight = Math.max(24, startHeight + (e.clientY - startY));
      resizingRow.style.height = `${newHeight}px`;
    };

    const handleDocumentMouseUp = () => {
      if (isResizing && resizingRow) {
        isResizing = false;
        document.body.style.cursor = '';
        
        const newHeight = resizingRow.style.height;
        try {
          const pos = editor.view.posAtDOM(resizingRow, 0);
          const nodePos = pos - 1;
          const node = editor.view.state.doc.nodeAt(nodePos);
          if (node && node.type.name === 'tableRow') {
            const currentStyle = node.attrs.style || '';
            const newStyle = currentStyle.replace(/height:\s*[^;]+;?/g, '') + ` height: ${newHeight};`;
            editor.view.dispatch(editor.view.state.tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, style: newStyle.trim() }));
          }
        } catch (err) {
          console.error('Failed to save row height', err);
        }
        resizingRow = null;
      }
    };

    dom.addEventListener('mousemove', handleDomMouseMove);
    dom.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      dom.removeEventListener('mousemove', handleDomMouseMove);
      dom.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [editor]);

  // Detect cursor position table status
  const updateTableSelectionState = () => {
    if (!editor) return;

    // Detect isInsideTable via DOM
    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      setIsInsideTable(false);
      setCanMerge(false);
      setCanSplit(false);
      setTableToolbarPos({ top: 0, visible: false });
      return;
    }
    let node: Node | null = domSelection.getRangeAt(0).startContainer;
    let foundTable = false;
    let tableElement: HTMLTableElement | null = null;
    const rootElement = editor.view.dom;
    while (node && node !== rootElement) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') {
        foundTable = true;
        // Walk up to find the <table> ancestor
        let walk: Node | null = node;
        while (walk && walk !== rootElement) {
          if (walk.nodeName === 'TABLE') {
            tableElement = walk as HTMLTableElement;
            break;
          }
          walk = walk.parentNode;
        }
        break;
      }
      node = node.parentNode;
    }
    setIsInsideTable(foundTable);

    if (!foundTable) {
      setCanMerge(false);
      setCanSplit(false);
      setTableToolbarPos({ top: 0, visible: false });
      return;
    }

    // Compute toolbar position relative to editor content area
    if (tableElement) {
      const editorContentEl = tableElement.closest('.relative.flex-1.rounded-b-xl');
      if (editorContentEl) {
        const editorRect = editorContentEl.getBoundingClientRect();
        const tableRect = tableElement.getBoundingClientRect();
        const scrollTop = editorContentEl.scrollTop || 0;
        const top = tableRect.top - editorRect.top + scrollTop - 44; // 44px above the table
        setTableToolbarPos({ top: Math.max(4, top), visible: true });
      }
    }

    // Detect CellSelection (multi-cell) via editor state
    const sel = editor.state.selection as any;
    const isCellSelection = sel && typeof sel.$anchorCell !== 'undefined';
    setCanMerge(isCellSelection);

    // Detect merged cell (colspan/rowspan > 1)
    const cellAttrs = editor.getAttributes('tableCell') || editor.getAttributes('tableHeader') || {};
    const isMerged = (cellAttrs.colspan && cellAttrs.colspan > 1) || (cellAttrs.rowspan && cellAttrs.rowspan > 1);
    setCanSplit(isMerged);
  };

  useEffect(() => {
    document.addEventListener('selectionchange', updateTableSelectionState);
    return () => {
      document.removeEventListener('selectionchange', updateTableSelectionState);
    };
  }, [editor]);

  // Handle outside click to close popovers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (headingDropdownRef.current && !headingDropdownRef.current.contains(target)) {
        setIsHeadingDropdownOpen(false);
      }
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(target)) {
        setIsFontDropdownOpen(false);
      }
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(target)) {
        setIsSizeDropdownOpen(false);
      }
      if (colorPickerRef.current && !colorPickerRef.current.contains(target)) {
        setIsColorPickerOpen(false);
      }
      if (bgColorPickerRef.current && !bgColorPickerRef.current.contains(target)) {
        setIsBgColorPickerOpen(false);
      }
      if (alignDropdownRef.current && !alignDropdownRef.current.contains(target)) {
        setIsAlignDropdownOpen(false);
      }
      if (listDropdownRef.current && !listDropdownRef.current.contains(target)) {
        setIsListDropdownOpen(false);
      }
      if (lineHeightDropdownRef.current && !lineHeightDropdownRef.current.contains(target)) {
        setIsLineHeightDropdownOpen(false);
      }
      if (tableSelectorRef.current && !tableSelectorRef.current.contains(target)) {
        setIsTableSelectorOpen(false);
      }
      if (cellBgColorRef.current && !cellBgColorRef.current.contains(target)) {
        setIsCellBgColorOpen(false);
      }
      if (cellBorderColorRef.current && !cellBorderColorRef.current.contains(target)) {
        setIsCellBorderColorOpen(false);
      }
      if (specialCharRef.current && !specialCharRef.current.contains(target)) {
        setIsSpecialCharOpen(false);
      }
      if (emojiRef.current && !emojiRef.current.contains(target)) {
        setIsEmojiOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setHtmlValue(newVal);
    onChange(newVal);
  };

  // Text Styling Patch helper (prevents overwriting other inline style fields)
  const applyCustomStyle = (styleType: 'color' | 'fontSize' | 'fontFamily' | 'backgroundColor', val: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    let currentAttrs: Record<string, unknown> = {};

    editor.state.doc.nodesBetween(from, to, node => {
      const mark = node.marks.find(m => m.type.name === 'textStyle');
      if (mark) {
        currentAttrs = { ...currentAttrs, ...mark.attrs };
      }
    });

    const nextAttrs = {
      ...currentAttrs,
      [styleType]: val || null,
    };

    const hasAnyAttr = Object.values(nextAttrs).some(v => v !== null);
    if (!hasAnyAttr) {
      editor.chain().focus().unsetMark('textStyle').run();
    } else {
      editor.chain().focus().setMark('textStyle', nextAttrs).run();
    }
  };

  const insertGridTable = (rows: number, cols: number) => {
    if (!editor) return;
    const { borderWidth, borderColor, backgroundColor } = tableConfig;
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
    setIsTableSelectorOpen(false);
  };

  const addRow = (direction: 'before' | 'after') => {
    if (!editor) return;
    if (direction === 'before') {
      editor.chain().focus().addRowBefore().run();
    } else {
      editor.chain().focus().addRowAfter().run();
    }
  };

  const deleteRow = () => {
    if (!editor) return;
    editor.chain().focus().deleteRow().run();
  };

  const addColumn = (direction: 'before' | 'after') => {
    if (!editor) return;
    if (direction === 'before') {
      editor.chain().focus().addColumnBefore().run();
    } else {
      editor.chain().focus().addColumnAfter().run();
    }
  };

  const deleteColumn = () => {
    if (!editor) return;
    editor.chain().focus().deleteColumn().run();
  };

  const deleteTable = () => {
    if (!editor) return;
    editor.chain().focus().deleteTable().run();
    setIsInsideTable(false);
  };

  const mergeCells = () => {
    if (!editor) return;
    editor.chain().focus().mergeCells().run();
  };

  const splitCell = () => {
    if (!editor) return;
    editor.chain().focus().splitCell().run();
  };

  const toggleHeaderColumn = () => {
    if (!editor) return;
    editor.chain().focus().toggleHeaderColumn().run();
  };

  const toggleHeaderRow = () => {
    if (!editor) return;
    editor.chain().focus().toggleHeaderRow().run();
  };

  const applyCellStyle = (prop: string, value: string) => {
    if (!editor) return;
    const currentAttrs = editor.getAttributes('tableCell') || editor.getAttributes('tableHeader') || {};
    const currentStyle = (currentAttrs.style || '') as string;
    const regex = new RegExp(`${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:[^;]+;?`, 'g');
    const cleanStyle = currentStyle.replace(regex, '').trim();
    const separator = cleanStyle && !cleanStyle.endsWith(';') ? '; ' : '';
    const newStyle = cleanStyle ? `${cleanStyle}${separator}${prop}: ${value};` : `${prop}: ${value};`;
    editor.chain().focus().setCellAttribute('style', newStyle).run();
  };

  const addLink = () => {
    if (!editor) return;
    const url = window.prompt('연결할 URL 주소를 입력하세요:', 'https://');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    if (!editor) return;
    const url = window.prompt('삽입할 이미지 URL 주소를 입력하세요:', 'https://');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const setOrderedListType = (type: string) => {
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
    setIsListDropdownOpen(false);
  };

  const setBulletListStyle = (style: string) => {
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
    setIsListDropdownOpen(false);
  };

  return (
    <div className="border border-border rounded-xl flex flex-col bg-white dark:bg-slate-955 shadow-sm transition-all duration-200 relative">
      
    {/* Tiptap Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1 bg-slate-100 dark:bg-slate-900 border-b border-border select-none shrink-0 rounded-t-xl relative z-20">
        
        {/* Style Combo (맨 앞 — 현재 커서 스타일 표시 및 변경) */}
        <div className="relative" ref={headingDropdownRef}>
          <button
            type="button"
            disabled={isSourceMode || disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsHeadingDropdownOpen(!isHeadingDropdownOpen)}
            className="flex items-center justify-between gap-1.5 px-2 py-1 h-8 text-xs font-semibold rounded border border-border bg-white dark:bg-slate-950 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer min-w-[72px]"
            title="제목 스타일"
          >
            {editor?.isActive('heading', { level: 1 }) ? <><Heading1 size={14} /> H1</> :
             editor?.isActive('heading', { level: 2 }) ? <><Heading2 size={14} /> H2</> :
             editor?.isActive('heading', { level: 3 }) ? <><span className="font-bold text-xs">H3</span></> :
             editor?.isActive('heading', { level: 4 }) ? <><span className="font-bold text-xs">H4</span></> :
             <><span>본문</span></>}
            <ChevronDown size={12} className="opacity-60 shrink-0" />
          </button>
          {isHeadingDropdownOpen && (
            <div className="absolute left-0 mt-1 p-1 bg-white dark:bg-slate-900 border border-border rounded shadow-xl z-20 min-w-[130px]">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { editor?.chain().focus().setParagraph().run(); setIsHeadingDropdownOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-none bg-transparent ${
                  editor?.isActive('paragraph') ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-foreground'
                }`}
              >
                <Type size={14} /> 본문
              </button>
              <div className="border-t border-border my-1" />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { editor?.chain().focus().toggleHeading({ level: 1 }).run(); setIsHeadingDropdownOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-none bg-transparent ${
                  editor?.isActive('heading', { level: 1 }) ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-foreground'
                }`}
              >
                제목1
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { editor?.chain().focus().toggleHeading({ level: 2 }).run(); setIsHeadingDropdownOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-none bg-transparent ${
                  editor?.isActive('heading', { level: 2 }) ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-foreground'
                }`}
              >
                제목2
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { editor?.chain().focus().toggleHeading({ level: 3 }).run(); setIsHeadingDropdownOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-none bg-transparent ${
                  editor?.isActive('heading', { level: 3 }) ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-foreground'
                }`}
              >
                제목3
              </button>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { editor?.chain().focus().toggleHeading({ level: 4 }).run(); setIsHeadingDropdownOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-none bg-transparent ${
                  editor?.isActive('heading', { level: 4 }) ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-foreground'
                }`}
              >
                제목4
              </button>
            </div>
          )}
        </div>

        {/* Group 1: Font & Size */}
        <div className="flex items-center gap-0.5 border-r border-border pr-2">
          {/* Custom Font Family Dropdown */}
          <div className="relative" ref={fontDropdownRef}>
            <button
              type="button"
              disabled={isSourceMode || disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
              className="flex items-center justify-between gap-1.5 px-2 py-1 h-8 text-xs font-medium rounded border border-border bg-white dark:bg-slate-950 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer min-w-[90px]"
              title="글꼴"
            >
              <span className="truncate">글꼴</span>
              <ChevronDown size={12} className="opacity-60 shrink-0" />
            </button>
            
            {isFontDropdownOpen && (
              <div className="absolute left-0 mt-1 p-1 bg-white dark:bg-slate-900 border border-border rounded shadow-xl z-20 min-w-[120px]">
                {fonts.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyCustomStyle('fontFamily', f.value);
                      setIsFontDropdownOpen(false);
                    }}
                    className="w-full text-left px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground cursor-pointer"
                    style={{ fontFamily: f.value }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Font Size Dropdown */}
          <div className="relative" ref={sizeDropdownRef}>
            <button
              type="button"
              disabled={isSourceMode || disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsSizeDropdownOpen(!isSizeDropdownOpen)}
              className="flex items-center justify-between gap-1.5 px-2 py-1 h-8 text-xs font-medium rounded border border-border bg-white dark:bg-slate-950 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all cursor-pointer min-w-[60px]"
              title="글자 크기"
            >
              <span className="truncate">크기</span>
              <ChevronDown size={12} className="opacity-60 shrink-0" />
            </button>
            
            {isSizeDropdownOpen && (
              <div className="absolute left-0 mt-1 p-1 bg-white dark:bg-slate-900 border border-border rounded shadow-xl z-20 w-[346px] max-h-[400px] overflow-y-auto overflow-x-hidden custom-scrollbar">
                {fontSizes.map((s) => {
                  const isActive = editor?.isActive('textStyle', { fontSize: s.value });
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        applyCustomStyle('fontSize', s.value);
                        setIsSizeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${
                        isActive ? 'text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-900/20' : 'text-foreground'
                      }`}
                      style={{ fontSize: s.value, lineHeight: 1.2 }}
                    >
                      가나다 ({s.label})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Group 2: Text Styles */}
        <div className="flex items-center gap-0.5 border-r border-border pr-2">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors" title="굵게"><Bold size={14} /></button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors" title="기울임"><Italic size={14} /></button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleUnderline().run()} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors" title="밑줄"><UnderlineIcon size={14} /></button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleStrike().run()} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors" title="취소선"><Strikethrough size={14} /></button>
          <div className="relative" ref={colorPickerRef}>
            <button type="button" onClick={() => setIsColorPickerOpen(!isColorPickerOpen)} className="relative w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors" title="글자색">
              <span className="font-serif font-bold text-[15px] leading-none text-slate-700 dark:text-slate-300 mr-1">T</span>
              <div 
                className="absolute bottom-1.5 right-1 w-2 h-2" 
                style={{ backgroundColor: editor?.getAttributes('textStyle').color || '#000000' }} 
              />
            </button>
            {isColorPickerOpen && (
              <div className="absolute left-0 mt-1 p-1.5 bg-white dark:bg-slate-900 border border-border dark:border-slate-700 rounded shadow-lg z-30 grid grid-cols-8 gap-0.5 w-max">
                {colors.map(c => (
                  <button 
                    key={c} 
                    className="w-4 h-4 border border-slate-200 hover:scale-110 transition-transform cursor-pointer" 
                    style={{backgroundColor: c}} 
                    onClick={() => { applyCustomStyle('color', c); setIsColorPickerOpen(false); }} 
                    title={c}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="relative" ref={bgColorPickerRef}>
            <button 
              type="button" 
              onClick={() => setIsBgColorPickerOpen(!isBgColorPickerOpen)} 
              className="relative w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors transition-colors" 
              title="배경색"
              style={{ 
                backgroundColor: editor?.getAttributes('textStyle').backgroundColor || 'transparent',
                color: editor?.getAttributes('textStyle').backgroundColor ? '#ffffff' : 'inherit',
                textShadow: editor?.getAttributes('textStyle').backgroundColor ? '0px 0px 2px rgba(0,0,0,0.3)' : 'none'
              }}
            >
              <span className="font-serif font-bold text-[14px] leading-none">T</span>
            </button>
            {isBgColorPickerOpen && (
              <div className="absolute left-0 mt-1 p-1.5 bg-white dark:bg-slate-900 border border-border dark:border-slate-700 rounded shadow-lg z-30 grid grid-cols-8 gap-0.5 w-max">
                {colors.map(c => (
                  <button 
                    key={c} 
                    className="w-4 h-4 border border-slate-200 hover:scale-110 transition-transform cursor-pointer" 
                    style={{backgroundColor: c}} 
                    onClick={() => { applyCustomStyle('backgroundColor', c); setIsBgColorPickerOpen(false); }} 
                    title={c}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Group 3: Paragraph & List */}
        <div className="flex items-center gap-0.5 border-r border-border pr-2">
          <div className="relative" ref={alignDropdownRef}>
            <button 
              type="button" 
              onClick={() => setIsAlignDropdownOpen(!isAlignDropdownOpen)} 
              className="flex items-center justify-center h-7 px-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 gap-0.5"
              title="정렬"
            >
              {editor?.isActive({ textAlign: 'center' }) ? <AlignCenter size={14} className="text-indigo-500" /> :
               editor?.isActive({ textAlign: 'right' }) ? <AlignRight size={14} className="text-indigo-500" /> :
               editor?.isActive({ textAlign: 'justify' }) ? <AlignJustify size={14} className="text-indigo-500" /> :
               <AlignLeft size={14} className={editor?.isActive({ textAlign: 'left' }) ? "text-indigo-500" : ""} />}
            </button>
            {isAlignDropdownOpen && (
              <div className="absolute left-0 mt-1 p-1 bg-white dark:bg-slate-900 border border-border dark:border-slate-700 rounded shadow-lg z-30 flex flex-col gap-0.5">
                <button type="button" onClick={() => { editor?.chain().focus().setTextAlign('left').run(); setIsAlignDropdownOpen(false); }} className={`w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive({ textAlign: 'left' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500' : ''}`}><AlignLeft size={14} /></button>
                <button type="button" onClick={() => { editor?.chain().focus().setTextAlign('center').run(); setIsAlignDropdownOpen(false); }} className={`w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive({ textAlign: 'center' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500' : ''}`}><AlignCenter size={14} /></button>
                <button type="button" onClick={() => { editor?.chain().focus().setTextAlign('right').run(); setIsAlignDropdownOpen(false); }} className={`w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive({ textAlign: 'right' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500' : ''}`}><AlignRight size={14} /></button>
                <button type="button" onClick={() => { editor?.chain().focus().setTextAlign('justify').run(); setIsAlignDropdownOpen(false); }} className={`w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive({ textAlign: 'justify' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500' : ''}`}><AlignJustify size={14} /></button>
              </div>
            )}
          </div>
          <div className="relative" ref={listDropdownRef}>
            <button 
              type="button" 
              onClick={() => setIsListDropdownOpen(!isListDropdownOpen)} 
              className="flex items-center justify-center h-7 px-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 gap-0.5"
              title="목록"
            >
              <ListIcon size={14} className={editor?.isActive('bulletList') || editor?.isActive('orderedList') || editor?.isActive('taskList') ? "text-indigo-500" : ""} />
            </button>
            {isListDropdownOpen && (
              <div className="absolute left-0 mt-1 p-2 bg-white dark:bg-slate-900 border border-border dark:border-slate-700 rounded shadow-lg z-30 flex flex-col gap-2 w-max">
                {/* Ordered Lists */}
                <div className="flex items-center gap-1">
                  <button type="button" className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive('orderedList', { type: '1' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500 font-bold' : ''}`} onClick={() => setOrderedListType('1')} title="1. 2. 3."><span className="text-xs font-serif">1.</span></button>
                  <button type="button" className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive('orderedList', { type: 'A' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500 font-bold' : ''}`} onClick={() => setOrderedListType('A')} title="A. B. C."><span className="text-xs font-serif">A.</span></button>
                  <button type="button" className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive('orderedList', { type: 'a' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500 font-bold' : ''}`} onClick={() => setOrderedListType('a')} title="a. b. c."><span className="text-xs font-serif">a.</span></button>
                  <button type="button" className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive('orderedList', { type: 'I' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500 font-bold' : ''}`} onClick={() => setOrderedListType('I')} title="I. II. III."><span className="text-xs font-serif">I.</span></button>
                  <button type="button" className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive('orderedList', { type: 'i' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500 font-bold' : ''}`} onClick={() => setOrderedListType('i')} title="i. ii. iii."><span className="text-xs font-serif">i.</span></button>
                </div>
                <div className="border-t border-border" />
                {/* Unordered Lists */}
                <div className="flex items-center gap-1">
                  <button type="button" className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive('bulletList', { style: 'square' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500 font-bold' : ''}`} onClick={() => setBulletListStyle('square')} title="Square"><span className="text-[10px]">■</span></button>
                  <button type="button" className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive('bulletList', { style: 'disc' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500 font-bold' : ''}`} onClick={() => setBulletListStyle('disc')} title="Disc"><span className="text-[10px]">●</span></button>
                  <button type="button" className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive('bulletList', { style: 'circle' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500 font-bold' : ''}`} onClick={() => setBulletListStyle('circle')} title="Circle"><span className="text-[10px]">○</span></button>
                  <button type="button" className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive('bulletList', { style: '-' }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500 font-bold' : ''}`} onClick={() => setBulletListStyle('-')} title="Dash"><span className="text-xs font-bold">-</span></button>
                </div>
                <div className="border-t border-border" />
                <div className="flex items-center gap-1">
                  <button type="button" className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => { editor?.chain().focus().clearNodes().run(); setIsListDropdownOpen(false); }} title="없음"><span className="text-xs font-bold text-slate-400">Ø</span></button>
                </div>
              </div>
            )}
          </div>
          <button type="button" onClick={() => editor?.chain().focus().outdent().run()} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors" title="내어쓰기"><CustomOutdentIcon size={14} /></button>
          <button type="button" onClick={() => editor?.chain().focus().indent().run()} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors" title="들여쓰기"><CustomIndentIcon size={14} /></button>
          <div className="relative" ref={lineHeightDropdownRef}>
            <button 
              type="button" 
              onClick={() => setIsLineHeightDropdownOpen(!isLineHeightDropdownOpen)} 
              className="flex items-center justify-center h-7 px-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 gap-0.5"
              title="줄간격"
            >
              <CustomLineHeightIcon size={14} />
            </button>
            {isLineHeightDropdownOpen && (
              <div className="absolute left-0 mt-1 p-1 bg-white dark:bg-slate-900 border border-border dark:border-slate-700 rounded shadow-lg z-30 flex flex-col gap-0.5 w-24">
                {['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'].map(lh => (
                  <button 
                    key={lh} 
                    type="button" 
                    onClick={() => { editor?.chain().focus().setLineHeight(lh).run(); setIsLineHeightDropdownOpen(false); }} 
                    className={`w-full text-left px-3 py-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 ${editor?.isActive({ lineHeight: lh }) ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500 font-bold' : ''}`}
                  >
                    {lh}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Group 4: Clear Formatting */}
        <div className="flex items-center gap-0.5 border-r border-border pr-2">
          <button type="button" onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors" title="서식 지우기"><span className="text-xs font-bold text-slate-600">Tx</span></button>
        </div>

        {/* Group 5: Insert (individual buttons) */}
        <div className="flex items-center gap-0.5">
          {/* Link */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addLink}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors text-slate-600 dark:text-slate-400"
            title="링크"
          >
            <LinkIcon size={14} />
          </button>
          {/* Image */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={addImage}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors text-slate-600 dark:text-slate-400"
            title="이미지"
          >
            <ImageIcon size={14} />
          </button>
          {/* Horizontal rule */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors text-slate-600 dark:text-slate-400"
            title="구분선"
          >
            <Minus size={14} />
          </button>

          {/* Special characters */}
          <div className="relative" ref={specialCharRef}>
            <button
              type="button"
              onClick={() => setIsSpecialCharOpen(!isSpecialCharOpen)}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors text-slate-600 dark:text-slate-400"
              title="특수문자"
            >
              <span className="text-center">※</span>
            </button>
            {isSpecialCharOpen && (
              <div className="absolute left-0 mt-1 p-2 bg-white dark:bg-slate-900 border border-border dark:border-slate-700 rounded-md shadow-xl z-30 grid grid-cols-10 gap-1 w-max max-h-[220px] overflow-y-auto custom-scrollbar">
                {specialCharacters.map((char, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { editor?.chain().focus().insertContent(char).run(); setIsSpecialCharOpen(false); }}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-sm cursor-pointer"
                  >
                    {char}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Emoji */}
          <div className="relative" ref={emojiRef}>
            <button
              type="button"
              onClick={() => setIsEmojiOpen(!isEmojiOpen)}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors text-slate-600 dark:text-slate-400"
              title="이모지"
            >
              <Smile size={14} />
            </button>
            {isEmojiOpen && (
              <div className="absolute left-0 mt-1 z-30 shadow-xl rounded-xl overflow-hidden border border-border dark:border-slate-700">
                <Picker data={data} onEmojiSelect={(emoji: any) => { editor?.chain().focus().insertContent(emoji.native).run(); setIsEmojiOpen(false); }} theme="light" locale="ko" />
              </div>
            )}
          </div>

          {/* Table */}
          <div className="relative" ref={tableSelectorRef}>
            <button
              type="button"
              onClick={() => setIsTableSelectorOpen(!isTableSelectorOpen)}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors text-slate-600 dark:text-slate-400"
              title="표"
            >
              <TableIcon size={14} />
            </button>
            {isTableSelectorOpen && (
              <div className="absolute left-0 mt-1 p-3 bg-white dark:bg-slate-900 border border-border dark:border-slate-700 rounded-md shadow-xl z-30 flex flex-col gap-3 w-64">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">표 삽입 <span className="text-indigo-500">{hoveredGrid.r >= 0 ? hoveredGrid.c + 1 : tableConfig.cols}x{hoveredGrid.r >= 0 ? hoveredGrid.r + 1 : tableConfig.rows}</span></span>
                      <button type="button" onClick={() => setShowTableDetails(!showTableDetails)} className="text-xs text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300">세부 설정</button>
                    </div>
                    <div
                      className="flex flex-col gap-0.5"
                      onMouseLeave={() => setHoveredGrid({ r: -1, c: -1 })}
                    >
                      {Array.from({ length: 10 }).map((_, r) => (
                        <div key={r} className="flex gap-0.5">
                          {Array.from({ length: 10 }).map((_, c) => {
                            const isHighlighted = r <= hoveredGrid.r && c <= hoveredGrid.c;
                            return (
                              <div
                                key={c}
                                onMouseEnter={() => { setHoveredGrid({ r, c }); setTableConfig(prev => ({ ...prev, rows: r + 1, cols: c + 1 })); }}
                                onClick={() => { insertGridTable(r + 1, c + 1); setIsTableSelectorOpen(false); }}
                                className={`w-5 h-5 border cursor-pointer ${isHighlighted ? 'bg-indigo-100 border-indigo-300 dark:bg-indigo-900/40 dark:border-indigo-700' : 'bg-white border-slate-200 hover:border-indigo-400 dark:bg-slate-800 dark:border-slate-700'}`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                    {showTableDetails && (
                      <div className="flex flex-col gap-2 pt-2 border-t border-border text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">열 개수</span>
                          <input type="number" min="1" max="20" value={tableConfig.cols} onChange={(e) => setTableConfig(prev => ({ ...prev, cols: parseInt(e.target.value) || 1 }))} className="w-16 border border-border rounded px-1 py-0.5 text-right bg-transparent" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">행 개수</span>
                          <input type="number" min="1" max="20" value={tableConfig.rows} onChange={(e) => setTableConfig(prev => ({ ...prev, rows: parseInt(e.target.value) || 1 }))} className="w-16 border border-border rounded px-1 py-0.5 text-right bg-transparent" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">테두리두께</span>
                          <select value={tableConfig.borderWidth} onChange={(e) => setTableConfig(prev => ({ ...prev, borderWidth: e.target.value }))} className="w-24 border border-border rounded px-1 py-0.5 bg-transparent">
                            <option value="0px">없음</option>
                            <option value="1px">1px</option>
                            <option value="2px">2px</option>
                            <option value="3px">3px</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">테두리색</span>
                          <input type="color" value={tableConfig.borderColor} onChange={(e) => setTableConfig(prev => ({ ...prev, borderColor: e.target.value }))} className="w-24 h-6 border border-border rounded p-0 cursor-pointer" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 dark:text-slate-400">셀배경색</span>
                          <input type="color" value={tableConfig.backgroundColor || '#ffffff'} onChange={(e) => setTableConfig(prev => ({ ...prev, backgroundColor: e.target.value }))} className="w-24 h-6 border border-border rounded p-0 cursor-pointer" />
                        </div>
                        <div className="flex justify-end mt-1">
                          <button type="button" onClick={() => { insertGridTable(tableConfig.rows, tableConfig.cols); setIsTableSelectorOpen(false); }} className="flex items-center gap-1 text-indigo-500 hover:text-indigo-600 font-bold">
                            <Check size={14} /> 적용
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
        </div>

        {/* Right-aligned: HTML source-mode toggle */}
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            type="button"
            onClick={() => setIsSourceMode(v => !v)}
            className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors ${isSourceMode ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : ''}`}
            title="HTML 소스 보기"
          >
            <Code size={14} />
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="relative flex-1 rounded-b-xl overflow-hidden mt-1" style={{ minHeight: `${height}px` }}>

        {/* Floating Table Tools Overlay — positioned above the active table */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-20 transition-all duration-200 ${
            isInsideTable && !isSourceMode && tableToolbarPos.visible
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
          style={{ top: `${tableToolbarPos.top}px` }}
        >
          <div className="flex items-center gap-0.5 px-2 py-1 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-lg ring-1 ring-black/5 dark:ring-white/10 select-none whitespace-nowrap">
            <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px] mr-1 tracking-wide pl-1 whitespace-nowrap">표 도구</span>

            {/* 셀 병합/분할 (컨텍스트별 토글) */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={mergeCells}
              disabled={!canMerge}
              className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                canMerge ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40' : 'text-slate-500 dark:text-slate-400'
              }`}
              title="셀 병합"
            >
              <TableCellsMerge size={12} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={splitCell}
              disabled={!canSplit}
              className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                canSplit ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40' : 'text-slate-500 dark:text-slate-400'
              }`}
              title="셀 분할"
            >
              <TableCellsSplit size={12} />
            </button>

            <div className="w-px h-4 bg-border mx-0.5" />

            {/* 헤더 토글 */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleHeaderColumn}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none text-slate-600 dark:text-slate-400 transition-colors"
              title="헤더 열 전환"
            >
              <TableColumnsSplit size={12} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleHeaderRow}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none text-slate-600 dark:text-slate-400 transition-colors"
              title="헤더 행 전환"
            >
              <TableRowsSplit size={12} />
            </button>

            <div className="w-px h-4 bg-border mx-0.5" />

            {/* 셀 스타일 */}
            <div className="relative" ref={cellBgColorRef}>
              <button
                type="button"
                onClick={() => setIsCellBgColorOpen(!isCellBgColorOpen)}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none text-slate-600 dark:text-slate-400 transition-colors"
                title="셀 배경색"
              >
                <PaintBucket size={12} />
              </button>
              {isCellBgColorOpen && (
                <div className="absolute left-0 mt-1 p-1.5 bg-white dark:bg-slate-900 border border-border dark:border-slate-700 rounded-md shadow-lg z-30 grid grid-cols-8 gap-0.5 w-max">
                  <button
                    className="w-4 h-4 border border-slate-200 dark:border-slate-600 hover:scale-110 transition-transform cursor-pointer"
                    style={{ backgroundColor: 'transparent', backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)', backgroundSize: '6px 6px', backgroundPosition: '0 0, 3px 3px' }}
                    onClick={() => { applyCellStyle('background-color', ''); setIsCellBgColorOpen(false); }}
                    title="없음"
                  />
                  {colors.map(c => (
                    <button
                      key={c}
                      className="w-4 h-4 border border-slate-200 dark:border-slate-600 hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: c }}
                      onClick={() => { applyCellStyle('background-color', c); setIsCellBgColorOpen(false); }}
                      title={c}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="relative" ref={cellBorderColorRef}>
              <button
                type="button"
                onClick={() => setIsCellBorderColorOpen(!isCellBorderColorOpen)}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none text-slate-600 dark:text-slate-400 transition-colors"
                title="셀 테두리색"
              >
                <Paintbrush size={12} />
              </button>
              {isCellBorderColorOpen && (
                <div className="absolute left-0 mt-1 p-1.5 bg-white dark:bg-slate-900 border border-border dark:border-slate-700 rounded-md shadow-lg z-30 grid grid-cols-8 gap-0.5 w-max">
                  <button
                    className="w-4 h-4 border border-slate-200 dark:border-slate-600 hover:scale-110 transition-transform cursor-pointer"
                    style={{ backgroundColor: 'transparent', backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)', backgroundSize: '6px 6px', backgroundPosition: '0 0, 3px 3px' }}
                    onClick={() => { applyCellStyle('border-color', ''); setIsCellBorderColorOpen(false); }}
                    title="없음"
                  />
                  {colors.map(c => (
                    <button
                      key={c}
                      className="w-4 h-4 border border-slate-200 dark:border-slate-600 hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: c }}
                      onClick={() => { applyCellStyle('border-color', c); setIsCellBorderColorOpen(false); }}
                      title={c}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-4 bg-border mx-0.5" />

            {/* 열 추가/삭제 */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addColumn('before')}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none text-slate-600 dark:text-slate-400 transition-colors"
              title="왼쪽에 열 추가"
            >
              <CustomAddColLeftIcon size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addColumn('after')}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none text-slate-600 dark:text-slate-400 transition-colors"
              title="오른쪽에 열 추가"
            >
              <CustomAddColRightIcon size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={deleteColumn}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none text-red-500 transition-colors"
              title="열 삭제"
            >
              <CustomDeleteColIcon size={14} />
            </button>

            <div className="w-px h-4 bg-border mx-0.5" />

            {/* 행 추가/삭제 */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addRow('before')}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none text-slate-600 dark:text-slate-400 transition-colors"
              title="위쪽에 행 추가"
            >
              <CustomAddRowAboveIcon size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addRow('after')}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none text-slate-600 dark:text-slate-400 transition-colors"
              title="아래쪽에 행 추가"
            >
              <CustomAddRowBelowIcon size={14} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={deleteRow}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none text-red-500 transition-colors"
              title="행 삭제"
            >
              <CustomDeleteRowIcon size={14} />
            </button>

            <div className="w-px h-4 bg-border mx-0.5" />

            {/* 표 삭제 */}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={deleteTable}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-100 dark:hover:bg-red-950/60 focus-visible:ring-2 focus-visible:ring-indigo-400/50 focus:outline-none text-red-600 dark:text-red-400 transition-colors"
              title="표 삭제"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {isSourceMode ? (
          <textarea
            value={htmlValue}
            onChange={handleSourceChange}
            disabled={disabled}
            className="w-full h-full p-4 font-mono text-sm border-none bg-slate-50 dark:bg-slate-900/50 text-foreground resize-none focus:outline-none focus:ring-0 absolute inset-0 custom-scrollbar rounded-b-xl"
            style={{ minHeight: `${height}px` }}
          />
        ) : (
          <div
            className="w-full h-full absolute inset-0 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950 rounded-b-xl cursor-text"
            onClick={() => editor?.commands.focus()}
          >
            <EditorContent
              editor={editor}
              className="w-full h-full px-6 pt-0 pb-5 focus:outline-none text-foreground prose dark:prose-invert max-w-none text-sm leading-relaxed [&>.tiptap>*:first-child]:mt-1"
              style={{ minHeight: `${height}px`, outline: 'none' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
