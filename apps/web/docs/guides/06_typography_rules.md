# 타이포그래피 규칙 (Typography Rules)

## 1. 디자인 토큰 스케일 (Type Scale)

모든 글자 크기는 아래 **7단계 토큰 스케일**을 따릅니다. 임의의 `text-[Npx]` 사용을 금지하고 반드시 정의된 토큰을 사용합니다. `text-xs`가 가장 작은 글자 크기입니다.

| 토큰 클래스 | 실제 크기 | 의미적 용도 | 사용 예 |
|:--|:--|:--|:--|
| `text-xs` | 12px | 최소 크기 레이블 | 상태 뱃지, 테이블 내 인라인 카운트, 아주 작은 부가 정보, 테이블 셀 값, 일반 텍스트, 라벨, 뮤트 텍스트, 입력필드 값 |
| `text-sm` | 14px | 본문 - 강조 | 섹션 헤더, 버튼 라벨, 탐색 항목, 입력필드 라벨 |
| `text-base` | 16px | 카드/패널 타이틀 | 카드 제목, 패널 제목, 폼 섹션 제목 |
| `text-lg` | 18px | 다이얼로그 타이틀 | 모달/다이얼로그 제목, 섹션 페이지 제목 |
| `text-xl` | 20px | 페이지 타이틀 | 페이지 최상위 헤딩 |
| `text-2xl` | 24px | 히어로/랜딩 | 대시보드 환영 메시지, 빈 상태 페이지 타이틀 |
| `text-3xl` | 30px | 최상위 히어로 | 에러 페이지, 브랜드 페이지 |

> `text-xs`는 Tailwind v4 기본값인 **12px**입니다.

---

## 2. 구성요소별 적용 규칙

### 2.1 테이블 (Table)

| 요소 | 토큰 | 굵기 | 색상 | 비고 |
|:--|:--|:--|:--|:--|
| 헤더 행 (`<th>`) | `text-xs` | `font-bold` | `text-[var(--text-muted)]` | 대문자 불필요 |
| 셀 값 (`<td>`) | `text-xs` | `font-medium` | `text-[var(--text-secondary)]` | — |
| 뮤트 값 (날짜/ID) | `text-xs` | `font-normal` | `text-[var(--text-muted)]` | 모노스페이스 권장 |
| 상태 뱃지 | `text-xs` | `font-bold` | (시맨틱 색상) | 상단/하단 패딩 0.5 |
| 페이지네이션 | `text-xs` | `font-bold` | `text-[var(--text-muted)]` | — |

**예시:**
```tsx
<thead>
  <tr className="text-xs font-bold text-[var(--text-muted)]">
    <th>이름</th>
    <th>아이디</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td className="text-xs font-medium text-[var(--text-secondary)]">홍길동</td>
    <td className="text-xs text-[var(--text-muted)]">hong</td>
  </tr>
</tbody>
```

### 2.2 버튼 (Button)

| 크기 변형 | 토큰 | 굵기 | 비고 |
|:--|:--|:--|:--|
| `size="sm"` | `text-xs` | `font-bold` | 아이콘 + 라벨 |
| `size="md"` (기본) | `text-sm` | `font-bold` | 기본 버튼 |
| `size="lg"` | `text-sm` | `font-bold` | 넓은 패딩 |

### 2.3 뱃지 (Badge)

| 용도 | 토큰 | 굵기 | 비고 |
|:--|:--|:--|:--|
| 테이블 내 인라인 뱃지 | `text-xs` | `font-bold` | `px-1.5 py-0.5 rounded-full` |
| 필터/탭 뱃지 | `text-xs` | `font-bold` | 카운트 표시 |
| 카드/패널 뱃지 | `text-xs` | `font-semibold` | 일반 상태 표시 |

### 2.4 폼 (Form)

| 요소 | 토큰 | 굵기 | 비고 |
|:--|:--|:--|:--|
| 필드 라벨 | `text-sm` | `font-bold` | `text-[var(--text-primary)]` |
| 입력값 | `text-sm` | `font-normal` | `text-[var(--text-primary)]` |
| 플레이스홀더 | `text-sm` | `font-normal` | `text-[var(--text-muted)]` |
| 도움말/에러 | `text-xs` | `font-medium` | `text-[var(--danger)]` |

