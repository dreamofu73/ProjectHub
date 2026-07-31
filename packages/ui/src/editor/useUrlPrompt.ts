import { useCallback, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { isAllowedUrl } from './url';
import type { HTMLEditorLabels } from './labels';

interface UrlPromptState {
  mode: 'link' | 'image';
  value: string;
}

/**
 * 네이티브 window.prompt를 대체하는 링크/이미지 URL 입력 다이얼로그 상태.
 * 확정 시 스킴을 검증한 뒤 에디터에 링크/이미지를 삽입한다.
 */
export function useUrlPrompt(editor: Editor | null, labels: HTMLEditorLabels) {
  const [prompt, setPrompt] = useState<UrlPromptState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openLink = useCallback((initialHref?: string) => {
    if (!editor) return;
    setError(null);
    setPrompt({ mode: 'link', value: initialHref ?? ((editor.getAttributes('link').href as string) || 'https://') });
  }, [editor]);

  const openImage = useCallback(() => {
    if (!editor) return;
    setError(null);
    setPrompt({ mode: 'image', value: 'https://' });
  }, [editor]);

  const cancel = useCallback(() => {
    setPrompt(null);
    setError(null);
  }, []);

  const change = useCallback((value: string) => {
    setPrompt(prev => (prev ? { ...prev, value } : prev));
    setError(null);
  }, []);

  const submit = useCallback(() => {
    if (!editor || !prompt) return;
    const url = prompt.value.trim();
    if (!url || url === 'https://') {
      cancel();
      return;
    }
    if (!isAllowedUrl(url)) {
      setError(labels.invalidUrl);
      return;
    }
    if (prompt.mode === 'link') {
      editor.chain().focus().setLink({ href: url }).run();
    } else {
      editor.chain().focus().setImage({ src: url }).run();
    }
    cancel();
  }, [editor, prompt, labels, cancel]);

  return { prompt, error, openLink, openImage, change, cancel, submit };
}
