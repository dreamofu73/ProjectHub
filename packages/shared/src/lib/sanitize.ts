import DOMPurify from 'dompurify';

/**
 * HTML 문자열을 DOMPurify 기본 프로필로 정화합니다. (XSS 방지)
 * - script/style 요소, 인라인 이벤트 핸들러(on*), javascript: URL 등을 제거합니다.
 * - 에디터(HTMLEditor)와 저장된 콘텐츠를 렌더하는 뷰(dangerouslySetInnerHTML) 양쪽에서 사용합니다.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
  });
}
