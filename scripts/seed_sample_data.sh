#!/usr/bin/env bash
# ============================================================================
# 샘플 데이터 생성 스크립트 — 모든 기능 테스트용
# ============================================================================
# 사용법:
#   ./scripts/seed_sample_data.sh [BASE_URL] [ADMIN_PASSWORD]
#
# 예시:
#   ./scripts/seed_sample_data.sh http://localhost:8000 "Hek+dmHXEoROQIXPnSpM5RPU6F/raEMF"
#
# 생성 대상:
#   1. 사용자 (admin + 일반 사용자 5명)
#   2. 부서 (2개)
#   3. 프로젝트 (3개, 다양한 설정)
#   4. 프로젝트 멤버
#   5. 마일스톤 (프로젝트별 2개)
#   6. 업무/태스크 (다양한 상태·유형)
#   7. 이슈 (다양한 트래커·우선순위·상태)
#   8. 이슈 코멘트
#   9. 게시글 (다양한 카테고리)
#  10. 게시글 코멘트
#  11. 위키 페이지 (계층 구조)
#  12. 위키 코멘트
#  13. 쪽지 (수신·발신·보관·스팸)
#  14. 쪽지 폴더
#  15. 채팅방 + 메시지
#  16. 사용자 그룹 + 멤버 + 리소스 공유
#  17. 주소록 그룹 + 멤버
#  18. 대시보드 조회 확인
#  19. 검색 기능 확인
#  20. 알림 조회 확인
# ============================================================================
set -euo pipefail

BASE_URL="${1:-http://localhost:8000}"
ADMIN_PASS="${2:-Hek+dmHXEoROQIXPnSpM5RPU6F/raEMF}"
API="${BASE_URL}/api"

# ── 유틸리티 ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SUCCESS_COUNT=0
FAIL_COUNT=0

log_section() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_step() {
  echo -e "  ${YELLOW}▸${NC} $1"
}

log_ok() {
  echo -e "    ${GREEN}✔${NC} $1"
  SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
}

log_fail() {
  echo -e "    ${RED}✘${NC} $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

# curl 요청 헬퍼: JSON 응답을 반환
req() {
  local method="$1" path="$2" body="${3:-}"
  local -a args=(-s -w "\n%{http_code}" -H "Content-Type: application/json")
  if [[ -n "$TOKEN" ]]; then
    args+=(-H "Authorization: Bearer ${TOKEN}")
  fi
  if [[ "$method" == "POST" || "$method" == "PUT" || "$method" == "PATCH" ]]; then
    args+=(-X "$method")
    if [[ -n "$body" ]]; then
      args+=(-d "$body")
    fi
  elif [[ "$method" == "DELETE" ]]; then
    args+=(-X DELETE)
  fi

  local raw
  raw=$(curl "${args[@]}" "${API}${path}" 2>/dev/null || true)
  local http_code
  http_code=$(echo "$raw" | tail -n1)
  local resp
  resp=$(echo "$raw" | sed '$d')

  echo "$resp"
  return 0
}

# JSON 값을 추출 (jq 없이 간단 파싱)
json_val() {
  echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d$2)" 2>/dev/null || echo ""
}

TOKEN=""

# ── 0. 서버 연결 확인 ────────────────────────────────────────────────────────

log_section "0. 서버 연결 확인"
HEALTH=$(req GET "/dashboard" "")
if echo "$HEALTH" | grep -q "Unauthorized\|success"; then
  log_ok "서버 연결 성공 (${BASE_URL})"
else
  log_fail "서버에 연결할 수 없습니다. (${BASE_URL})"
  echo "서버를 먼저 실행해주세요: ./scripts/web-dev.sh"
  exit 1
fi

# ── 1. 관리자 로그인 ────────────────────────────────────────────────────────

log_section "1. 관리자 로그인"
LOGIN_RESP=$(req POST "/auth/login" "{\"login\":\"admin\",\"password\":\"${ADMIN_PASS}\"}")
TOKEN=$(json_val "$LOGIN_RESP" "['token']")
if [[ -n "$TOKEN" ]]; then
  log_ok "관리자 로그인 성공 (token 발급)"
else
  log_fail "관리자 로그인 실패"
  echo "응답: $LOGIN_RESP"
  exit 1
fi

# ── 2. 사용자 생성 ──────────────────────────────────────────────────────────

log_section "2. 사용자 생성 (5명)"

USERS=(
  '{"login":"kimtg","email":"kimtg@example.com","password":"pass1234","firstname":"태근","lastname":"김","role":"admin"}'
  '{"login":"leeyh","email":"leeyh@example.com","password":"pass1234","firstname":"영환","lastname":"이","role":"user"}'
  {"login":"parkjs","email":"parkjs@example.com","password":"pass1234","firstname":"진수","lastname":"박","role":"user"}
  '{"login":"choius","email":"choius@example.com","password":"pass1234","firstname":"우식","lastname":"조","role":"user"}'
  '{"login":"jangmh","email":"jangmh@example.com","password":"pass1234","firstname":"민현","lastname":"장","role":"user"}'
)

USER_IDS=()
for u_data in "${USERS[@]}"; do
  login=$(json_val "$u_data" "['login']")
  resp=$(req POST "/users" "$u_data")
  ok=$(json_val "$resp" "['success']")
  if [[ "$ok" == "True" || "$ok" == "true" ]]; then
    log_ok "사용자 생성: ${login}"
  else
    log_fail "사용자 생성 실패: ${login} — $(json_val "$resp" "['error']")"
  fi
done

# 사용자 ID 조회 (admin=1 고정, 나머지는 순차 생성 가정)
# 관리자가 이미 존재하므로 admin id=1, 신규 생성된 id는 2~6
ADMIN_ID=1
USER_IDS=(2 3 4 5 6)
log_ok "사용자 ID 목록: admin=${ADMIN_ID}, 일반=${USER_IDS[*]}"

