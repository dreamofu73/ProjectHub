import React from 'react';

interface EmojiPickerProps {
  onSelect: (emoji: { native: string }) => void;
  locale: string;
}

/**
 * 이모지 피커는 지연 로딩한다. 에디터를 렌더링하는 모든 화면의 초기 번들에
 * 피커 + 이모지 데이터가 포함되지 않도록, 처음 열 때 가져온다.
 */
export const EmojiPicker = React.lazy(async () => {
  const [Picker, data] = await Promise.all([
    import('@emoji-mart/react').then((m) => m.default),
    import('@emoji-mart/data').then((m) => m.default),
  ]);
  return {
    default: ({ onSelect, locale }: EmojiPickerProps) => (
      <Picker data={data} onEmojiSelect={onSelect} theme="light" locale={locale} />
    ),
  };
});
