/**
 * Sample data for the ProjectHub seeder.
 *
 * Data is keyed by stable markers (login, identifier, name, title) so the
 * seeder can detect what already exists and stay idempotent across runs.
 */

export const USER_PASSWORD = 'SamplePass123!';

export interface DepartmentSeed {
  name: string;
  description: string;
}

export interface UserSeed {
  login: string;
  email: string;
  password: string;
  firstname: string;
  lastname: string;
  role: 'admin' | 'user' | 'overseer';
  department?: string;
}

export interface ProjectSeed {
  identifier: string;
  name: string;
  description: string;
  is_public: boolean;
}

export interface MilestoneSeed {
  project: string; // project identifier
  name: string;
  description: string;
  due_date?: string;
  status?: string;
}

export interface TaskSeed {
  project: string;
  title: string;
  description: string;
  task_type: string;
  task_category: string;
  status: string;
  assignee: string; // user login
  planned_start_date?: string;
  planned_end_date?: string;
  progress?: number;
  depends_on?: string; // task title
}

export interface CustomFieldSeed {
  field_name: string;
  field_type: string;
  is_required?: number;
  sort_order?: number;
}

export interface IssueSeed {
  project: string;
  subject: string;
  tracker: string;
  description: string;
  status: string;
  priority: string;
  task_type: string;
  custom?: Record<string, string>; // custom field name → value
  comments?: string[];
}

export interface WikiSeed {
  project: string;
  title: string;
  content: string;
  comments?: string[];
}

export interface PostSeed {
  project: string;
  category: string; // notice | resource | general
  title: string;
  content: string;
  is_pinned?: boolean;
  comments?: string[];
  attachment?: { filename: string; content: string };
}

export interface MemoSeed {
  title: string;
  content: string;
  receivers: string[]; // user logins
  folder?: string;
}

export interface ChatSeed {
  room: string;
  members: string[]; // user logins
  messages: string[];
}

export interface GroupSeed {
  name: string;
  description: string;
  is_shared: boolean;
  members: string[]; // user logins
  share?: { project: string; permission: 'viewer' | 'member' | 'admin' };
}

export interface AddressBookSeed {
  name: string;
  members: string[]; // user logins
}

// ─── Data ───────────────────────────────────────────────────────────

export const DEPARTMENTS: DepartmentSeed[] = [
  { name: '개발팀', description: '프론트엔드 / 백엔드 개발 담당' },
  { name: '디자인팀', description: 'UI/UX 디자인 담당' },
];

export const CURATED_USERS: UserSeed[] = [
  {
    login: 'alice',
    email: 'alice@example.com',
    password: USER_PASSWORD,
    firstname: '앨리스',
    lastname: '김',
    role: 'admin',
    department: '개발팀',
  },
  {
    login: 'bob',
    email: 'bob@example.com',
    password: USER_PASSWORD,
    firstname: '밥',
    lastname: '이',
    role: 'user',
    department: '개발팀',
  },
  {
    login: 'carol',
    email: 'carol@example.com',
    password: USER_PASSWORD,
    firstname: '캐롤',
    lastname: '박',
    role: 'user',
    department: '디자인팀',
  },
];

export const CURATED_PROJECTS: ProjectSeed[] = [
  {
    identifier: 'PHWEB',
    name: 'ProjectHub 웹',
    description: 'ProjectHub 웹 프론트엔드와 공유 UI 패키지 개발',
    is_public: true,
  },
  {
    identifier: 'PHMOB',
    name: 'ProjectHub 모바일',
    description: '모바일 / 데스크톱 앱 개발',
    is_public: false,
  },
  {
    identifier: 'LEGACY',
    name: '레거시 시스템 마이그레이션',
    description: '기존 레거시 시스템을 ProjectHub로 이전하는 작업',
    is_public: false,
  },
];

/** 프로젝트별 멤버 추가 (creator는 자동으로 manager가 됩니다). */
export const PROJECT_MEMBERS: Record<string, { login: string; role: string }[]> = {
  PHWEB: [
    { login: 'alice', role: 'manager' },
    { login: 'bob', role: 'developer' },
    { login: 'carol', role: 'developer' },
  ],
  PHMOB: [
    { login: 'alice', role: 'manager' },
    { login: 'bob', role: 'developer' },
  ],
  LEGACY: [
    { login: 'alice', role: 'manager' },
    { login: 'carol', role: 'developer' },
  ],
};