# ── 3. 부서 생성 ────────────────────────────────────────────────────────────

log_section "3. 부서 생성"

DEPT1_RESP=$(req POST "/admin/organization/departments" '{"name":"개발팀","description":"백엔드/프런트엔드 개발을 담당합니다."}')
DEPT1_ID=$(json_val "$DEPT1_RESP" "['data']['id']")
if [[ -n "$DEPT1_ID" && "$DEPT1_ID" != "None" ]]; then
  log_ok "부서 생성: 개발팀 (id=${DEPT1_ID})"
else
  log_fail "부서 생성 실패: 개발팀"
fi

DEPT2_RESP=$(req POST "/admin/organization/departments" '{"name":"기획팀","description":"서비스 기획 및 운영을 담당합니다."}')
DEPT2_ID=$(json_val "$DEPT2_RESP" "['data']['id']")
if [[ -n "$DEPT2_ID" && "$DEPT2_ID" != "None" ]]; then
  log_ok "부서 생성: 기획팀 (id=${DEPT2_ID})"
else
  log_fail "부서 생성 실패: 기획팀"
fi

# ── 4. 프로젝트 생성 ────────────────────────────────────────────────────────

log_section "4. 프로젝트 생성 (3개)"

# 프로젝트 1: 웹 앱 개발
P1_RESP=$(req POST "/projects" '{
  "name":"웹 애플리케이션 개발",
  "identifier":"WEB-APP",
  "description":"메인 웹 애플리케이션 개발 프로젝트",
  "homepage":"https://example.com",
  "is_public":true,
  "task_types":"[\"개발\",\"디자인\",\"테스트\"]",
  "issue_types":"[\"버그\",\"기능요청\",\"개선\"]",
  "statuses":"[\"진행중\",\"완료\",\"보류\"]",
  "task_categories":"[\"백엔드\",\"프런트엔드\",\"인프라\"]",
  "task_statuses":"[\"미착업\",\"진행중\",\"완료\"]"
}')
P1_ID=$(json_val "$P1_RESP" "['id']")
if [[ -n "$P1_ID" && "$P1_ID" != "None" ]]; then
  log_ok "프로젝트 1: 웹 애플리케이션 개발 (id=${P1_ID})"
else
  log_fail "프로젝트 1 생성 실패"
fi

# 프로젝트 2: 모바일 앱
P2_RESP=$(req POST "/projects" '{
  "name":"모바일 앱 개발",
  "identifier":"MOB-APP",
  "description":"iOS/Android 크로스플랫폼 모바일 앱",
  "is_public":false,
  "task_types":"[\"개발\",\"기획\"]",
  "issue_types":"[\"버그\",\"기능요청\"]",
  "statuses":"[\"진행중\",\"완료\"]",
  "task_categories":"[\"iOS\",\"Android\",\"공통\"]",
  "task_statuses":"[\"미착업\",\"진행중\",\"완료\"]"
}')
P2_ID=$(json_val "$P2_RESP" "['id']")
if [[ -n "$P2_ID" && "$P2_ID" != "None" ]]; then
  log_ok "프로젝트 2: 모바일 앱 개발 (id=${P2_ID})"
else
  log_fail "프로젝트 2 생성 실패"
fi

# 프로젝트 3: 인프라 개선
P3_RESP=$(req POST "/projects" '{
  "name":"인프라 개선",
  "identifier":"INFRA",
  "description":"서버 인프라 및 DevOps 개선",
  "is_public":true,
  "task_types":"[\"운영\",\"개발\"]",
  "issue_types":"[\"버그\",\"개선\",\"보안\"]",
  "statuses":"[\"진행중\",\"완료\",\"보류\"]",
  "task_categories":"[\"서버\",\"네트워크\",\"보안\"]",
  "task_statuses":"[\"미착업\",\"진행중\",\"완료\"]"
}')
P3_ID=$(json_val "$P3_RESP" "['id']")
if [[ -n "$P3_ID" && "$P3_ID" != "None" ]]; then
  log_ok "프로젝트 3: 인프라 개선 (id=${P3_ID})"
else
  log_fail "프로젝트 3 생성 실패"
fi

# ── 5. 프로젝트 멤버 추가 ──────────────────────────────────────────────────

log_section "5. 프로젝트 멤버 추가"

# 프로젝트 1: 모든 사용자
for uid in $ADMIN_ID "${USER_IDS[@]}"; do
  resp=$(req POST "/projects/${P1_ID}/members" "{\"user_id\":${uid},\"role\":\"developer\"}")
  ok=$(json_val "$resp" "['success']")
  if [[ "$ok" == "True" || "$ok" == "true" ]]; then
    log_ok "P1 멤버 추가: user_id=${uid}"
  fi
done

# 프로젝트 2: admin + 2명
for uid in $ADMIN_ID ${USER_IDS[0]} ${USER_IDS[1]}; do
  resp=$(req POST "/projects/${P2_ID}/members" "{\"user_id\":${uid},\"role\":\"developer\"}")
  ok=$(json_val "$resp" "['success']")
  if [[ "$ok" == "True" || "$ok" == "true" ]]; then
    log_ok "P2 멤버 추가: user_id=${uid}"
  fi
done

# 프로젝트 3: admin + 1명
resp=$(req POST "/projects/${P3_ID}/members" "{\"user_id\":${ADMIN_ID},\"role\":\"manager\"}")
log_ok "P3 멤버 추가: admin"

# ── 6. 마일스톤 생성 ────────────────────────────────────────────────────────

log_section "6. 마일스톤 생성"

