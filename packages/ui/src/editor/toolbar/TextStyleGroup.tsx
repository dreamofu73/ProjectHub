import { Bold, Italic, Strikethrough, Underline as UnderlineIcon } from 'lucide-react';
import { ColorSwatches } from '../ColorSwatches';
import { EDITOR_COLORS } from '../constants';
import { ToolbarButton } from './ToolbarButton';
import type { ToolbarGroupProps } from './types';

type Props = Pick<ToolbarGroupProps, 'editor' | 'labels' | 'commands' | 'popovers'>;

/** 굵게/기울임/밑줄/취소선 + 글자색/배경색 */
export function TextStyleGroup({ editor, labels, commands, popovers }: Props) {
  const marks = [
    { key: 'bold', title: labels.bold, icon: <Bold size={14} />, run: () => editor?.chain().focus().toggleBold().run() },
    { key: 'italic', title: labels.italic, icon: <Italic size={14} />, run: () => editor?.chain().focus().toggleItalic().run() },
    { key: 'underline', title: labels.underline, icon: <UnderlineIcon size={14} />, run: () => editor?.chain().focus().toggleUnderline().run() },
    { key: 'strike', title: labels.strike, icon: <Strikethrough size={14} />, run: () => editor?.chain().focus().toggleStrike().run() },
  ];

  const bgColor = editor?.getAttributes('textStyle').backgroundColor as string | undefined;

  return (
    <div className="flex items-center gap-0.5 border-r border-border pr-2">
      {marks.map((mark) => (
        <ToolbarButton
          key={mark.key}
          keepSelection
          onClick={mark.run}
          title={mark.title}
          pressed={!!editor?.isActive(mark.key)}
        >
          {mark.icon}
        </ToolbarButton>
      ))}

      <div className="relative" ref={popovers.refs.color}>
        <ToolbarButton
          onClick={() => popovers.toggle('color')}
          title={labels.textColor}
          haspopup="dialog"
          expanded={popovers.isOpen('color')}
          className="relative"
        >
          <span className="font-serif font-bold text-[15px] leading-none text-slate-700 dark:text-slate-300 mr-1">T</span>
          <div
            className="absolute bottom-1.5 right-1 w-2 h-2"
            style={{ backgroundColor: (editor?.getAttributes('textStyle').color as string) || '#000000' }}
          />
        </ToolbarButton>
        {popovers.isOpen('color') && (
          <ColorSwatches
            colors={EDITOR_COLORS}
            labels={labels}
            onSelect={(c) => { commands.applyTextStyle('color', c); popovers.close('color'); }}
          />
        )}
      </div>

      <div className="relative" ref={popovers.refs.bgColor}>
        <ToolbarButton
          onClick={() => popovers.toggle('bgColor')}
          title={labels.bgColor}
          haspopup="dialog"
          expanded={popovers.isOpen('bgColor')}
          className="relative"
          style={{
            backgroundColor: bgColor || 'transparent',
            color: bgColor ? '#ffffff' : 'inherit',
            textShadow: bgColor ? '0px 0px 2px rgba(0,0,0,0.3)' : 'none',
          }}
        >
          <span className="font-serif font-bold text-[14px] leading-none">T</span>
        </ToolbarButton>
        {popovers.isOpen('bgColor') && (
          <ColorSwatches
            colors={EDITOR_COLORS}
            labels={labels}
            onSelect={(c) => { commands.applyTextStyle('backgroundColor', c); popovers.close('bgColor'); }}
          />
        )}
      </div>
    </div>
  );
}