export const CURATED_MILESTONES: MilestoneSeed[] = [
  {
    project: 'PHWEB',
    name: 'v1.0 릴리스',
    description: '1차 기능 완성 및 릴리스',
    due_date: '2026-09-30',
  },
  {
    project: 'PHWEB',
    name: 'v1.1 릴리스',
    description: 'UX 개선 및 안정화',
    due_date: '2026-12-15',
  },
  {
    project: 'PHMOB',
    name: '앱 출시',
    description: '스토어 출시 준비',
    due_date: '2026-10-31',
  },
  {
    project: 'LEGACY',
    name: '마이그레이션 완료',
    description: '데이터 이전 및 검증 완료',
    due_date: '2026-11-30',
  },
];

export const CURATED_TASKS: TaskSeed[] = [
  {
    project: 'PHWEB',
    title: '프로젝트 초기 설정',
    description: '리포지토리 구성, CI 파이프라인, 환경 변수 설정',
    task_type: 'Development',
    task_category: 'Development',
    status: 'Done',
    assignee: 'bob',
    planned_start_date: '2026-08-03',
    planned_end_date: '2026-08-07',
    progress: 100,
  },
  {
    project: 'PHWEB',
    title: '공유 UI 패키지 구축',
    description: 'KanbanBoard 등 공용 컴포넌트를 packages/ui로 분리',
    task_type: 'Development',
    task_category: 'General',
    status: 'In Progress',
    assignee: 'alice',
    planned_start_date: '2026-08-10',
    planned_end_date: '2026-08-21',
    progress: 60,
    depends_on: '프로젝트 초기 설정',
  },
  {
    project: 'PHWEB',
    title: 'REST API 연동 테스트',
    description: '이슈/위키/게시판 API 연동 및 회귀 검증',
    task_type: 'Testing',
    task_category: 'Development',
    status: 'In Progress',
    assignee: 'bob',
    planned_start_date: '2026-08-17',
    planned_end_date: '2026-08-28',
    progress: 40,
    depends_on: '공유 UI 패키지 구축',
  },
  {
    project: 'PHWEB',
    title: '디자인 토큰 정리',
    description: '테마 CSS 변수 및 다크 모드 토큰 정리',
    task_type: 'Design',
    task_category: 'Design',
    status: 'New',
    assignee: 'carol',
    planned_start_date: '2026-08-24',
    planned_end_date: '2026-09-04',
    progress: 0,
    depends_on: '프로젝트 초기 설정',
  },
];

export const CUSTOM_FIELDS: { project: string; fields: CustomFieldSeed[] }[] = [
  {
    project: 'PHWEB',
    fields: [
      { field_name: '요구사항 링크', field_type: 'string', sort_order: 1 },
      { field_name: '긴급도', field_type: 'text', sort_order: 2 },
    ],
  },
];

export const CURATED_ISSUES: IssueSeed[] = [
  {
    project: 'PHWEB',
    subject: '로그인 세션 만료 버그',
    tracker: 'Bug',
    description: '일정 시간이 지나면 세션이 예고 없이 만료되는 문제',
    status: 'In Progress',
    priority: 'High',
    task_type: 'Development',
    custom: { '요구사항 링크': 'https://example.com/req/12', '긴급도': '높음' },
    comments: ['재현 절차를 추가했습니다.', '수정 브랜치에서 확인 부탁드립니다.'],
  },
  {
    project: 'PHWEB',
    subject: '대시보드 위젯 정렬 개선',
    tracker: 'Feature',
    description: '대시보드 위젯의 반응형 정렬 개선',
    status: 'New',
    priority: 'Medium',
    task_type: 'Design',
  },
  {
    project: 'PHWEB',
    subject: '다크 모드 토글 구현',
    tracker: 'Feature',
    description: '설정에서 다크 모드 전환 지원',
    status: 'Resolved',
    priority: 'Low',
    task_type: 'Development',
    comments: ['스타일 토큰 적용 완료했습니다.'],
  },
  {
    project: 'PHWEB',
    subject: '첨부 파일 미리보기 지원',
    tracker: 'Task',
    description: '이미지/문서 첨부 파일 미리보기 기능',
    status: 'New',
    priority: 'Medium',
    task_type: 'Development',
  },
  {
    project: 'PHWEB',
    subject: '프로젝트 권한 설정 화면',
    tracker: 'Feature',
    description: '프로젝트 멤버 역할별 권한 설정 화면',
    status: 'In Progress',
    priority: 'High',
    task_type: 'Development',
    custom: { '긴급도': '중간' },
    comments: ['역할별 권한 표를 정리해서 올리겠습니다.'],
  },
];

