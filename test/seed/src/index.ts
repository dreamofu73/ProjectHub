/**
 * ProjectHub 샘플 데이터 시더.
 *
 * 백엔드 REST API를 통해서만 데이터를 생성합니다 (DB 직접 접근 없음).
 * 기존 Rust 시더(--seed-sample)를 대체하며, 멱등적이어서 여러 번 실행해도
 * 중복 데이터가 생기지 않습니다.
 *
 * 실행: npm run seed --prefix test/seed -- [옵션]
 *   --base-url       기본 http://localhost:8000
 *   --admin-login    기본 admin
 *   --admin-password 기본 admin123
 *   --count N        콘텐츠 유형별 생성 개수 (기본 120, 1~200)
 *   --reset          시딩 전 기존 샘플 데이터 삭제
 */

import {
  ApiClient,
  ApiError,
  login,
} from './client.js';
import { resetSampleData } from './reset.js';
import {
  ADDRESS_BOOK,
  BASE_GENERATED_COUNT,
  buildSampleData,
  CHAT,
  CUSTOM_FIELDS,
  DEPARTMENTS,
  PROJECT_MEMBERS,
  USER_GROUP,
  USER_PASSWORD,
} from './sample-data.js';

interface CliArgs {
  baseUrl: string;
  adminLogin: string;
  adminPassword: string;
  count: number;
  reset: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    baseUrl: 'http://localhost:8000',
    adminLogin: 'admin',
    adminPassword: 'admin123',
    count: BASE_GENERATED_COUNT,
    reset: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base-url') args.baseUrl = argv[++i] ?? args.baseUrl;
    else if (a === '--admin-login') args.adminLogin = argv[++i] ?? args.adminLogin;
    else if (a === '--admin-password') args.adminPassword = argv[++i] ?? args.adminPassword;
    else if (a === '--count') {
      const n = parseInt(argv[++i] ?? '', 10);
      args.count = Number.isNaN(n) ? BASE_GENERATED_COUNT : Math.min(200, Math.max(1, n));
    } else if (a === '--reset') args.reset = true;
  }
  return args;
}

interface EnsureResult {
  id: string;
  created: boolean;
}

/** 이미 존재하면 재사용하고, 없으면 생성합니다. */
async function ensureBy(
  existing: any[],
  match: (item: any) => boolean,
  create: () => Promise<string>,
): Promise<EnsureResult> {
  const hit = existing.find(match);
  if (hit) return { id: String(hit.id), created: false };
  return { id: await create(), created: true };
}

function log(label: string, created: number, existing: number): void {
  const parts: string[] = [];
  if (created > 0) parts.push(`${created}개 생성`);
  if (existing > 0) parts.push(`${existing}개 기존 재사용`);
  console.log(`  ${label}: ${parts.length ? parts.join(', ') : '변경 없음'}`);
}

