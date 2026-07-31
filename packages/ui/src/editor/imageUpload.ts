import type { EditorView } from '@tiptap/pm/view';

type UploadImage = (file: File) => Promise<string>;

const isImageFile = (file: File | undefined): file is File => !!file && file.type.startsWith('image/');

/**
 * 드래그 앤 드롭 / 붙여넣기로 들어온 이미지 파일을 업로드한 뒤 문서에 삽입한다.
 * onUploadImage가 없으면 기본 동작(false)을 반환해 Tiptap 처리에 맡긴다.
 */
export function createImageHandlers(onUploadImage?: UploadImage) {
  const insert = (view: EditorView, url: string, dropPos?: number) => {
    const node = view.state.schema.nodes.image.create({ src: url });
    const transaction = dropPos === undefined
      ? view.state.tr.replaceSelectionWith(node)
      : view.state.tr.insert(dropPos, node);
    view.dispatch(transaction);
  };

  return {
    handleDrop: (view: EditorView, event: DragEvent, _slice: unknown, moved: boolean) => {
      if (!onUploadImage || moved || !event.dataTransfer?.files) return false;
      const file = event.dataTransfer.files[0];
      if (!isImageFile(file)) return false;
      event.preventDefault();
      const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
      onUploadImage(file)
        .then(url => insert(view, url, coordinates?.pos || 0))
        .catch(console.error);
      return true;
    },

    handlePaste: (view: EditorView, event: ClipboardEvent) => {
      if (!onUploadImage || !event.clipboardData?.files) return false;
      const file = event.clipboardData.files[0];
      if (!isImageFile(file)) return false;
      event.preventDefault();
      onUploadImage(file)
        .then(url => insert(view, url))
        .catch(console.error);
      return true;
    },
  };
}
