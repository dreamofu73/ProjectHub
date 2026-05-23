# Desktop 개발 표준 가드레일 (apps/desktop/CLAUDE.md)

이 문서는 **React Vite (TypeScript) 프런트엔드** 소스 코드의 품질, 컴파일 안정성 및 백엔드와의 매끄러운 통합 배포를 유지하기 위한 가이드라인입니다.

분야별 구체적인 개발 가이드는 아래 링크를 참조하십시오:

- [01. 아키텍처 및 라우팅 규칙](../web/docs/guides/01_architecture_and_routing.md)
- [02. UI 개발 워크플로우 및 스타일 규칙](../web/docs/guides/02_ui_development_workflow.md)
- [03. 다국어(i18n) 지원 규칙](../web/docs/guides/03_i18n_rules.md)
- [04. 화면 패턴 규칙](../web/docs/guides/04_screen_patterns.md)
- [05. 컴파일, 빌드 및 테스트 규칙](../web/docs/guides/05_build_and_test.md)
- [06. 타이포그래피 규칙](../web/docs/guides/06_typography_rules.md)

---

> [!IMPORTANT]
> 모든 개발자는 위 가이드라인을 준수해야 하며, 특히 **모달 다이얼로그 사용 금지**, **`./scripts/desktop/dev.sh` 실행** 등의 제한 사항을 반드시 숙지하십시오.

---

## Sonyflake ID 처리 규칙 ⚠️

프로젝트는 분산 환경 대응을 위해 63비트 정수형 기반의 Sonyflake ID를 사용합니다. JavaScript Number 정밀도(`Number.MAX_SAFE_INTEGER` = 2^53 - 1)를 초과할 수 있으므로, **백엔드와의 ID 교환은 반드시 문자열(string) 형식**으로 이루어져야 합니다.

### 1. 타입 정의
모든 ID 필드는 `number`가 아닌 `string` 타입으로 정의합니다.

```typescript
// ✅ 올바른 타입 정의
interface Issue {
  id: string;
  project_id: string;
  author_id: string;
}

// ❌ 잘못된 타입 정의
interface Issue {
  id: number;
}
```

### 2. URL 경로에서 ID 사용
API 호출 시 ID를 `Number()`로 변환하지 않고 문자열 그대로 사용합니다.

```typescript
// ✅ 올바른 사용법
await api.delete(`/api/issues/${issueId}`);

// ❌ 잘못된 사용법
await api.delete(`/api/issues/${Number(issueId)}`);
```

### 3. ID 비교
조건문에서 ID를 비교할 때도 숫자 변환 없이 문자열 그대로 비교합니다.

```typescript
// ✅ 올바른 비교
if (item.id === selectedId) { ... }

// ❌ 잘못된 비교
if (Number(item.id) === Number(selectedId)) { ... }
```