/** 댓글은 내용 기준으로 멱등하게 추가합니다 (부분 실행 후에도 복구 가능). */
async function ensureComments(
  client: ApiClient,
  listPath: string,
  createPath: string,
  contents: string[],
): Promise<number> {
  if (contents.length === 0) return 0;
  let existing: any[] = [];
  try {
    existing = await client.getList(listPath);
  } catch {
    existing = [];
  }
  let added = 0;
  for (const content of contents) {
    if (existing.some((c) => c.content === content)) continue;
    await client.post(createPath, { content });
    added++;
  }
  return added;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`ProjectHub 샘플 데이터 시더`);
  console.log(`  대상: ${args.baseUrl}`);
  console.log(`  생성 개수(유형별): ${args.count}${args.reset ? ' (+ --reset 활성화)' : ''}`);

  // 1) 관리자 로그인
  const adminLoginRes = await login(args.baseUrl, args.adminLogin, args.adminPassword);
  const admin = new ApiClient(args.baseUrl, adminLoginRes.token);
  console.log(`  관리자 로그인: ${args.adminLogin}`);

  // 0) --reset: 기존 샘플 데이터 삭제
  if (args.reset) {
    console.log('\n--reset: 기존 샘플 데이터 삭제 시작');
    const result = await resetSampleData(admin);
    console.log(`  삭제 완료: ${JSON.stringify(result.deleted)}`);
    for (const n of result.notes) console.log(`  ℹ ${n}`);
    if (result.failed.length > 0) console.warn(`  ⚠ 삭제 실패 ${result.failed.length}건 — 첫 5건:\n    ${result.failed.slice(0, 5).join('\n    ')}`);
  }

  const data = buildSampleData(args.count);
  const { users, projects, milestones, tasks, issues, wiki, posts, memos } = data;

  // 2) 부서
  console.log('\n[1/12] 부서');
  const departments = await admin.getList('/api/admin/organization/departments');
  const deptByName = new Map<string, string>();
  let created = 0;
  let existing = 0;
  for (const d of DEPARTMENTS) {
    const r = await ensureBy(
      departments,
      (x) => x.name === d.name,
      async () => {
        const json = await admin.post('/api/admin/organization/departments', {
          name: d.name,
          description: d.description,
        });
        return String(json.data.id);
      },
    );
    deptByName.set(d.name, r.id);
    r.created ? created++ : existing++;
  }
  log('부서', created, existing);

  // 3) 사용자
  console.log('\n[2/12] 사용자');
  const existingUsers = await admin.getList('/api/users?limit=200');
  const userIdByLogin = new Map<string, string>();
  created = 0;
  existing = 0;
  for (const u of users) {
    const deptId = u.department ? deptByName.get(u.department) ?? null : null;
    const r = await ensureBy(
      existingUsers,
      (x) => x.login === u.login,
      async () => {
        await admin.post('/api/users', {
          login: u.login,
          email: u.email,
          password: u.password,
          firstname: u.firstname,
          lastname: u.lastname,
          role: u.role,
          ...(deptId ? { department_id: deptId } : {}),
        });
        const found = (
          await admin.getList(`/api/users?q=${encodeURIComponent(u.login)}&limit=10`)
        ).find((x) => x.login === u.login);
        if (!found) throw new Error(`사용자 생성 후 조회 실패: ${u.login}`);
        return String(found.id);
      },
    );
    userIdByLogin.set(u.login, r.id);
    r.created ? created++ : existing++;
  }
  log('사용자', created, existing);

  // alice가 admin이 아니면 승격 (프로젝트 생성은 admin 전용)
  {
    const freshUsers = await admin.getList(`/api/users?q=alice&limit=10`);
    const alice = freshUsers.find((x) => x.login === 'alice');
    if (alice && alice.role !== 'admin' && userIdByLogin.has('alice')) {
      await admin.put(`/api/users/${userIdByLogin.get('alice')}`, { role: 'admin' });
      console.log('  alice → admin 권한 승격');
    }
  }

  // 콘텐츠 생성 계정: alice(admin) 우선, 실패 시 admin 계정으로 대체
  let actor = admin;
  try {
    const aliceLogin = await login(args.baseUrl, 'alice', USER_PASSWORD);
    actor = new ApiClient(args.baseUrl, aliceLogin.token);
  } catch {
    console.warn('  ⚠ alice 로그인 실패 → admin 계정으로 콘텐츠를 생성합니다.');
  }

  // 4) 프로젝트
  console.log('\n[3/12] 프로젝트');
  const existingProjects = await actor.getList('/api/projects?all=true&limit=200');
  const projectByIdentifier = new Map<string, EnsureResult>();
  created = 0;
  existing = 0;
  for (const p of projects) {
    const r = await ensureBy(
      existingProjects,
      (x) => x.identifier === p.identifier,
      async () => {
        const json = await actor.post('/api/projects', {
          name: p.name,
          identifier: p.identifier,
          description: p.description,
          is_public: p.is_public,
        });
        return String(json.id);
      },
    );
    projectByIdentifier.set(p.identifier, r);
    r.created ? created++ : existing++;
  }
  log('프로젝트', created, existing);

  // 5) 프로젝트 멤버 (batch는 기존 멤버를 자동으로 건너뜀)
  console.log('\n[4/12] 프로젝트 멤버');
  for (const p of projects) {
    const proj = projectByIdentifier.get(p.identifier)!;
    const roles = PROJECT_MEMBERS[p.identifier] ?? [];
    for (const m of roles) {
      const uid = userIdByLogin.get(m.login);
      if (!uid) continue;
      if (m.role === 'manager') continue; // creator가 자동으로 manager
      await actor.post(`/api/projects/${proj.id}/members/batch`, {
        user_ids: [uid],
        role: m.role,
      });
    }
  }
  console.log('  프로젝트 멤버 추가 완료 (멱등)');

  // 6) 마일스톤
  console.log('\n[5/12] 마일스톤');
  const milestoneLists = new Map<string, any[]>(); // project identifier → list
  created = 0;
  existing = 0;
  for (const m of milestones) {
    const proj = projectByIdentifier.get(m.project)!;
    let list = milestoneLists.get(m.project);
    if (!list) {
      list = await actor.getList(`/api/milestones?project_id=${proj.id}`);
      milestoneLists.set(m.project, list);
    }
    const r = await ensureBy(
      list,
      (x) => x.name === m.name && String(x.project_id) === proj.id,
      async () => {
        const json = await actor.post('/api/milestones', {
          project_id: proj.id,
          name: m.name,
          description: m.description,
          due_date: m.due_date,
          status: m.status ?? 'open',
        });
        return String(json.id);
      },
    );
    r.created ? created++ : existing++;
  }
  log('마일스톤', created, existing);

  // 7) 일감 + 의존성
  console.log('\n[6/12] 일감');
  const taskIds = new Map<string, Map<string, string>>(); // project → title → id
  const taskLists = new Map<string, any[]>(); // project identifier → list
  created = 0;
  existing = 0;
  for (const t of tasks) {
    const proj = projectByIdentifier.get(t.project)!;
    let map = taskIds.get(t.project);
    if (!map) {
      map = new Map();
      taskIds.set(t.project, map);
    }
    let list = taskLists.get(t.project);
    if (!list) {
      list = await actor.getList(`/api/tasks?project_id=${proj.id}&limit=200`);
      taskLists.set(t.project, list);
    }
    const r = await ensureBy(
      list,
      (x) => x.title === t.title,
      async () => {
        const json = await actor.post('/api/tasks', {
          project_id: proj.id,
          title: t.title,
          description: t.description,
          task_type: t.task_type,
          task_category: t.task_category,
          status: t.status,
          planned_start_date: t.planned_start_date,
          planned_end_date: t.planned_end_date,
          progress: t.progress ?? 0,
          assignee_id: userIdByLogin.get(t.assignee),
        });
        return String(json.id);
      },
    );
    map.set(t.title, r.id);
    r.created ? created++ : existing++;
  }
  log('일감', created, existing);

  console.log('  일감 의존성');
  for (const t of tasks) {
    if (!t.depends_on) continue;
    const proj = projectByIdentifier.get(t.project)!;
    const predId = taskIds.get(t.project)?.get(t.depends_on);
    const succId = taskIds.get(t.project)?.get(t.title);
    if (!predId || !succId) continue;
    const deps = await actor.getList(`/api/projects/${proj.id}/task-dependencies`);
    const exists = deps.some(
      (d) => String(d.predecessor_id) === predId && String(d.successor_id) === succId,
    );
    if (!exists) {
      await actor.post('/api/tasks/dependencies', {
        project_id: proj.id,
        predecessor_id: predId,
        successor_id: succId,
        dependency_type: 'FS',
        lag_days: 0,
      });
    }
  }

  // 8) 커스텀 필드
  console.log('\n[7/12] 커스텀 필드');
  const fieldIds = new Map<string, Map<string, string>>(); // project → field_name → id
  for (const cfGroup of CUSTOM_FIELDS) {
    const proj = projectByIdentifier.get(cfGroup.project)!;
    const list = await actor.getList(`/api/projects/${proj.id}/custom-fields`);
    const map = new Map<string, string>();
    created = 0;
    existing = 0;
    for (const f of cfGroup.fields) {
      const r = await ensureBy(
        list,
        (x) => x.field_name === f.field_name,
        async () => {
          const json = await actor.post(`/api/projects/${proj.id}/custom-fields`, {
            field_name: f.field_name,
            field_type: f.field_type,
            is_required: f.is_required ?? 0,
            sort_order: f.sort_order ?? 0,
          });
          return String(json.id);
        },
      );
      map.set(f.field_name, r.id);
      r.created ? created++ : existing++;
    }
    fieldIds.set(cfGroup.project, map);
    log(`커스텀 필드 (${cfGroup.project})`, created, existing);
  }

  // 9) 이슈 + 커스텀 값 + 댓글
  console.log('\n[8/12] 이슈');
  const issueLists = new Map<string, any[]>(); // project identifier → list
  created = 0;
  existing = 0;
  for (const issue of issues) {
    const proj = projectByIdentifier.get(issue.project)!;
    let list = issueLists.get(issue.project);
    if (!list) {
      list = await actor.getList(`/api/issues?project_id=${proj.id}&limit=200`);
      issueLists.set(issue.project, list);
    }
    const r = await ensureBy(
      list,
      (x) => x.subject === issue.subject,
      async () => {
        const json = await actor.post('/api/issues', {
          project_id: proj.id,
          subject: issue.subject,
          tracker: issue.tracker,
          description: issue.description,
          status: issue.status,
          priority: issue.priority,
          task_type: issue.task_type,
        });
        return String(json.id);
      },
    );
    if (r.created) {
      const fieldMap = fieldIds.get(issue.project);
      if (fieldMap && issue.custom) {
        const values = Object.entries(issue.custom)
          .filter(([k]) => fieldMap.has(k))
          .map(([k, v]) => ({ field_id: fieldMap.get(k)!, value: v }));
        if (values.length > 0) {
          await actor.put(`/api/issues/${r.id}/custom-values`, { values });
        }
      }
    }
    await ensureComments(
      actor,
      `/api/issues/${r.id}/comments`,
      `/api/issues/${r.id}/comments`,
      issue.comments ?? [],
    );
    r.created ? created++ : existing++;
  }
  log('이슈', created, existing);

  // 10) 위키 + 댓글
  console.log('\n[9/12] 위키');
  const wikiLists = new Map<string, any[]>(); // project identifier → list
  created = 0;
  existing = 0;
  for (const w of wiki) {
    const proj = projectByIdentifier.get(w.project)!;
    let list = wikiLists.get(w.project);
    if (!list) {
      list = await actor.getList(`/api/wiki?project_id=${proj.id}`);
      wikiLists.set(w.project, list);
    }
    const r = await ensureBy(
      list,
      (x) => x.title === w.title,
      async () => {
        const json = await actor.post('/api/wiki', {
          project_id: proj.id,
          title: w.title,
          content: w.content,
        });
        return String(json.data.id);
      },
    );
    await ensureComments(
      actor,
      `/api/wiki/${r.id}/comments`,
      `/api/wiki/${r.id}/comments`,
      w.comments ?? [],
    );
    r.created ? created++ : existing++;
  }
  log('위키', created, existing);

  // 11) 게시판 + 댓글 + 첨부
  console.log('\n[10/12] 게시판');
  const postLists = new Map<string, any[]>(); // project identifier → deduped list
  created = 0;
  existing = 0;
  for (const p of posts) {
    const proj = projectByIdentifier.get(p.project)!;
    let list = postLists.get(p.project);
    if (!list) {
      const seen = new Map<string, any>();
      for (const cat of ['notice', 'resource', 'general']) {
        const items = await actor.getList(
          `/api/posts?project_id=${proj.id}&category=${encodeURIComponent(cat)}`,
        );
        for (const it of items) seen.set(String(it.id), it);
      }
      list = [...seen.values()];
      postLists.set(p.project, list);
    }
    const r = await ensureBy(
      list,
      (x) => x.title === p.title,
      async () => {
        const json = await actor.post('/api/posts', {
          project_id: proj.id,
          title: p.title,
          content: p.content,
          category: p.category,
          is_pinned: p.is_pinned ?? false,
        });
        return String(json.id);
      },
    );
    await ensureComments(
      actor,
      `/api/posts/${r.id}/comments`,
      `/api/posts/${r.id}/comments`,
      p.comments ?? [],
    );
    if (r.created && p.attachment) {
      const form = new FormData();
      form.append(
        'file',
        new Blob([p.attachment.content], { type: 'text/plain' }),
        p.attachment.filename,
      );
      form.append('post_id', r.id);
      await actor.upload('/api/attachments', form);
    }
    r.created ? created++ : existing++;
  }
  log('게시글', created, existing);

  // 12) 쪽지 + 폴더
  console.log('\n[11/12] 쪽지');
  const folders = await actor.getList('/api/memos/folders');
  const folderIdByName = new Map<string, string>();
  const folderNames = [...new Set(memos.filter((m) => m.folder).map((m) => m.folder!))];
  for (const name of folderNames) {
    const r = await ensureBy(
      folders,
      (x) => x.name === name,
      async () => {
        const json = await actor.post('/api/memos/folders', { name });
        return String(json.data.id);
      },
    );
    folderIdByName.set(name, r.id);
  }

  const sentMemos = await actor.getList('/api/memos/sent?page=1&limit=200');
  created = 0;
  existing = 0;
  for (const m of memos) {
    const already = sentMemos.some((x) => x.title === m.title);
    if (already) {
      existing++;
      continue;
    }
    const receiverIds = m.receivers
      .map((r) => userIdByLogin.get(r))
      .filter((id): id is string => Boolean(id));
    if (receiverIds.length === 0) continue;
    const json = await actor.post('/api/memos', {
      receiver_ids: receiverIds,
      title: m.title,
      content: m.content,
    });
    const memoIds: string[] = json?.data?.memo_ids ?? [];
    if (m.folder && memoIds.length > 0) {
      const fid = folderIdByName.get(m.folder);
      if (fid) {
        await actor.post('/api/memos/folders/move', {
          folder_id: fid,
          memo_ids: memoIds,
        });
      }
    }
    created++;
  }
  log('쪽지', created, existing);

  // 13) 채팅
  console.log('\n[12/12] 채팅 / 그룹 / 주소록');
  const rooms = await actor.getList('/api/chat/rooms');
  const room = await ensureBy(
    rooms,
    (x) => x.name === CHAT.room,
    async () => {
      const json = await actor.post('/api/chat/rooms', { name: CHAT.room });
      return String(json.id);
    },
  );
  for (const member of CHAT.members) {
    const uid = userIdByLogin.get(member);
    if (!uid) continue;
    await actor.post(`/api/chat/rooms/${room.id}/members`, { user_id: uid });
  }
  // --reset으로 메시지가 지워져도 재시드되도록 메시지는 항상 보장 (내용 기준 멱등)
  const messages = await actor.getList(`/api/chat?room_id=${room.id}&limit=100`);
  for (const msg of CHAT.messages) {
    if (messages.some((x) => x.content === msg)) continue;
    await actor.post('/api/chat', { room_id: room.id, content: msg });
  }
  console.log(`  채팅방: ${room.created ? '생성' : '기존 재사용'}`);

  // 사용자 그룹 + 공유
  const groups = await actor.getList('/api/groups');
  const group = await ensureBy(
    groups,
    (x) => x.name === USER_GROUP.name,
    async () => {
      const memberIds = USER_GROUP.members
        .map((m) => userIdByLogin.get(m))
        .filter((id): id is string => Boolean(id));
      const json = await actor.post('/api/groups', {
        name: USER_GROUP.name,
        description: USER_GROUP.description,
        is_shared: USER_GROUP.is_shared ? 1 : 0,
        member_ids: memberIds,
      });
      return String(json.data.id);
    },
  );
  if (USER_GROUP.share) {
    const proj = projectByIdentifier.get(USER_GROUP.share.project)!;
    const shares = await actor.getList(`/api/groups/${group.id}/shares`);
    const shared = shares.some((s) => String(s.resource_id) === proj.id);
    if (!shared) {
      await actor.post(`/api/groups/${group.id}/shares`, {
        resource_type: 'project',
        resource_id: proj.id,
        permission_level: USER_GROUP.share.permission,
      });
    }
  }
  console.log(`  사용자 그룹: ${group.created ? '생성' : '기존 재사용'}`);

  // 주소록
  const abGroups = await actor.getList('/api/address-book/groups');
  const abGroup = await ensureBy(
    abGroups,
    (x) => x.name === ADDRESS_BOOK.name,
    async () => {
      const json = await actor.post('/api/address-book/groups', { name: ADDRESS_BOOK.name });
      return String(json.data.id);
    },
  );
  const abMemberIds = ADDRESS_BOOK.members
    .map((m) => userIdByLogin.get(m))
    .filter((id): id is string => Boolean(id));
  if (abMemberIds.length > 0) {
    await actor.post(`/api/address-book/groups/${abGroup.id}/members`, {
      user_ids: abMemberIds,
    });
  }
  console.log(`  주소록 그룹: ${abGroup.created ? '생성' : '기존 재사용'}`);

  console.log('\n샘플 데이터 시딩 완료 ✅');
  console.log(`  샘플 계정: alice / bob / carol (비밀번호: ${USER_PASSWORD})`);
  console.log(`  유형별 생성 개수: ${args.count}개 (${users.length}명 사용자 / ${projects.length}개 프로젝트 / ${milestones.length}개 마일스톤 / ${tasks.length}개 일감 / ${issues.length}개 이슈 / ${wiki.length}개 위키 / ${posts.length}개 게시글 / ${memos.length}개 쪽지)`);
  console.log(`  기존에 있던 항목은 재사용되어 중복이 없습니다.`);
  console.log(`  --reset 사용 여부: ${args.reset ? '사용 (삭제 후 재시드)' : '미사용'}`);
}

main().catch((err) => {
  if (err instanceof ApiError) {
    console.error(`\n오류: ${err.message}`);
  } else {
    console.error(`\n오류: ${err instanceof Error ? err.message : String(err)}`);
  }
  process.exit(1);
});