export const CURATED_WIKI: WikiSeed[] = [
  {
    project: 'PHWEB',
    title: '홈',
    content:
      'ProjectHub 웹 개발 위키입니다.\n\n이 위키는 프로젝트의 설계, 컨벤션, 회의록을 기록합니다.',
  },
  {
    project: 'PHWEB',
    title: '개발 가이드',
    content:
      '## 브랜치 전략\n- main / develop / feature/*\n\n## 커밋 컨벤션\n- Conventional Commits 사용 (feat:, fix:, refactor:)',
    comments: ['컨벤션 섹션을 추가했습니다.'],
  },
  {
    project: 'PHWEB',
    title: '회의록',
    content:
      '## 2026-08-05 주간 회의\n- v1.0 스코프 확정\n- 다크 모드는 v1.1로 이월',
  },
];

export const CURATED_POSTS: PostSeed[] = [
  {
    project: 'PHWEB',
    category: 'notice',
    title: 'v1.0 릴리스 일정 안내',
    content: 'v1.0 릴리스 일정이 2026-09-30으로 확정되었습니다.\nQA 일정에 참고해 주세요.',
    is_pinned: true,
  },
  {
    project: 'PHWEB',
    category: 'resource',
    title: '프로젝트 자료 모음',
    content: '기획서, 디자인 시안, API 문서 링크를 이 게시판에 공유합니다.',
  },
  {
    project: 'PHWEB',
    category: 'general',
    title: '주간 회고 공유',
    content: '이번 주 회고를 공유합니다.\n- 완료: 프로젝트 초기 설정\n- 예정: UI 패키지 분리',
    comments: ['좋은 내용 감사합니다!'],
    attachment: { filename: '회고록.txt', content: '2026-08 첫 주 회고\n- 프로젝트 초기 설정 완료\n- 다음 주: 공유 UI 패키지 구축' },
  },
];

export const CURATED_MEMOS: MemoSeed[] = [
  {
    title: '[샘플] 업무 협조 요청',
    content: '다음 주 일정을 확인해 주시고 회신 부탁드립니다.',
    receivers: ['bob', 'carol'],
    folder: '업무',
  },
  {
    title: '[샘플] 코드 리뷰 완료 안내',
    content: 'PR #42 리뷰를 완료했습니다. 확인해 주세요.',
    receivers: ['bob'],
  },
];

export const CHAT: ChatSeed = {
  room: 'ProjectHub 팀 채팅',
  members: ['alice', 'bob', 'carol'],
  messages: [
    '샘플 데이터가 준비되었습니다.',
    '첫 번째 채팅 메시지입니다.',
    '오늘 회의는 3시에 시작합니다.',
  ],
};

export const USER_GROUP: GroupSeed = {
  name: '개발팀 그룹',
  description: '개발팀 전용 사용자 그룹',
  is_shared: true,
  members: ['alice', 'bob', 'carol'],
  share: { project: 'PHWEB', permission: 'member' },
};

export const ADDRESS_BOOK: AddressBookSeed = {
  name: '동료',
  members: ['alice', 'bob', 'carol'],
};

// ─── Generated bulk data ────────────────────────────────────────────

/** 기본 대량 생성 개수 (--count 미지정 시 사용). */
export const BASE_GENERATED_COUNT = 120;

const GENERATED_DEPARTMENTS = ['개발팀', '디자인팀'];
const GENERATED_TASK_STATUSES = ['New', 'In Progress', 'Done'];
const GENERATED_ISSUE_TRACKERS = ['Bug', 'Feature', 'Task'];
const GENERATED_ISSUE_STATUSES = ['New', 'In Progress', 'Resolved'];
const GENERATED_ISSUE_PRIORITIES = ['Low', 'Medium', 'High'];
const GENERATED_POST_CATEGORIES = ['notice', 'resource', 'general'];

function generatedUserLogins(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `user${String(i + 1).padStart(3, '0')}`);
}

function generatedProjectIdentifiers(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `SAMP${String(i + 1).padStart(3, '0')}`);
}

export function buildGeneratedUsers(count: number): UserSeed[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      login: `user${String(n).padStart(3, '0')}`,
      email: `user${n}@example.com`,
      password: USER_PASSWORD,
      firstname: '샘플',
      lastname: `유저${n}`,
      role: 'user',
      department: GENERATED_DEPARTMENTS[i % GENERATED_DEPARTMENTS.length],
    };
  });
}

