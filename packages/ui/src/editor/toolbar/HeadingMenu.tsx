import { ChevronDown, Heading1, Heading2, Type } from 'lucide-react';
import { MENU_PANEL_CLASS } from './ToolbarButton';
import { MENU_ITEM_CLASS, SELECT_TRIGGER_CLASS, activeTextClass, type ToolbarGroupProps } from './types';

type Props = Pick<ToolbarGroupProps, 'editor' | 'labels' | 'popovers' | 'disabled' | 'isSourceMode'>;

/** 문단/제목(H1~H4) 스타일 콤보 */
export function HeadingMenu({ editor, labels, popovers, disabled, isSourceMode }: Props) {
  const isOpen = popovers.isOpen('heading');
  const headings = [
    { level: 1 as const, label: labels.heading1 },
    { level: 2 as const, label: labels.heading2 },
    { level: 3 as const, label: labels.heading3 },
    { level: 4 as const, label: labels.heading4 },
  ];

  const renderTriggerLabel = () => {
    if (editor?.isActive('heading', { level: 1 })) return <><Heading1 size={14} /> H1</>;
    if (editor?.isActive('heading', { level: 2 })) return <><Heading2 size={14} /> H2</>;
    if (editor?.isActive('heading', { level: 3 })) return <span className="font-bold text-xs">H3</span>;
    if (editor?.isActive('heading', { level: 4 })) return <span className="font-bold text-xs">H4</span>;
    return <span>{labels.paragraph}</span>;
  };

  return (
    <div className="relative" ref={popovers.refs.heading}>
      <button
        type="button"
        disabled={isSourceMode || disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => popovers.toggle('heading')}
        className={`${SELECT_TRIGGER_CLASS} font-semibold min-w-[72px]`}
        title={labels.headingStyle}
        aria-label={labels.headingStyle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {renderTriggerLabel()}
        <ChevronDown size={12} className="opacity-60 shrink-0" />
      </button>

      {isOpen && (
        <div className={`${MENU_PANEL_CLASS} shadow-xl p-1 min-w-[130px]`} onKeyDown={popovers.handleMenuKeyDown}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { editor?.chain().focus().setParagraph().run(); popovers.close('heading'); }}
            className={`${MENU_ITEM_CLASS} ${activeTextClass(!!editor?.isActive('paragraph'))}`}
          >
            <Type size={14} /> {labels.paragraph}
          </button>
          <div className="border-t border-border my-1" />
          {headings.map(({ level, label }) => (
            <button
              key={level}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { editor?.chain().focus().toggleHeading({ level }).run(); popovers.close('heading'); }}
              className={`${MENU_ITEM_CLASS} ${activeTextClass(!!editor?.isActive('heading', { level }))}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
