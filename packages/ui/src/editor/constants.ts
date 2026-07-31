/** HTMLEditor 툴바에서 사용하는 정적 목록 (폰트/크기/색상/특수문자/줄간격/리스트 스타일) */

export const EDITOR_FONTS = [
  { label: '굴림', value: 'Gulim' },
  { label: '돋움', value: 'Dotum' },
  { label: '바탕', value: 'Batang' },
  { label: '궁서', value: 'Gungsuh' },
  { label: '맑은 고딕', value: 'Malgun Gothic' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Tahoma', value: 'Tahoma' },
  { label: 'Verdana', value: 'Verdana' },
] as const;

export const EDITOR_FONT_SIZES = [
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
] as const;

export const EDITOR_COLORS = [
  '#ffffff', '#f2f2f2', '#d8d8d8', '#bfbfbf', '#a5a5a5', '#7f7f7f', '#3f3f3f', '#000000',
  '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#9900ff', '#ff00ff',
  '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3d85c6', '#674ea7', '#a64d79',
  '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#0b5394', '#351c75', '#741b47',
];

export const SPECIAL_CHARACTERS = [
  '★', '☆', '☎', '☏', '☜', '☞', '♠', '♤', '♣', '♧', '♥', '♡', '◈', '▣', '◐', '◑', '▒', '▤', '♨', '윈', '♬', '♩', '♪', '♭', '㉿', '㈜', '№', '㏇', '™', '㏂', '㉾', '㈛', '㈝', '㈞', '㈟', '㈠', '㈡', '㈢', '㈣', '㈤', '㈥', '㈦', '㈧', '㈨', '㈩', '㈪', '㈫', '㈬', '㈭', '㈮', '㈯', '㈰', '㈱', '㈲', '㈳', '㈴', '㈵', '㈶', '㈷', '㈸', '㈹', '㈺', '㈻', '㈼', '㈽', '㈾', '㈿', '㉀', '㉁', '㉂', '㉃', '㉄', '㉅', '㉆', '㉇', '㉈', '㉉', '㉊', '㉋', '㉌', '㉍', '㉎', '㉏'
];

export const LINE_HEIGHTS = ['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'];

export const ORDERED_LIST_TYPES = [
  { type: '1', glyph: '1.', title: '1. 2. 3.' },
  { type: 'A', glyph: 'A.', title: 'A. B. C.' },
  { type: 'a', glyph: 'a.', title: 'a. b. c.' },
  { type: 'I', glyph: 'I.', title: 'I. II. III.' },
  { type: 'i', glyph: 'i.', title: 'i. ii. iii.' },
];

export const BULLET_LIST_STYLES = [
  { style: 'square', glyph: '■', title: 'Square', glyphClass: 'text-[10px]' },
  { style: 'disc', glyph: '●', title: 'Disc', glyphClass: 'text-[10px]' },
  { style: 'circle', glyph: '○', title: 'Circle', glyphClass: 'text-[10px]' },
  { style: '-', glyph: '-', title: 'Dash', glyphClass: 'text-xs font-bold' },
];

/** 표 삽입 그리드 셀렉터의 행/열 최대치 */
export const TABLE_GRID_SIZE = 10;