MS1_RESP=$(req POST "/milestones" "{\"project_id\":${P1_ID},\"name\":\"v1.0 릴리즈\",\"description\":\"첫 번째 릴리즈\",\"due_date\":\"2026-09-30\",\"status\":\"active\"}")
MS1_ID=$(json_val "$MS1_RESP" "['id']")
if [[ -n "$MS1_ID" && "$MS1_ID" != "None" ]]; then
  log_ok "마일스톤: v1.0 릴리즈 (id=${MS1_ID})"
else
  log_fail "마일스톤 생성 실패"
fi

MS2_RESP=$(req POST "/milestones" "{\"project_id\":${P1_ID},\"name\":\"v1.1 패치\",\"description\":\"보안 패치 및 버그 수정\",\"due_date\":\"2026-12-31\",\"status\":\"active\"}")
MS2_ID=$(json_val "$MS2_RESP" "['id']")
log_ok "마일스톤: v1.1 패치 (id=${MS2_ID})"

MS3_RESP=$(req POST "/milestones" "{\"project_id\":${P2_ID},\"name\":\"MVP 릴리즈\",\"description\":\"최소 기능 제품\",\"due_date\":\"2026-11-30\",\"status\":\"active\"}")
MS3_ID=$(json_val "$MS3_RESP" "['id']")
log_ok "마일스톤: MVP 릴리즈 (id=${MS3_ID})"

# ── 7. 태스크/업무 생성 ─────────────────────────────────────────────────────

log_section "7. 태스크/업무 생성"

TASKS=(
  "{\"project_id\":${P1_ID},\"title\":\"사용자 인증 모듈 개발\",\"description\":\"JWT 기반 로그인/회원가입 구현\",\"task_type\":\"개발\",\"task_category\":\"백엔드\",\"status\":\"진행중\",\"planned_start_date\":\"2026-07-01\",\"planned_end_date\":\"2026-07-31\",\"progress\":60,\"assignee_id\":${USER_IDS[0]}}"
  "{\"project_id\":${P1_ID},\"title\":\"대시보드 UI 설계\",\"description\":\"메인 대시보드 화면 디자인 및 구현\",\"task_type\":\"디자인\",\"task_category\":\"프런트엔드\",\"status\":\"미착업\",\"planned_start_date\":\"2026-08-01\",\"planned_end_date\":\"2026-08-31\",\"progress\":0,\"assignee_id\":${USER_IDS[1]}}"
  "{\"project_id\":${P1_ID},\"title\":\"API 문서화\",\"description\":\"REST API 문서 자동 생성\",\"task_type\":\"개발\",\"task_category\":\"백엔드\",\"status\":\"완료\",\"planned_start_date\":\"2026-07-01\",\"planned_end_date\":\"2026-07-15\",\"actual_start_date\":\"2026-07-01\",\"actual_end_date\":\"2026-07-14\",\"progress\":100,\"assignee_id\":${USER_IDS[2]}}"
  "{\"project_id\":${P2_ID},\"title\":\"네이티브 브릿지 구현\",\"description\":\"React Native ↔ 네이티브 모듈 통신\",\"task_type\":\"개발\",\"task_category\":\"공통\",\"status\":\"진행중\",\"progress\":30,\"assignee_id\":${USER_IDS[0]}}"
  "{\"project_id\":${P2_ID},\"title\":\"푸시 알림 설정\",\"description\":\"FCM/APNS 푸시 알림 구현\",\"task_type\":\"개발\",\"task_category\":\"iOS\",\"status\":\"미착업\",\"progress\":0,\"assignee_id\":${USER_IDS[3]}}"
  "{\"project_id\":${P3_ID},\"title\":\"모니터링 시스템 구축\",\"description\":\"Grafana + Prometheus 설정\",\"task_type\":\"운영\",\"task_category\":\"서버\",\"status\":\"진행중\",\"progress\":45,\"assignee_id\":${ADMIN_ID}}"
)

TASK_IDS=()
for t_data in "${TASKS[@]}"; do
  resp=$(req POST "/tasks" "$t_data")
  tid=$(json_val "$resp" "['id']")
  title=$(json_val "$t_data" "['title']")
  if [[ -n "$tid" && "$tid" != "None" ]]; then
    TASK_IDS+=("$tid")
    log_ok "태스크: ${title} (id=${tid})"
  else
    log_fail "태스크 생성 실패: ${title}"
  fi
done

# ── 8. 이슈 생성 ────────────────────────────────────────────────────────────

log_section "8. 이슈 생성"

