/**
 * 제거 대상 문자: 공백류 + 제어문자(Cc) + 포맷문자(Cf, BOM/제로폭 포함) + 구분자(Zs/Zl/Zp).
 * "java\nscript:" 처럼 공백·제어문자를 끼워 넣은 난독화를 차단하기 위해 검사 전에 모두 제거한다.
 */
const BLANK_CHARS = /[\s\p{Cc}\p{Cf}\p{Zs}\p{Zl}\p{Zp}]+/gu;
const DANGEROUS_SCHEME = /^(javascript|vbscript|data|file|blob):/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ALLOWED_SCHEME = /^(https?:|mailto:|tel:)/i;

/** 링크/이미지 URL 스킴 검증 — http/https/mailto/tel/상대경로만 허용, javascript: 등 거부 */
export function isAllowedUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const normalized = trimmed.replace(BLANK_CHARS, '');
  if (DANGEROUS_SCHEME.test(normalized)) return false;
  // 스킴이 없으면 상대경로로 간주 — 허용
  if (!HAS_SCHEME.test(normalized)) return true;
  return ALLOWED_SCHEME.test(normalized);
}
