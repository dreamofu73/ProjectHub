/**
 * HTMLEditor의 모든 사용자 노출 문자열 정의.
 * packages/ui는 앱 컨텍스트(useLanguage)에 의존하지 않으므로 사용처가 labels 객체를 주입한다.
 * 주입이 없으면 한국어 기본값(DEFAULT_HTML_EDITOR_LABELS)을 사용한다.
 */
export type EditorLanguage = 'ko' | 'en' | 'ja' | 'zh';

export interface HTMLEditorLabels {
  headingStyle: string;
  font: string;
  fontSize: string;
  sizeLabel: string;
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  textColor: string;
  bgColor: string;
  align: string;
  list: string;
  outdent: string;
  indent: string;
  lineHeight: string;
  clearFormatting: string;
  link: string;
  image: string;
  divider: string;
  specialChar: string;
  emoji: string;
  table: string;
  sourceView: string;
  paragraph: string;
  heading1: string;
  heading2: string;
  heading3: string;
  heading4: string;
  fontSizePreview: (size: string) => string;
  insertTable: string;
  detailSettings: string;
  apply: string;
  columnCount: string;
  rowCount: string;
  borderWidth: string;
  borderColor: string;
  cellBackgroundColor: string;
  none: string;
  tableTools: string;
  mergeCells: string;
  splitCell: string;
  toggleHeaderColumn: string;
  toggleHeaderRow: string;
  cellBorderColor: string;
  addColumnLeft: string;
  addColumnRight: string;
  deleteColumn: string;
  addRowAbove: string;
  addRowBelow: string;
  deleteRow: string;
  deleteTable: string;
  editLink: string;
  unlink: string;
  insertLink: string;
  insertImage: string;
  enterUrl: string;
  enterImageUrl: string;
  invalidUrl: string;
  cancel: string;
  ok: string;
  emojiLoading: string;
  emojiLocale: EditorLanguage;
}

export const DEFAULT_HTML_EDITOR_LABELS: HTMLEditorLabels = {
  headingStyle: '제목 스타일',
  font: '글꼴',
  fontSize: '글자 크기',
  sizeLabel: '크기',
  bold: '굵게',
  italic: '기울임',
  underline: '밑줄',
  strike: '취소선',
  textColor: '글자색',
  bgColor: '배경색',
  align: '정렬',
  list: '목록',
  outdent: '내어쓰기',
  indent: '들여쓰기',
  lineHeight: '줄간격',
  clearFormatting: '서식 지우기',
  link: '링크',
  image: '이미지',
  divider: '구분선',
  specialChar: '특수문자',
  emoji: '이모지',
  table: '표',
  sourceView: 'HTML 소스 보기',
  paragraph: '본문',
  heading1: '제목1',
  heading2: '제목2',
  heading3: '제목3',
  heading4: '제목4',
  fontSizePreview: (size) => `가나다 (${size})`,
  insertTable: '표 삽입',
  detailSettings: '세부 설정',
  apply: '적용',
  columnCount: '열 개수',
  rowCount: '행 개수',
  borderWidth: '테두리두께',
  borderColor: '테두리색',
  cellBackgroundColor: '셀 배경색',
  none: '없음',
  tableTools: '표 도구',
  mergeCells: '셀 병합',
  splitCell: '셀 분할',
  toggleHeaderColumn: '헤더 열 전환',
  toggleHeaderRow: '헤더 행 전환',
  cellBorderColor: '셀 테두리색',
  addColumnLeft: '왼쪽에 열 추가',
  addColumnRight: '오른쪽에 열 추가',
  deleteColumn: '열 삭제',
  addRowAbove: '위쪽에 행 추가',
  addRowBelow: '아래쪽에 행 추가',
  deleteRow: '행 삭제',
  deleteTable: '표 삭제',
  editLink: '링크 편집',
  unlink: '링크 해제',
  insertLink: '링크 삽입',
  insertImage: '이미지 삽입',
  enterUrl: '연결할 URL 주소를 입력하세요',
  enterImageUrl: '삽입할 이미지 URL 주소를 입력하세요',
  invalidUrl: '허용되지 않는 URL 형식입니다. (http/https/mailto/tel/상대경로만 가능)',
  cancel: '취소',
  ok: '확인',
  emojiLoading: '이모지 불러오는 중...',
  emojiLocale: 'ko',
};

/**
 * 앱의 t() 함수(shared useLanguage)와 editor* 키를 labels 객체로 매핑한다.
 * 키가 빠진 언어라면 t()가 한국어/키 자체를 반환하므로 안전하다.
 */
export function createHTMLEditorLabels(
  t: (key: string) => string,
  language: EditorLanguage = 'ko'
): HTMLEditorLabels {
  return {
    headingStyle: t('editorHeadingStyle'),
    font: t('editorFont'),
    fontSize: t('editorFontSize'),
    sizeLabel: t('editorSizeLabel'),
    bold: t('editorBold'),
    italic: t('editorItalic'),
    underline: t('editorUnderline'),
    strike: t('editorStrike'),
    textColor: t('editorTextColor'),
    bgColor: t('editorBgColor'),
    align: t('editorAlign'),
    list: t('editorList'),
    outdent: t('editorOutdent'),
    indent: t('editorIndent'),
    lineHeight: t('editorLineHeight'),
    clearFormatting: t('editorClearFormatting'),
    link: t('editorLink'),
    image: t('editorImage'),
    divider: t('editorDivider'),
    specialChar: t('editorSpecialChar'),
    emoji: t('editorEmoji'),
    table: t('editorTable'),
    sourceView: t('editorSourceView'),
    paragraph: t('editorParagraph'),
    heading1: t('editorHeading1'),
    heading2: t('editorHeading2'),
    heading3: t('editorHeading3'),
    heading4: t('editorHeading4'),
    fontSizePreview: (size) => t('editorFontSizePreview').replace('{size}', size),
    insertTable: t('editorInsertTable'),
    detailSettings: t('editorDetailSettings'),
    apply: t('editorApply'),
    columnCount: t('editorColumnCount'),
    rowCount: t('editorRowCount'),
    borderWidth: t('editorBorderWidth'),
    borderColor: t('editorBorderColor'),
    cellBackgroundColor: t('editorCellBackgroundColor'),
    none: t('editorNone'),
    tableTools: t('editorTableTools'),
    mergeCells: t('editorMergeCells'),
    splitCell: t('editorSplitCell'),
    toggleHeaderColumn: t('editorToggleHeaderColumn'),
    toggleHeaderRow: t('editorToggleHeaderRow'),
    cellBorderColor: t('editorCellBorderColor'),
    addColumnLeft: t('editorAddColumnLeft'),
    addColumnRight: t('editorAddColumnRight'),
    deleteColumn: t('editorDeleteColumn'),
    addRowAbove: t('editorAddRowAbove'),
    addRowBelow: t('editorAddRowBelow'),
    deleteRow: t('editorDeleteRow'),
    deleteTable: t('editorDeleteTable'),
    editLink: t('editorEditLink'),
    unlink: t('editorUnlink'),
    insertLink: t('editorInsertLink'),
    insertImage: t('editorInsertImage'),
    enterUrl: t('editorEnterUrl'),
    enterImageUrl: t('editorEnterImageUrl'),
    invalidUrl: t('editorInvalidUrl'),
    cancel: t('editorCancel'),
    ok: t('editorOk'),
    emojiLoading: t('editorEmojiLoading'),
    emojiLocale: language,
  };
}
