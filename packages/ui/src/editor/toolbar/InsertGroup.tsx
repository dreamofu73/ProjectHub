import React from 'react';
import { Image as ImageIcon, Link as LinkIcon, Minus, Smile } from 'lucide-react';
import { EmojiPicker } from '../EmojiPicker';
import { SPECIAL_CHARACTERS } from '../constants';
import { useFlipPosition } from '../useFlipPosition';
import { MENU_PANEL_CLASS, ToolbarButton } from './ToolbarButton';
import { TableInsertMenu } from './TableInsertMenu';
import type { ToolbarGroupProps } from './types';

type Props = Pick<ToolbarGroupProps, 'editor' | 'labels' | 'commands' | 'popovers'> & {
  onAddLink: () => void;
  onAddImage: () => void;
};

const ICON_BUTTON_CLASS = 'text-slate-600 dark:text-slate-400';

/** 링크 / 이미지 / 구분선 / 특수문자 / 이모지 / 표 삽입 */
export function InsertGroup({ editor, labels, commands, popovers, onAddLink, onAddImage }: Props) {
  const specialCharAlign = useFlipPosition(popovers.refs.specialChar, popovers.isOpen('specialChar'));
  const emojiAlign = useFlipPosition(popovers.refs.emoji, popovers.isOpen('emoji'), 360);

  return (
    <div className="flex items-center gap-0.5">
      <ToolbarButton keepSelection onClick={onAddLink} title={labels.link} className={ICON_BUTTON_CLASS}>
        <LinkIcon size={14} />
      </ToolbarButton>
      <ToolbarButton keepSelection onClick={onAddImage} title={labels.image} className={ICON_BUTTON_CLASS}>
        <ImageIcon size={14} />
      </ToolbarButton>
      <ToolbarButton
        keepSelection
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        title={labels.divider}
        className={ICON_BUTTON_CLASS}
      >
        <Minus size={14} />
      </ToolbarButton>

      {/* 특수문자 */}
      <div className="relative" ref={popovers.refs.specialChar}>
        <ToolbarButton
          onClick={() => popovers.toggle('specialChar')}
          title={labels.specialChar}
          haspopup="menu"
          expanded={popovers.isOpen('specialChar')}
          className={ICON_BUTTON_CLASS}
        >
          <span className="text-center">※</span>
        </ToolbarButton>
        {popovers.isOpen('specialChar') && (
          <div
            className={`${MENU_PANEL_CLASS} ${specialCharAlign} dark:border-slate-700 shadow-xl p-2 rounded-md grid grid-cols-10 gap-1 w-max max-h-[220px] overflow-y-auto overflow-x-auto custom-scrollbar`}
            onKeyDown={popovers.handleMenuKeyDown}
          >
            {SPECIAL_CHARACTERS.map((char, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => { editor?.chain().focus().insertContent(char).run(); popovers.close('specialChar'); }}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-sm cursor-pointer"
              >
                {char}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 이모지 */}
      <div className="relative" ref={popovers.refs.emoji}>
        <ToolbarButton
          onClick={() => popovers.toggle('emoji')}
          title={labels.emoji}
          haspopup="menu"
          expanded={popovers.isOpen('emoji')}
          className={ICON_BUTTON_CLASS}
        >
          <Smile size={14} />
        </ToolbarButton>
        {popovers.isOpen('emoji') && (
          <div className={`absolute ${emojiAlign} mt-1 z-30 shadow-xl rounded-xl overflow-hidden border border-border dark:border-slate-700 max-w-[calc(100vw-2rem)]`}>
            <React.Suspense
              fallback={
                <div className="w-[352px] h-[435px] flex items-center justify-center bg-white dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400">
                  {labels.emojiLoading}
                </div>
              }
            >
              <EmojiPicker
                locale={labels.emojiLocale}
                onSelect={(emoji) => { editor?.chain().focus().insertContent(emoji.native).run(); popovers.close('emoji'); }}
              />
            </React.Suspense>
          </div>
        )}
      </div>

      <TableInsertMenu labels={labels} commands={commands} popovers={popovers} />
    </div>
  );
}
