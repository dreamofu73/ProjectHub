# 03. 다국어(i18n) 지원 규칙 ⭐

모든 사용자에게 보여지는 문자열(UI 텍스트)은 **반드시 다국어 처리**되어야 합니다. 현재 한국어(`ko`), 영어(`en`), 일본어(`ja`), 중국어(`zh`) 4개 언어를 지원합니다.

## 1. 번역 시스템 구조

다국어 시스템은 **커스텀 React Context**로 구현되어 있으며, 외부 라이브러리를 사용하지 않습니다.

- **Context 파일**: `src/context/LanguageContext.tsx`
- **번역 데이터**: `src/locales/{ko,en,ja,zh}.ts` — TypeScript 객체(`Record<string, string>`)
- **제공 값** (`useLanguage()` 훅):
  - `t(key: string): string` — 번역 키 → 문자열 조회
  - `formatDate(date, options?)` — 날짜 포맷팅 (언어별 로케일 반영)
  - `formatDateTime(date, options?)` — 날짜+시간 포맷팅
  - `formatTime(date, options?)` — 시간 포맷팅
  - `language: Language` — 현재 언어 (`'ko' | 'en' | 'ja' | 'zh'`)
  - `timezone: string` — 언어별 기본 타임존

## 2. `t()` 함수 사용 규칙

**`useLanguage()` 훅 사용 (페이지 및 최상위 컴포넌트)**:
```tsx
import { useLanguage } from '../../context/LanguageContext';

function MyPage() {
  const { t, formatDate } = useLanguage();
  return <div>{t('hello')}</div>;
}
```

**Props 전달 (재사용 컴포넌트)**:
- 자식 컴포넌트가 `t()`나 `formatDate`가 필요한 경우, 부모에서 `useLanguage()`로 가져온 값을 **props로 전달**합니다.
- 이 방식은 컴포넌트의 단위 테스트를 쉽게 하고, Context 의존성을 명시적으로 만듭니다.
```tsx
// 부모 페이지
function ParentPage() {
  const { t, formatDate } = useLanguage();
  return <ChildComponent t={t} formatDate={formatDate} />;
}

// 자식 컴포넌트
interface ChildProps { t: (key: string) => string; formatDate: (date: string) => string; }
function ChildComponent({ t, formatDate }: ChildProps) {
  return <span>{t('hello')} — {formatDate(date)}</span>;
}
```

**⚠️ 절대 직접 DOM 문자열을 하드코딩하지 마십시오**:
```tsx
// ❌ 잘못된 예
<button>수정</button>
<span>2026-07-02</span>

// ✅ 올바른 예
<button>{t('edit') || '수정'}</button>
<span>{formatDate(date)}</span>
```

## 3. 폴백(fallback) 패턴

`t()` 함수는 해당 키를 찾지 못하면 한국어(`ko`) 사전에서 찾고, 그래도 없으면 키 이름을 그대로 반환합니다.

추가 방어 패턴 (권장):
```tsx
// t('key')를 찾지 못할 경우를 대비한 폴백 문자열 제공
{t('edit') || '수정'}
```

이 패턴은:
- 번역 키가 아직 추가되지 않은 신규 기능에서도 기본 텍스트가 보이도록 보장합니다.
- 개발 중에도 UI가 깨지지 않고 표시됩니다.

## 4. 번역 키 추가 규칙

새로운 UI 텍스트를 추가할 때는 **반드시 다음 4개 파일 모두에 동일한 키를 추가**해야 합니다:

1. `src/locales/ko.ts` — 한국어
2. `src/locales/en.ts` — 영어
3. `src/locales/ja.ts` — 일본어
4. `src/locales/zh.ts` — 중국어

**키 네이밍 규칙**:
- **camelCase** 사용 (예: `loginTitle`, `noUsersFound`)
- 기능/페이지별 접두사 사용:
  - `login*` — 로그인 관련
  - `chat*` — 채팅 관련
  - `memo*` — 쪽지 관련
  - `issue*` / `bug*` — 이슈 관련
  - `wiki*` — 위키 관련
  - `group*` — 그룹 관련
  - `user*` / `bulk*` — 사용자 관리 관련
  - `pagination*` — 페이지네이션 관련
  - 공통 액션(`edit`, `delete`, `save`, `cancel`, `search`)은 접두사 없이 짧게
- 의미 단위로 그룹화하여 배치 (주석으로 구분)

**파라미터가 있는 번역**:
```ts
// locales/<lang>.ts
totalIssues: '총 {count}개의 이슈',
selectedIssuesCount: '{count}개 선택됨',

// 컴포넌트에서 사용
t('totalIssues').replace('{count}', items.length.toString())
```

## 5. 날짜/시간 포맷팅 규칙

- 날짜 표시에는 `formatDate()`를 사용하십시오.
- 날짜+시간 표시에는 `formatDateTime()`을 사용하십시오.
- 이 함수들은 언어별 로케일(ko-KR, en-US, ja-JP, zh-CN)과 타임존을 자동 반영합니다.
- API에서 받은 UTC 날짜 문자열은 `parseUTCDate()`를 통해 자동 변환됩니다.
