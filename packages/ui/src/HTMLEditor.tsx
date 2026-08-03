import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { sanitizeHtml } from 'shared/lib/sanitize';
import { buildExtensions } from './editor/extensions';
import { createImageHandlers } from './editor/imageUpload';
import { usePopovers } from './editor/usePopovers';
import { useEditorCommands } from './editor/useEditorCommands';
import { useEditorSelectionState } from './editor/useEditorSelectionState';
import { useTableRowResize } from './editor/useTableRowResize';
import { useUrlPrompt } from './editor/useUrlPrompt';
import { EditorToolbar } from './editor/toolbar/EditorToolbar';
import { TableFloatingToolbar } from './editor/TableFloatingToolbar';
import { LinkFloatingToolbar } from './editor/LinkFloatingToolbar';
import { UrlPromptDialog } from './editor/UrlPromptDialog';
import { DEFAULT_HTML_EDITOR_LABELS } from './editor/labels';
import type { HTMLEditorLabels } from './editor/labels';

/** 빈 문단에 data-placeholder를 노출하는 CSS (소스 모드에는 적용되지 않음) */
const PLACEHOLDER_STYLE = `
  [data-html-editor] .tiptap p.is-editor-empty::before,
  [data-html-editor] .tiptap .is-empty::before {
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
    color: #94a3b8;
  }
`;

interface HTMLEditorProps {
  value: string;
  onChange: (val: string) => void;
  height?: number;
  disabled?: boolean;
  /** 빈 문서일 때 에디터에 표시할 안내 문구 (소스 모드에서는 미표시) */
  placeholder?: string;
  /** 사용자 노출 문구 주입 (없으면 한국어 기본값) */
  labels?: HTMLEditorLabels;
  /** 이미지 파일 업로드 콜백 (드래그/붙여넣기 지원용) */
  onUploadImage?: (file: File) => Promise<string>;
}

export function HTMLEditor({
  value,
  onChange,
  height = 400,
  disabled = false,
  placeholder = '',
  labels = DEFAULT_HTML_EDITOR_LABELS,
  onUploadImage,
}: HTMLEditorProps) {
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [htmlValue, setHtmlValue] = useState(value);

  // 플로팅 툴바 위치 계산용 (CSS 클래스 문자열 의존 제거)
  const editorContentRef = useRef<HTMLDivElement>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: buildExtensions(placeholder),
    content: sanitizeHtml(value || '<p></p>'),
    editable: !disabled,
    onUpdate({ editor }) {
      const html = sanitizeHtml(editor.getHTML());
      setHtmlValue(html);
      onChange(html);
    },
    editorProps: createImageHandlers(onUploadImage),
    // placeholder prop이 바뀌면 에디터를 재생성하여 동적으로 반영
  }, [placeholder]);

  const popovers = usePopovers(!isSourceMode);
  const commands = useEditorCommands(editor);
  const selection = useEditorSelectionState({
    editor,
    isSourceMode,
    contentRef: editorContentRef,
    scrollRef: editorScrollRef,
  });
  const urlPrompt = useUrlPrompt(editor, labels);
  useTableRowResize(editor);

  // props의 value를 에디터로 동기화
  useEffect(() => {
    if (!editor || isSourceMode) return;
    const currentHTML = editor.getHTML();
    const nextValue = sanitizeHtml(value || '<p></p>');
    if (currentHTML !== nextValue) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
    }
  }, [value, editor, isSourceMode]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // 소스 모드에서도 내보내는 HTML은 반드시 sanitize를 통과시킨다
    setHtmlValue(e.target.value);
    onChange(sanitizeHtml(e.target.value));
  };

  const toggleSourceMode = () => {
    if (!editor) {
      setIsSourceMode(prev => !prev);
      return;
    }
    if (isSourceMode) {
      // 소스 → WYSIWYG 복귀: sanitize 후 에디터 상태로 동기화하고 커서 복원
      const safe = sanitizeHtml(htmlValue || '<p></p>');
      editor.commands.setContent(safe, { emitUpdate: false });
      setHtmlValue(safe);
      onChange(safe);
      setIsSourceMode(false);
      requestAnimationFrame(() => editor.commands.focus('end'));
    } else {
      setHtmlValue(sanitizeHtml(editor.getHTML()));
      selection.clearLinkState();
      setIsSourceMode(true);
    }
  };

  const handleEditActiveLink = () => {
    if (!selection.activeLinkHref) return;
    const href = selection.activeLinkHref;
    selection.clearLinkState();
    urlPrompt.openLink(href);
  };

  const handleUnlink = () => {
    editor?.chain().focus().unsetLink().run();
    selection.clearLinkState();
  };

  const handleDeleteTable = () => {
    commands.deleteTable();
    selection.clearTableState();
  };

  return (
    <div className="border border-border rounded-xl flex flex-col bg-white dark:bg-slate-950 shadow-sm transition-all duration-200 relative">
      <style>{PLACEHOLDER_STYLE}</style>

      <EditorToolbar
        editor={editor}
        labels={labels}
        commands={commands}
        popovers={popovers}
        disabled={disabled}
        isSourceMode={isSourceMode}
        onAddLink={() => urlPrompt.openLink()}
        onAddImage={urlPrompt.openImage}
        onToggleSourceMode={toggleSourceMode}
      />

      <div
        ref={editorContentRef}
        data-html-editor
        className="relative flex-1 rounded-b-xl overflow-hidden mt-1"
        style={{ minHeight: `${height}px` }}
      >
        <TableFloatingToolbar
          labels={labels}
          commands={commands}
          popovers={popovers}
          visible={selection.isInsideTable && !isSourceMode && selection.tableToolbarPos.visible}
          position={selection.tableToolbarPos}
          canMerge={selection.canMerge}
          canSplit={selection.canSplit}
          onDeleteTable={handleDeleteTable}
        />

        {selection.activeLinkHref && selection.linkToolbarPos.visible && !isSourceMode && (
          <LinkFloatingToolbar
            href={selection.activeLinkHref}
            position={selection.linkToolbarPos}
            labels={labels}
            onEdit={handleEditActiveLink}
            onUnlink={handleUnlink}
          />
        )}

        {isSourceMode ? (
          <textarea
            value={htmlValue}
            onChange={handleSourceChange}
            disabled={disabled}
            className="w-full h-full p-4 font-mono text-sm border-none bg-slate-50 dark:bg-slate-900/50 text-foreground resize-none focus:outline-none focus:ring-0 absolute inset-0 custom-scrollbar rounded-b-xl"
          />
        ) : (
          <div
            ref={editorScrollRef}
            className="w-full h-full absolute inset-0 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950 rounded-b-xl cursor-text"
            onClick={() => editor?.commands.focus()}
          >
            <EditorContent
              editor={editor}
              className="w-full min-h-full px-6 py-4 focus:outline-none text-foreground prose dark:prose-invert max-w-none text-sm leading-relaxed [&>.tiptap>*:first-child]:mt-1"
              style={{ outline: 'none' }}
            />
          </div>
        )}
      </div>

      {urlPrompt.prompt && (
        <UrlPromptDialog
          mode={urlPrompt.prompt.mode}
          value={urlPrompt.prompt.value}
          error={urlPrompt.error}
          labels={labels}
          onChange={urlPrompt.change}
          onCancel={urlPrompt.cancel}
          onSubmit={urlPrompt.submit}
        />
      )}
    </div>
  );
}

export { createHTMLEditorLabels, DEFAULT_HTML_EDITOR_LABELS } from './editor/labels';
export type { HTMLEditorLabels, EditorLanguage } from './editor/labels';
