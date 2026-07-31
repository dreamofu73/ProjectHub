import { Code } from 'lucide-react';
import { FontGroup } from './FontGroup';
import { HeadingMenu } from './HeadingMenu';
import { InsertGroup } from './InsertGroup';
import { ParagraphGroup } from './ParagraphGroup';
import { TextStyleGroup } from './TextStyleGroup';
import { ToolbarButton } from './ToolbarButton';
import type { ToolbarGroupProps } from './types';

type Props = ToolbarGroupProps & {
  onAddLink: () => void;
  onAddImage: () => void;
  onToggleSourceMode: () => void;
};

/** 에디터 상단 툴바 — 그룹 컴포넌트를 배치하고 Escape로 모든 팝오버를 닫는다 */
export function EditorToolbar({
  editor, labels, commands, popovers, disabled, isSourceMode,
  onAddLink, onAddImage, onToggleSourceMode,
}: Props) {
  const groupProps = { editor, labels, commands, popovers, disabled, isSourceMode };

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 p-1 bg-slate-100 dark:bg-slate-900 border-b border-border select-none shrink-0 rounded-t-xl relative z-20"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          popovers.closeAll();
        }
      }}
    >
      <HeadingMenu {...groupProps} />
      <FontGroup {...groupProps} />
      <TextStyleGroup {...groupProps} />
      <ParagraphGroup {...groupProps} />

      {/* 서식 지우기 */}
      <div className="flex items-center gap-0.5 border-r border-border pr-2">
        <ToolbarButton
          onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
          title={labels.clearFormatting}
        >
          <span className="text-xs font-bold text-slate-600">Tx</span>
        </ToolbarButton>
      </div>

      <InsertGroup {...groupProps} onAddLink={onAddLink} onAddImage={onAddImage} />

      {/* 우측 정렬: HTML 소스 모드 토글 */}
      <div className="flex items-center gap-0.5 ml-auto">
        <ToolbarButton
          onClick={onToggleSourceMode}
          title={labels.sourceView}
          pressed={isSourceMode}
          className={isSourceMode ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : ''}
        >
          <Code size={14} />
        </ToolbarButton>
      </div>
    </div>
  );
}