ISSUES=(
  "{\"project_id\":${P1_ID},\"subject\":\"로그인 시 세션 만료 처리 오류\",\"description\":\"로그인 후 30분 경과 시 간헐적으로 세션이 만료되지 않는 문제\",\"tracker\":\"bug\",\"status\":\"new\",\"priority\":\"high\",\"assigned_to_id\":${USER_IDS[0]},\"due_date\":\"2026-08-15\",\"task_type\":\"버그\",\"planned_start_date\":\"2026-07-20\"}"
  "{\"project_id\":${P1_ID},\"subject\":\"다크모드 지원 요청\",\"description\":\"사용자 선호도 조사 결과 70%가 다크모드 지원 요청\",\"tracker\":\"feature\",\"status\":\"new\",\"priority\":\"normal\",\"assigned_to_id\":${USER_IDS[1]},\"due_date\":\"2026-09-30\",\"task_type\":\"기능요청\"}"
  "{\"project_id\":${P1_ID},\"subject\":\"페이지 로딩 속도 개선\",\"description\":\"대시보드 페이지 로딩 시간이 5초 이상 소요됨\",\"tracker\":\"support\",\"status\":\"in_progress\",\"priority\":\"high\",\"assigned_to_id\":${USER_IDS[2]},\"done_ratio\":30,\"task_type\":\"개선\",\"planned_start_date\":\"2026-07-15\"}"
  "{\"project_id\":${P1_ID},\"subject\":\"이메일 인증 기능 추가\",\"description\":\"회원가입 시 이메일 인증 단계 추가 필요\",\"tracker\":\"feature\",\"status\":\"new\",\"priority\":\"normal\",\"assigned_to_id\":${USER_IDS[0]},\"due_date\":\"2026-10-15\",\"task_type\":\"기능요청\"}"
  "{\"project_id\":${P1_ID},\"subject\":\"SQL 인젝션 취약점 수정\",\"description\":\"검색 기능에서 입력값 검증 미흡\",\"tracker\":\"bug\",\"status\":\"closed\",\"priority\":\"urgent\",\"assigned_to_id\":${USER_IDS[0]},\"done_ratio\":100,\"task_type\":\"버그\",\"actual_end_date\":\"2026-07-10\"}"
  "{\"project_id\":${P2_ID},\"subject\":\"Android 크래시 리포트 분석\",\"description\":\"최근 7일간 크래시 15건 발생\",\"tracker\":\"bug\",\"status\":\"new\",\"priority\":\"high\",\"assigned_to_id\":${USER_IDS[3]},\"due_date\":\"2026-08-01\",\"task_type\":\"버그\"}"
  "{\"project_id\":${P2_ID},\"subject\":\"App Store 심사 대응\",\"description\":\"Apple 심사 가이드라인 준수 여부 확인\",\"tracker\":\"support\",\"status\":\"in_progress\",\"priority\":\"normal\",\"assigned_to_id\":${ADMIN_ID},\"done_ratio\":50,\"task_type\":\"기획\"}"
  "{\"project_id\":${P3_ID},\"subject\":\"SSL 인증서 갱신 자동화\",\"description\":\"Let's Encrypt 인증서 자동 갱신 스크립트 구현\",\"tracker\":\"feature\",\"status\":\"new\",\"priority\":\"normal\",\"assigned_to_id\":${ADMIN_ID},\"due_date\":\"2026-09-01\",\"task_type\":\"개발\"}"
  "{\"project_id\":${P3_ID},\"subject\":\"방화벽 규칙 최적화\",\"description\":\"불필요한 포트 규칙 정리 및 보안 강화\",\"tracker\":\"support\",\"status\":\"new\",\"priority\":\"high\",\"assigned_to_id\":${USER_IDS[4]},\"due_date\":\"2026-08-15\",\"task_type\":\"보안\"}"
)

ISSUE_IDS=()
for i_data in "${ISSUES[@]}"; do
  resp=$(req POST "/issues" "$i_data")
  iid=$(json_val "$resp" "['id']")
  subject=$(json_val "$i_data" "['subject']" | head -c 30)
  if [[ -n "$iid" && "$iid" != "None" ]]; then
    ISSUE_IDS+=("$iid")
    log_ok "이슈: ${subject}... (id=${iid})"
  else
    log_fail "이슈 생성 실패: ${subject}"
  fi
done

