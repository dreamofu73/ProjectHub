import { ChevronDown } from 'lucide-react';
import { EDITOR_FONTS, EDITOR_FONT_SIZES } from '../constants';
import { MENU_PANEL_CLASS } from './ToolbarButton';
import { SELECT_TRIGGER_CLASS, type ToolbarGroupProps } from './types';

type Props = Pick<ToolbarGroupProps, 'editor' | 'labels' | 'commands' | 'popovers' | 'disabled' | 'isSourceMode'>;

/** 글꼴 / 글자 크기 드롭다운 */
export function FontGroup({ editor, labels, commands, popovers, disabled, isSourceMode }: Props) {
  const isFontOpen = popovers.isOpen('font');
  const isSizeOpen = popovers.isOpen('size');

  return (
    <div className="flex items-center gap-0.5 border-r border-border pr-2">
      <div className="relative" ref={popovers.refs.font}>
        <button
          type="button"
          disabled={isSourceMode || disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => popovers.toggle('font')}
          className={`${SELECT_TRIGGER_CLASS} font-medium min-w-[90px]`}
          title={labels.font}
          aria-haspopup="menu"
          aria-expanded={isFontOpen}
        >
          <span className="truncate">{labels.font}</span>
          <ChevronDown size={12} className="opacity-60 shrink-0" />
        </button>

        {isFontOpen && (
          <div className={`${MENU_PANEL_CLASS} left-0 shadow-xl p-1 min-w-[120px]`} onKeyDown={popovers.handleMenuKeyDown}>
            {EDITOR_FONTS.map((font) => (
              <button
                key={font.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { commands.applyTextStyle('fontFamily', font.value); popovers.close('font'); }}
                className="w-full text-left px-2 py-1 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground cursor-pointer"
                style={{ fontFamily: font.value }}
              >
                {font.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative" ref={popovers.refs.size}>
        <button
          type="button"
          disabled={isSourceMode || disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => popovers.toggle('size')}
          className={`${SELECT_TRIGGER_CLASS} font-medium min-w-[60px]`}
          title={labels.fontSize}
          aria-label={labels.fontSize}
          aria-haspopup="menu"
          aria-expanded={isSizeOpen}
        >
          <span className="truncate">{labels.sizeLabel}</span>
          <ChevronDown size={12} className="opacity-60 shrink-0" />
        </button>

        {isSizeOpen && (
          <div
            className={`${MENU_PANEL_CLASS} left-0 shadow-xl p-1 w-[346px] max-h-[400px] overflow-y-auto overflow-x-hidden custom-scrollbar`}
            onKeyDown={popovers.handleMenuKeyDown}
          >
            {EDITOR_FONT_SIZES.map((size) => {
              const isActive = editor?.isActive('textStyle', { fontSize: size.value });
              return (
                <button
                  key={size.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { commands.applyTextStyle('fontSize', size.value); popovers.close('size'); }}
                  className={`w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${
                    isActive ? 'text-indigo-500 font-bold bg-indigo-50 dark:bg-indigo-900/20' : 'text-foreground'
                  }`}
                  style={{ fontSize: size.value, lineHeight: 1.2 }}
                >
                  {labels.fontSizePreview(size.label)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