### 2.5 헤더 & 타이틀

| 요소 | 토큰 | 굵기 | 비고 |
|:--|:--|:--|:--|
| 페이지 타이틀 (`<h1>`) | `text-xl` | `font-extrabold` | 페이지 최상단 |
| 섹션 타이틀 (`<h2>`) | `text-lg` | `font-bold` | 카드/패널 내 섹션 |
| 카드 타이틀 | `text-sm` | `font-bold` | 카드 헤더 |
| 대화상자 타이틀 | `text-base` | `font-bold` | 모달 다이얼로그 |

### 2.6 네비게이션 & 사이드바

| 요소 | 토큰 | 굵기 | 비고 |
|:--|:--|:--|:--|
| 사이드바 링크 | `text-sm` | `font-medium` | `text-[var(--sidebar-link-color)]` |
| 사이드바 섹션 라벨 | `text-xs` | `font-bold` | 대문자, `tracking-wider` |
| 사용자 이름 | `text-sm` | `font-medium` | `text-[var(--sidebar-user-name-color)]` |
| 사용자 역할 | `text-xs` | `font-normal` | `text-[var(--sidebar-user-role-color)]` |

### 2.7 쪽지 (Memo)

| 요소 | 토큰 | 굵기 | 비고 |
|:--|:--|:--|:--|
| 메모 목록 제목 | `text-xs` | `font-semibold` | 읽지 않음 |
| 메모 목록 제목 (읽음) | `text-xs` | `font-normal` | 읽음 |
| 발신자/수신자명 | `text-xs` | `font-medium` | `text-[var(--text-secondary)]` |
| 날짜/시간 | `text-xs` | `font-normal` | `text-[var(--text-muted)]` |
| 상태 뱃지 (예약중/발송완료) | `text-xs` | `font-bold` | `inline-flex items-center gap-1` |

### 2.8 채팅 (Chat)

| 요소 | 토큰 | 굵기 | 비고 |
|:--|:--|:--|:--|
| 메시지 발신자명 | `text-xs` | `font-bold` | `text-[var(--text-primary)]` |
| 메시지 본문 | `text-sm` | `font-normal` | `text-[var(--text-primary)]` |
| 메시지 타임스탬프 | `text-xs` | `font-normal` | `text-[var(--text-muted)]` |
| 채널명 | `text-sm` | `font-semibold` | `text-[var(--text-primary)]` |
| 안 읽음 카운트 | `text-xs` | `font-bold` | `bg-[var(--primary)] text-white rounded-full` |

### 2.9 게시판 (Board)

| 요소 | 토큰 | 굵기 | 비고 |
|:--|:--|:--|:--|
| 게시글 제목 | `text-xs` | `font-semibold` | 목록 내 |
| 작성자 | `text-xs` | `font-medium` | `text-[var(--text-secondary)]` |
| 조회수/날짜 | `text-xs` | `font-normal` | `text-[var(--text-muted)]` |
| 게시글 본문 | `text-sm` | `font-normal` | 상세 보기 |

---

## 3. 주의사항

1. **금지**: `text-[10px]`, `text-[11px]`, `text-[8px]` 등 임의의 픽셀값 지정. 반드시 정의된 토큰 사용.
2. **`font-bold` vs `font-semibold`**: 테이블 헤더, 버튼, 뱃지 → `font-bold`. 일반 본문 강조 → `font-semibold` 또는 `font-medium`.
3. **색상과의 조합**: 같은 토큰이라도 용도에 따라 색상이 달라집니다 (primary/secondary/muted).
4. **일관성 우선**: 새로운 컴포넌트를 작성할 때는 위 표에서 가장 유사한 구성요소의 규칙을 따라 적용하세요.

---

## 4. 마이그레이션 히스토리

| 일자 | 변경 내용 |
|:--|:--|
| 2026-07-07 | `text-micro`, `text-tiny` 제거 및 `text-xs`로 통합 |