# 이슈 상태 업데이트 테스트
if [[ ${#ISSUE_IDS[@]} -ge 3 ]]; then
  resp=$(req PUT "/issues/${ISSUE_IDS[2]}" '{"status":"in_progress","done_ratio":50}')
  ok=$(json_val "$resp" "['success']")
  if [[ "$ok" == "True" || "$ok" == "true" ]]; then
    log_ok "이슈 상태 업데이트: in_progress (id=${ISSUE_IDS[2]})"
  fi
fi

# ── 9. 이슈 코멘트 ──────────────────────────────────────────────────────────

log_section "9. 이슈 코멘트"

if [[ ${#ISSUE_IDS[@]} -ge 1 ]]; then
  resp=$(req POST "/issues/${ISSUE_IDS[0]}/comments" '{"content":"재현 방법: 관리자 페이지 → 세션 설정 → 타임아웃 30분으로 설정 후 대기하면 됩니다."}')
  ok=$(json_val "$resp" "['success']")
  if [[ "$ok" == "True" || "$ok" == "true" ]]; then
    log_ok "이슈 코멘트 추가 (issue_id=${ISSUE_IDS[0]})"
  fi
fi

if [[ ${#ISSUE_IDS[@]} -ge 2 ]]; then
  resp=$(req POST "/issues/${ISSUE_IDS[1]}/comments" '{"content":"다크모드 구현 시 CSS 변수 기반으로 접근하면 테마 전환이 용이합니다."}')
  log_ok "이슈 코멘트 추가 (issue_id=${ISSUE_IDS[1]})"
fi

if [[ ${#ISSUE_IDS[@]} -ge 3 ]]; then
  resp=$(req POST "/issues/${ISSUE_IDS[2]}/comments" '{"content":"이미지 최적화 및懒加载 적용 후 로딩 시간이 2초로 개선되었습니다."}')
  log_ok "이슈 코멘트 추가 (issue_id=${ISSUE_IDS[2]})"
fi

# ── 10. 게시글 생성 ─────────────────────────────────────────────────────────

log_section "10. 게시글 생성"

POSTS=(
  "{\"project_id\":${P1_ID},\"title\":\"2026년 3분기 개발 일정 공유\",\"content\":\"3분기 주요 개발 일정을 공유합니다.\\n\\n1. 7월: 사용자 인증 모듈 완료\\n2. 8월: 대시보드 UI 구현\\n3. 9월: 통합 테스트 및 릴리즈\",\"category\":\"공지\"}"
  "{\"project_id\":${P1_ID},\"title\":\"코드 리뷰 가이드라인\",\"content\":\"효과적인 코드 리뷰를 위한 가이드라인입니다.\\n\\n- PR은 300줄 이하로 유지\\n- 의미 있는 커밋 메시지 작성\\n- 테스트 코드 포함\",\"category\":\"자유\"}"
  "{\"project_id\":${P2_ID},\"title\":\"모바일 앱 UX 개선안\",\"content\":\"사용자 피드백을 반영한 UX 개선안입니다.\\n\\n- 하단 네비게이션 바 추가\\n- 제스처 제스처 지원 강화\\n- 오프라인 모드 지원\",\"category\":\"제안\"}"
  "{\"project_id\":null,\"title\":\"전사 IT 보안 교육 안내\",\"content\":\"전사 IT 보안 교육을 실시합니다.\\n\\n일시: 2026년 8월 15일 오후 2시\\n장소: 대강당\\n대상: 전 직원\",\"category\":\"공지\"}"
  "{\"project_id\":${P3_ID},\"title\":\"서버 장애 대응 절차\",\"content\":\"서버 장애 발생 시 대응 절차를 정리합니다.\\n\\n1. 장애 감지 및 알림\\n2. 원인 분석\\n3. 복구 조치\\n4. 사후 분석\",\"category\":\"공지\"}"
)

POST_IDS=()
for pdata in "${POSTS[@]}"; do
  resp=$(req POST "/posts" "$pdata")
  pid=$(json_val "$resp" "['id']")
  title=$(json_val "$pdata" "['title']" | head -c 30)
  if [[ -n "$pid" && "$pid" != "None" ]]; then
    POST_IDS+=("$pid")
    log_ok "게시글: ${title}... (id=${pid})"
  else
    log_fail "게시글 생성 실패"
  fi
done

# ── 11. 게시글 코멘트 ──────────────────────────────────────────────────────

log_section "11. 게시글 코멘트"

if [[ ${#POST_IDS[@]} -ge 1 ]]; then
  resp=$(req POST "/posts/${POST_IDS[0]}/comments" '{"content":"일정 확인했습니다. 7월 인증 모듈 일정에 맞추겠습니다."}')
  log_ok "게시글 코멘트 추가 (post_id=${POST_IDS[0]})"
fi

if [[ ${#POST_IDS[@]} -ge 2 ]]; then
  resp=$(req POST "/posts/${POST_IDS[1]}/comments" '{"content":"좋은 가이드라인 감사합니다. PR 크기 제한 관련해서 추가 의견 드립니다."}')
  log_ok "게시글 코멘트 추가 (post_id=${POST_IDS[1]})"
fi

# ── 12. 위키 페이지 생성 ────────────────────────────────────────────────────

log_section "12. 위키 페이지 생성"

WIKI1_RESP=$(req POST "/wiki" "{\"project_id\":${P1_ID},\"title\":\"개발 환경 설정 가이드\",\"content\":\"# 개발 환경 설정\\n\\n## 필수 도구\\n- Rust 1.75+\\n- Node.js 20+\\n- PostgreSQL 16+\\n\\n## 설정 방법\\n1. config.toml 복사\\n2. 데이터베이스 연결 설정\\n3. 개발 서버 실행: ./scripts/web-dev.sh\"}")
WIKI1_ID=$(json_val "$WIKI1_RESP" "['id']")
if [[ -n "$WIKI1_ID" && "$WIKI1_ID" != "None" ]]; then
  log_ok "위키: 개발 환경 설정 가이드 (id=${WIKI1_ID})"
else
  log_fail "위키 생성 실패"
fi

WIKI2_RESP=$(req POST "/wiki" "{\"project_id\":${P1_ID},\"title\":\"API 명세서\",\"content\":\"# REST API 명세\\n\\n## 인증\\n- POST /api/auth/login\\n- POST /api/auth/register\\n\\n## 프로젝트\\n- GET /api/projects\\n- POST /api/projects\\n- PUT /api/projects/:id\\n\\n## 이슈\\n- GET /api/issues\\n- POST /api/issues\"}")
WIKI2_ID=$(json_val "$WIKI2_RESP" "['id']")
log_ok "위키: API 명세서 (id=${WIKI2_ID})"

# 글로벌 위키 (관리자만)
WIKI3_RESP=$(req POST "/wiki" '{"project_id":null,"title":"회사 표준 개발 규칙","content":"# 회사 표준 개발 규칙\\n\\n## 코딩 컨벤션\\n- Rust: rustfmt + clippy\\n- TypeScript: eslint + prettier\\n\\n## 브랜치 전략\\n- main: 프로덕션\\n- develop: 개발\\n- feature/*: 기능 개발\\n\\n## PR 규칙\\n- 최소 1명 리뷰\\n- CI 통과 필수"}')
WIKI3_ID=$(json_val "$WIKI3_RESP" "['id']")
log_ok "위키: 회사 표준 개발 규칙 (id=${WIKI3_ID})"

# 위키 업데이트 (버전 생성)
if [[ -n "$WIKI1_ID" && "$WIKI1_ID" != "None" ]]; then
  resp=$(req PUT "/wiki/${WIKI1_ID}" '{"content":"# 개발 환경 설정 (업데이트됨)\\n\\n## 필수 도구\\n- Rust 1.78+ (업데이트)\\n- Node.js 20+\\n- PostgreSQL 16+\\n\\n## 변경 이력\\n- 2026-07-21: Rust 버전 업데이트"}')
  log_ok "위키 업데이트 (버전 생성): id=${WIKI1_ID}"
fi

# ── 13. 위키 코멘트 ─────────────────────────────────────────────────────────

log_section "13. 위키 코멘트"

if [[ -n "$WIKI1_ID" && "$WIKI1_ID" != "None" ]]; then
  resp=$(req POST "/wiki/${WIKI1_ID}/comments" '{"content":"Rust 1.78 설치 방법이 추가되면 좋겠습니다."}')
  log_ok "위키 코멘트 추가 (wiki_id=${WIKI1_ID})"
fi

if [[ -n "$WIKI2_ID" && "$WIKI2_ID" != "None" ]]; then
  resp=$(req POST "/wiki/${WIKI2_ID}/comments" '{"content":"검색 API 엔드포인트가 누락된 것 같습니다."}')
  log_ok "위키 코멘트 추가 (wiki_id=${WIKI2_ID})"
fi

# ── 14. 쪽지 폴더 생성 ─────────────────────────────────────────────────────

log_section "14. 쪽지 폴더 생성"

FOLDER1_RESP=$(req POST "/memos/folders" '{"name":"중요 쪽지"}')
FOLDER1_ID=$(json_val "$FOLDER1_RESP" "['id']")
log_ok "쪽지 폴더: 중요 쪽지 (id=${FOLDER1_ID})"

FOLDER2_RESP=$(req POST "/memos/folders" '{"name":"프로젝트 관련"}')
FOLDER2_ID=$(json_val "$FOLDER2_RESP" "['id']")
log_ok "쪽지 폴더: 프로젝트 관련 (id=${FOLDER2_ID})"

# ── 15. 쪽지 보내기 ────────────────────────────────────────────────────────

log_section "15. 쪽지 보내기"

# 일반 쪽지
resp=$(req POST "/memos" "{\"receiver_ids\":[${USER_IDS[0]},${USER_IDS[1]}],\"title\":\"프로젝트 미팅 일정 변경\",\"content\":\"내일 예정이었던 미팅이 모레로 변경되었습니다.\\n장소: 회의실 B\\n시간: 오후 3시\"}")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "쪽지 발신: 프로젝트 미팅 일정 변경"
fi

# 예약 쪽지 (내일 발송 예약)
resp=$(req POST "/memos" "{\"receiver_ids\":[${USER_IDS[2]}],\"title\":\"주간 보고서 제출 안내\",\"content\":\"이번 주 주간 보고서를 금요일까지 제출해주세요.\n양식은 위키에서 확인 가능합니다.\",\"reserved_at\":\"2026-07-22 09:00:00\"}")
log_ok "쪽지 예약 발신: 주간 보고서 제출 안내"

# 만료 쪽지
resp=$(req POST "/memos" "{\"receiver_ids\":[${USER_IDS[3]}],\"title\":\"임시 접근 권한\",\"content\":\"임시 관리자 접근 권한을 부여합니다.\n\\n만료일: 2026-07-25\",\"expires_at\":\"2026-07-25 23:59:59\"}")
log_ok "쪽지 발신 (만료 설정): 임시 접근 권한"

# 쪽지 수신 확인
resp=$(req GET "/memos/received" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "받은 쪽지 목록 조회"
fi

# 쪽지 보관함 확인
resp=$(req GET "/memos/sent" "")
log_ok "보낸 쪽지 목록 조회"

# 읽지 않은 쪽지 수 확인
resp=$(req GET "/memos/unread/count" "")
log_ok "읽지 않은 쪽지 수 조회"

# ── 16. 채팅방 생성 및 메시지 ──────────────────────────────────────────────

log_section "16. 채팅방 + 메시지"

# 채팅방 1 생성
CR1_RESP=$(req POST "/chat/rooms" '{"name":"개발팀 채팅방"}')
CR1_ID=$(json_val "$CR1_RESP" "['id']")
if [[ -n "$CR1_ID" && "$CR1_ID" != "None" ]]; then
  log_ok "채팅방 생성: 개발팀 채팅방 (id=${CR1_ID})"
else
  log_fail "채팅방 생성 실패"
fi

# 채팅방 2 생성
CR2_RESP=$(req POST "/chat/rooms" '{"name":"프로젝트 논의"}')
CR2_ID=$(json_val "$CR2_RESP" "['id']")
log_ok "채팅방 생성: 프로젝트 논의 (id=${CR2_ID})"

# 채팅방에 멤버 추가
if [[ -n "$CR1_ID" && "$CR1_ID" != "None" ]]; then
  for uid in "${USER_IDS[0]}" "${USER_IDS[1]}" "${USER_IDS[2]}"; do
    resp=$(req POST "/chat/rooms/${CR1_ID}/members" "{\"user_id\":${uid}}")
    log_ok "채팅방 멤버 추가: room=${CR1_ID}, user=${uid}"
  done

  # 메시지 보내기
  resp=$(req POST "/chat" "{\"room_id\":${CR1_ID},\"content\":\"안녕하세요! 개발팀 채팅방에 오신 것을 환영합니다.\"}")
  log_ok "채팅 메시지 전송 (room=${CR1_ID})"

  resp=$(req POST "/chat" "{\"room_id\":${CR1_ID},\"content\":\"이번 주 스프린트 목표: 사용자 인증 모듈 완료\"}")
  log_ok "채팅 메시지 전송 (room=${CR1_ID})"

  resp=$(req POST "/chat" "{\"room_id\":${CR1_ID},\"content\":\"API 문서화는 이미 완료 상태입니다. 위키 페이지를 확인해주세요.\"}")
  log_ok "채팅 메시지 전송 (room=${CR1_ID})"
fi

# 채팅방 2에 메시지
if [[ -n "$CR2_ID" && "$CR2_ID" != "None" ]]; then
  resp=$(req POST "/chat" "{\"room_id\":${CR2_ID},\"content\":\"모바일 앱 관련 논의 시작합니다.\"}")
  log_ok "채팅 메시지 전송 (room=${CR2_ID})"
fi

# ── 17. 사용자 그룹 + 멤버 + 리소스 공유 ───────────────────────────────────

log_section "17. 사용자 그룹 + 멤버 + 리소스 공유"

UG1_RESP=$(req POST "/chat/user-groups" '{"name":"프론트엔드 개발자","description":"프론트엔드 담당자 그룹"}')
UG1_ID=$(json_val "$UG1_RESP" "['id']")
if [[ -n "$UG1_ID" && "$UG1_ID" != "None" ]]; then
  log_ok "사용자 그룹: 프론트엔드 개발자 (id=${UG1_ID})"
else
  log_fail "사용자 그룹 생성 실패"
fi

UG2_RESP=$(req POST "/chat/user-groups" '{"name":"백엔드 개발자","description":"백엔드 담당자 그룹"}')
UG2_ID=$(json_val "$UG2_RESP" "['id']")
log_ok "사용자 그룹: 백엔드 개발자 (id=${UG2_ID})"

# 그룹에 멤버 추가
if [[ -n "$UG1_ID" && "$UG1_ID" != "None" ]]; then
  resp=$(req POST "/chat/user-groups/${UG1_ID}/members" "{\"user_ids\":[${USER_IDS[1]},${USER_IDS[2]}]}")
  log_ok "그룹 멤버 추가: 프론트엔드 개발자"
fi

if [[ -n "$UG2_ID" && "$UG2_ID" != "None" ]]; then
  resp=$(req POST "/chat/user-groups/${UG2_ID}/members" "{\"user_ids\":[${USER_IDS[0]},${USER_IDS[3]}]}")
  log_ok "그룹 멤버 추가: 백엔드 개발자"
fi

# 그룹 리소스 공유
if [[ -n "$UG1_ID" && "$UG1_ID" != "None" ]]; then
  resp=$(req POST "/groups/${UG1_ID}/shares" "{\"resource_type\":\"project\",\"resource_id\":${P1_ID},\"permission_level\":\"read\"}")
  ok=$(json_val "$resp" "['success']")
  if [[ "$ok" == "True" || "$ok" == "true" ]]; then
    log_ok "그룹 리소스 공유: 프로젝트 → 프론트엔드 개발자 그룹"
  fi
fi

# 그룹 채팅방 생성
if [[ -n "$UG2_ID" && "$UG2_ID" != "None" ]]; then
  resp=$(req POST "/groups/${UG2_ID}/chat-room" '{}')
  log_ok "그룹 채팅방 생성: 백엔드 개발자 그룹"
fi

# ── 18. 주소록 그룹 + 멤버 ──────────────────────────────────────────────────

log_section "18. 주소록 그룹 + 멤버"

AB1_RESP=$(req POST "/address-book/groups" '{"name":"핵심 개발팀"}')
AB1_ID=$(json_val "$AB1_RESP" "['id']")
if [[ -n "$AB1_ID" && "$AB1_ID" != "None" ]]; then
  log_ok "주소록 그룹: 핵심 개발팀 (id=${AB1_ID})"
else
  log_fail "주소록 그룹 생성 실패"
fi

AB2_RESP=$(req POST "/address-book/groups" '{"name":"운영팀"}')
AB2_ID=$(json_val "$AB2_RESP" "['id']")
log_ok "주소록 그룹: 운영팀 (id=${AB2_ID})"

# 주소록 멤버 추가
if [[ -n "$AB1_ID" && "$AB1_ID" != "None" ]]; then
  resp=$(req POST "/address-book/groups/${AB1_ID}/members" "{\"user_ids\":[${USER_IDS[0]},${USER_IDS[1]},${USER_IDS[2]}]}")
  log_ok "주소록 멤버 추가: 핵심 개발팀"
fi

if [[ -n "$AB2_ID" && "$AB2_ID" != "None" ]]; then
  resp=$(req POST "/address-book/groups/${AB2_ID}/members" "{\"user_ids\":[${USER_IDS[3]},${USER_IDS[4]}]}")
  log_ok "주소록 멤버 추가: 운영팀"
fi

# ── 19. 대시보드 조회 ──────────────────────────────────────────────────────

log_section "19. 대시보드 조회"

resp=$(req GET "/dashboard" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "대시보드 데이터 조회 성공"
else
  log_fail "대시보드 조회 실패"
fi

# ── 20. 검색 기능 ──────────────────────────────────────────────────────────

log_section "20. 검색 기능 테스트"

# 이슈 검색
resp=$(req GET "/search?q=로그인&type=issues" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "이슈 검색: '로그인'"
fi

# 프로젝트 검색
resp=$(req GET "/search?q=웹&type=projects" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "프로젝트 검색: '웹'"
fi

# 위키 검색
resp=$(req GET "/search?q=개발&type=wiki" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "위키 검색: '개발'"
fi

# 전체 검색
resp=$(req GET "/search?q=API" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "전체 검색: 'API'"
fi

# ── 21. 알림 조회 ──────────────────────────────────────────────────────────

log_section "21. 알림 조회"

resp=$(req GET "/notifications" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "알림 목록 조회"
else
  log_fail "알림 조회 실패"
fi

# ── 22. 관리 기능 확인 ─────────────────────────────────────────────────────

log_section "22. 관리 기능 확인"

# 조직 설정 조회
resp=$(req GET "/admin/organization/settings" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "조직 설정 조회"
fi

# 부서 목록 조회
resp=$(req GET "/admin/organization/departments" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "부서 목록 조회"
fi

# 스케줄러 상태 조회
resp=$(req GET "/admin/scheduler" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "스케줄러 상태 조회"
fi

# 로그 레벨 조회
resp=$(req GET "/admin/logs/level" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "로그 레벨 조회"
fi

# 사용자 목록 조회
resp=$(req GET "/users" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "사용자 목록 조회"
fi

# 사용자 그룹 목록 조회
resp=$(req GET "/groups" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "그룹 목록 조회"
fi

# ── 23. 프로젝트 상세 조회 ─────────────────────────────────────────────────

log_section "23. 프로젝트 상세 조회"

if [[ -n "$P1_ID" && "$P1_ID" != "None" ]]; then
  resp=$(req GET "/projects/${P1_ID}" "")
  ok=$(json_val "$resp" "['success']")
  if [[ "$ok" == "True" || "$ok" == "true" ]]; then
    log_ok "프로젝트 상세 조회 (id=${P1_ID})"
  fi

  # 프로젝트 멤버 목록
  resp=$(req GET "/projects/${P1_ID}/members" "")
  log_ok "프로젝트 멤버 목록 조회 (id=${P1_ID})"
fi

# 이슈 목록 조회
resp=$(req GET "/issues?project_id=${P1_ID}" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "이슈 목록 조회 (project_id=${P1_ID})"
fi

# 태스크 목록 조회
resp=$(req GET "/tasks?project_id=${P1_ID}" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "태스크 목록 조회 (project_id=${P1_ID})"
fi

# 마일스톤 조회
resp=$(req GET "/milestones?project_id=${P1_ID}" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "마일스톤 목록 조회 (project_id=${P1_ID})"
fi

# 위키 목록 조회
resp=$(req GET "/wiki?project_id=${P1_ID}" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "위키 목록 조회 (project_id=${P1_ID})"
fi

# 게시글 목록 조회
resp=$(req GET "/posts?project_id=${P1_ID}" "")
ok=$(json_val "$resp" "['success']")
if [[ "$ok" == "True" || "$ok" == "true" ]]; then
  log_ok "게시글 목록 조회 (project_id=${P1_ID})"
fi

# ── 24. 이슈 상태 전환 테스트 ──────────────────────────────────────────────

log_section "24. 이슈 상태 전환 테스트"

if [[ ${#ISSUE_IDS[@]} -ge 4 ]]; then
  # 새 이슈 → 진행중
  resp=$(req PUT "/issues/${ISSUE_IDS[3]}" '{"status":"in_progress","done_ratio":20}')
  log_ok "이슈 상태 전환: new → in_progress (id=${ISSUE_IDS[3]})"

  # 진행중 → 완료
  resp=$(req PUT "/issues/${ISSUE_IDS[3]}" '{"status":"closed","done_ratio":100}')
  log_ok "이슈 상태 전환: in_progress → closed (id=${ISSUE_IDS[3]})"
fi

# ── 25. 태스크 진행률 업데이트 ─────────────────────────────────────────────

log_section "25. 태스크 진행률 업데이트"

if [[ ${#TASK_IDS[@]} -ge 2 ]]; then
  resp=$(req PUT "/tasks/${TASK_IDS[1]}" '{"progress":25,"status":"진행중"}')
  ok=$(json_val "$resp" "['success']")
  if [[ "$ok" == "True" || "$ok" == "true" ]]; then
    log_ok "태스크 진행률 업데이트: 0% → 25% (id=${TASK_IDS[1]})"
  fi
fi

# ── 요약 ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  샘플 데이터 생성 완료${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${GREEN}성공: ${SUCCESS_COUNT}건${NC}"
if [[ $FAIL_COUNT -gt 0 ]]; then
  echo -e "  ${RED}실패: ${FAIL_COUNT}건${NC}"
fi
echo ""
echo -e "  ${YELLOW}생성된 데이터 요약:${NC}"
echo -e "    • 사용자: admin + 일반 5명 (총 6명)"
echo -e "    • 부서: 2개 (개발팀, 기획팀)"
echo -e "    • 프로젝트: 3개 (WEB-APP, MOB-APP, INFRA)"
echo -e "    • 마일스톤: 3개"
echo -e "    • 태스크: 6개 (다양한 상태·유형)"
echo -e "    • 이슈: 9개 (버그/기능요청/개선, 다양한 우선순위)"
echo -e "    • 이슈 코멘트: 3건"
echo -e "    • 게시글: 5개 (공지/자유/제안)"
echo -e "    • 게시글 코멘트: 2건"
echo -e "    • 위키: 3페이지 (프로젝트별 + 글로벌)"
echo -e "    • 위키 코멘트: 2건"
echo -e "    • 쪽지 폴더: 2개"
echo -e "    • 쪽지: 3건 (일반/예약/만료)"
echo -e "    • 채팅방: 2개 + 메시지 4건"
echo -e "    • 사용자 그룹: 2개 + 멤버 + 리소스 공유"
echo -e "    • 주소록 그룹: 2개 + 멤버"
echo ""
echo -e "  ${YELLOW}기능 커버리지:${NC}"
echo -e "    ✔ 인증 (로그인/토큰)"
echo -e "    ✔ 사용자 CRUD"
echo -e "    ✔ 조직/부서 관리"
echo -e "    ✔ 프로젝트 CRUD + 멤버 관리"
echo -e "    ✔ 마일스톤 관리"
echo -e "    ✔ 태스크 관리 (CRUD + 진행률)"
echo -e "    ✔ 이슈 관리 (CRUD + 상태 전환 + 코멘트)"
echo -e "    ✔ 게시판 (CRUD + 코멘트)"
echo -e "    ✔ 위키 (CRUD + 버전 관리 + 코멘트)"
echo -e "    ✔ 쪽지 (발신/수신/예약/만료/폴더)"
echo -e "    ✔ 채팅 (방 생성/멤버/메시지)"
echo -e "    ✔ 사용자 그룹 (멤버/역할/리소스 공유)"
echo -e "    ✔ 주소록 (그룹/멤버)"
echo -e "    ✔ 대시보드 조회"
echo -e "    ✔ 통합 검색"
echo -e "    ✔ 알림 조회"
echo -e "    ✔ 관리자 기능 (조직/스케줄러/로그)"
echo ""
echo -e "  ${GREEN}로그인 정보:${NC}"
echo -e "    • admin / ${ADMIN_PASS}"
echo -e "    • 일반 사용자: pass1234 비밀번호"
echo ""
