import { useState, useRef, useEffect } from 'react';
import { Smile } from 'lucide-react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
  t: (key: string) => string;
}

export function EmojiPicker({ onEmojiSelect, disabled, t }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mb-0.5 cursor-pointer border-none bg-transparent ${
          disabled ? 'opacity-40 pointer-events-none' : ''
        } ${isOpen ? 'bg-slate-200 dark:bg-slate-700 text-indigo-500' : ''}`}
        title={t('chatEmoji') || 'Emoji'}
      >
        <Smile size={15} />
      </button>
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-0 mb-2 z-[150]"
        >
          <Picker
            data={data}
            onEmojiSelect={(emoji: { native: string }) => {
              onEmojiSelect(emoji.native);
              setIsOpen(false);
            }}
            theme="auto"
            previewPosition="none"
            skinTonePosition="none"
            set="native"
            maxFrequentRows={2}
            perLine={7}
          />
        </div>
      )}
    </div>
  );
}
