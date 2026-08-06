/**
 * Reset sample data via the REST API before reseeding.
 *
 * Deletes only sample-owned records (curated logins/identifiers plus the
 * `[샘플]`-prefixed generated items). Departments and the chat room are kept:
 * departments are risky to delete for real users, and chat rooms have no
 * delete endpoint. Sent memos go to the sender's trash instead of a hard
 * delete, which is acceptable for reset purposes.
 */

import { ApiClient } from './client.js';

export interface ResetResult {
  deleted: Record<string, number>;
  failed: string[];
  notes: string[];
}

/**
 * Delete each item via `deleteFn`, counting successes per label and collecting
 * failures. Continues on error so one bad item never aborts the reset.
 */
async function deleteMatching(
  actor: ApiClient,
  label: string,
  items: any[],
  deleteFn: (item: any) => Promise<unknown>,
  deleted: Record<string, number>,
  failed: string[],
): Promise<void> {
  for (const item of items) {
    try {
      await deleteFn(item);
      deleted[label] = (deleted[label] ?? 0) + 1;
    } catch (err) {
      failed.push(
        `${label} ${String(item.id)} 삭제 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (items.length > 0) {
    console.log(`  - ${label} ${deleted[label] ?? 0}개 삭제`);
  }
}

export async function resetSampleData(actor: ApiClient): Promise<ResetResult> {
  const deleted: Record<string, number> = {};
  const failed: string[] = [];
  const notes: string[] = [];

  // 사용자: alice/bob/carol + user\d+ 만 대상 (admin은 절대 삭제하지 않음)
  const users = await actor.getList('/api/users?limit=200');
  const targetUsers = users.filter(
    (u) =>
      u.login === 'alice' ||
      u.login === 'bob' ||
      u.login === 'carol' ||
      /^user\d+$/.test(u.login),
  );

  // 프로젝트: PHWEB/PHMOB/LEGACY + SAMP\d+ 만 대상
  const projects = await actor.getList('/api/projects?all=true&limit=200');
  const sampleProjects = projects.filter(
    (p) =>
      p.identifier === 'PHWEB' ||
      p.identifier === 'PHMOB' ||
      p.identifier === 'LEGACY' ||
      /^SAMP\d+$/.test(p.identifier),
  );

  // 프로젝트별 하위 콘텐츠 먼저 삭제 (FK: tasks/issues.author_id → users는 RESTRICT)
  for (const proj of sampleProjects) {
    const pid = String(proj.id);

    const fields = await actor.getList(`/api/projects/${pid}/custom-fields`);
    await deleteMatching(
      actor,
      'custom-fields',
      fields,
      (f) => actor.delete(`/api/projects/${pid}/custom-fields/${String(f.id)}`),
      deleted,
      failed,
    );

    const issues = await actor.getList(`/api/issues?project_id=${pid}&limit=200`);
    await deleteMatching(
      actor,
      'issues',
      issues,
      (x) => actor.delete(`/api/issues/${String(x.id)}`),
      deleted,
      failed,
    );

    const tasks = await actor.getList(`/api/tasks?project_id=${pid}&limit=200`);
    await deleteMatching(
      actor,
      'tasks',
      tasks,
      (x) => actor.delete(`/api/tasks/${String(x.id)}`),
      deleted,
      failed,
    );

    const milestones = await actor.getList(`/api/milestones?project_id=${pid}`);
    await deleteMatching(
      actor,
      'milestones',
      milestones,
      (x) => actor.delete(`/api/milestones/${String(x.id)}`),
      deleted,
      failed,
    );

    const wiki = await actor.getList(`/api/wiki?project_id=${pid}`);
    await deleteMatching(
      actor,
      'wiki',
      wiki,
      (x) => actor.delete(`/api/wiki/${String(x.id)}`),
      deleted,
      failed,
    );

    // 게시글: 카테고리별 조회 후 id 기준 중복 제거
    const postMap = new Map<string, any>();
    for (const cat of ['notice', 'resource', 'general']) {
      const items = await actor.getList(
        `/api/posts?project_id=${pid}&category=${encodeURIComponent(cat)}`,
      );
      for (const it of items) postMap.set(String(it.id), it);
    }
    const posts = [...postMap.values()];
    await deleteMatching(
      actor,
      'posts',
      posts,
      (x) => actor.delete(`/api/posts/${String(x.id)}`),
      deleted,
      failed,
    );
  }

  // 쪽지: 보낸 쪽지 중 [샘플] 제목만 삭제 (휴지통 이동으로 처리됨)
  const sentMemos = await actor.getList('/api/memos/sent?page=1&limit=200');
  const sampleMemos = sentMemos.filter((m) => /^\[샘플\]/.test(m.title));
  await deleteMatching(
    actor,
    'memos',
    sampleMemos,
    (m) => actor.delete(`/api/memos/${String(m.id)}`),
    deleted,
    failed,
  );

  // 채팅: 방은 유지하고 메시지만 삭제 (방 삭제 API 없음)
  try {
    const rooms = await actor.getList('/api/chat/rooms');
    const room = rooms.find((r) => r.name === 'ProjectHub 팀 채팅');
    if (room) {
      const messages = await actor.getList(`/api/chat?room_id=${String(room.id)}&limit=100`);
      await deleteMatching(
        actor,
        'chat-messages',
        messages,
        (m) => actor.delete(`/api/chat/${String(m.id)}`),
        deleted,
        failed,
      );
      notes.push('채팅방은 삭제 API가 없어 방을 유지하고 메시지만 삭제했습니다.');
    }
  } catch (err) {
    failed.push(`채팅 메시지 삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 사용자 그룹
  try {
    const groups = await actor.getList('/api/groups');
    const group = groups.find((g) => g.name === '개발팀 그룹');
    if (group) {
      await deleteMatching(
        actor,
        'groups',
        [group],
        (g) => actor.delete(`/api/groups/${String(g.id)}`),
        deleted,
        failed,
      );
    }
  } catch (err) {
    failed.push(`그룹 삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 주소록 그룹
  try {
    const abGroups = await actor.getList('/api/address-book/groups');
    const abGroup = abGroups.find((g) => g.name === '동료');
    if (abGroup) {
      await deleteMatching(
        actor,
        'address-book-groups',
        [abGroup],
        (g) => actor.delete(`/api/address-book/groups/${String(g.id)}`),
        deleted,
        failed,
      );
    }
  } catch (err) {
    failed.push(`주소록 그룹 삭제 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 프로젝트 → 사용자 순서로 삭제
  await deleteMatching(
    actor,
    'projects',
    sampleProjects,
    (p) => actor.delete(`/api/projects/${String(p.id)}`),
    deleted,
    failed,
  );

  await deleteMatching(
    actor,
    'users',
    targetUsers,
    (u) => actor.delete(`/api/users/${String(u.id)}`),
    deleted,
    failed,
  );

  notes.push('부서(개발팀/디자인팀)는 삭제하지 않고 유지합니다 (재시드 시 재사용).');

  return { deleted, failed, notes };
}