export function buildGeneratedProjects(count: number): ProjectSeed[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      identifier: `SAMP${String(n).padStart(3, '0')}`,
      name: `[샘플] 프로젝트 ${n}`,
      description: `[샘플] 대량 생성 프로젝트 ${n}`,
      is_public: i % 2 === 0,
    };
  });
}

export function buildGeneratedMilestones(
  count: number,
  projectIdentifiers: string[],
): MilestoneSeed[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      project: projectIdentifiers[i % projectIdentifiers.length],
      name: `[샘플] 마일스톤 ${n}`,
      description: `[샘플] 대량 생성 마일스톤 ${n}`,
      status: 'open',
    };
  });
}

export function buildGeneratedTasks(
  count: number,
  projectIdentifiers: string[],
  userLogins: string[],
): TaskSeed[] {
  const progressByStatus: Record<string, number> = {
    New: 0,
    'In Progress': 50,
    Done: 100,
  };
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const status = GENERATED_TASK_STATUSES[i % GENERATED_TASK_STATUSES.length];
    return {
      project: projectIdentifiers[i % projectIdentifiers.length],
      title: `[샘플] 일감 ${n}`,
      description: `[샘플] 대량 생성 일감 ${n}`,
      task_type: 'Development',
      task_category: 'General',
      status,
      assignee: userLogins[i % userLogins.length],
      progress: progressByStatus[status],
    };
  });
}

export function buildGeneratedIssues(
  count: number,
  projectIdentifiers: string[],
): IssueSeed[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      project: projectIdentifiers[i % projectIdentifiers.length],
      subject: `[샘플] 이슈 ${n}`,
      tracker: GENERATED_ISSUE_TRACKERS[i % GENERATED_ISSUE_TRACKERS.length],
      description: `[샘플] 대량 생성 이슈 ${n}`,
      status: GENERATED_ISSUE_STATUSES[i % GENERATED_ISSUE_STATUSES.length],
      priority: GENERATED_ISSUE_PRIORITIES[i % GENERATED_ISSUE_PRIORITIES.length],
      task_type: 'Development',
    };
  });
}

export function buildGeneratedWiki(
  count: number,
  projectIdentifiers: string[],
): WikiSeed[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      project: projectIdentifiers[i % projectIdentifiers.length],
      title: `[샘플] 위키 페이지 ${n}`,
      content: `[샘플] 위키 내용 ${n}`,
    };
  });
}

export function buildGeneratedPosts(
  count: number,
  projectIdentifiers: string[],
): PostSeed[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      project: projectIdentifiers[i % projectIdentifiers.length],
      category: GENERATED_POST_CATEGORIES[i % GENERATED_POST_CATEGORIES.length],
      title: `[샘플] 게시글 ${n}`,
      content: `[샘플] 대량 생성 게시글 ${n}`,
    };
  });
}

export function buildGeneratedMemos(count: number, userLogins: string[]): MemoSeed[] {
  const receivers = [userLogins[0], userLogins[1]].filter(
    (login): login is string => Boolean(login),
  );
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      title: `[샘플] 쪽지 ${n}`,
      content: `[샘플] 대량 생성 쪽지 ${n}`,
      receivers,
    };
  });
}

export interface SampleData {
  users: UserSeed[];
  projects: ProjectSeed[];
  milestones: MilestoneSeed[];
  tasks: TaskSeed[];
  issues: IssueSeed[];
  wiki: WikiSeed[];
  posts: PostSeed[];
  memos: MemoSeed[];
}

/**
 * Build the full seed dataset for a given generated-item count.
 * Curated base data is always included; generated items are appended.
 */
export function buildSampleData(count: number): SampleData {
  const userLogins = generatedUserLogins(count);
  const projectIdentifiers = generatedProjectIdentifiers(count);
  return {
    users: [...CURATED_USERS, ...buildGeneratedUsers(count)],
    projects: [...CURATED_PROJECTS, ...buildGeneratedProjects(count)],
    milestones: [
      ...CURATED_MILESTONES,
      ...buildGeneratedMilestones(count, projectIdentifiers),
    ],
    tasks: [
      ...CURATED_TASKS,
      ...buildGeneratedTasks(count, projectIdentifiers, userLogins),
    ],
    issues: [...CURATED_ISSUES, ...buildGeneratedIssues(count, projectIdentifiers)],
    wiki: [...CURATED_WIKI, ...buildGeneratedWiki(count, projectIdentifiers)],
    posts: [...CURATED_POSTS, ...buildGeneratedPosts(count, projectIdentifiers)],
    memos: [...CURATED_MEMOS, ...buildGeneratedMemos(count, userLogins)],
  };
}
