import type { Task } from 'shared/types';

export interface TaskTreeNode {
  task: Task;
  /** 최상위 일감은 0, 하위로 내려갈 때마다 1씩 증가. */
  depth: number;
  hasChildren: boolean;
}

/**
 * 평평한 일감 목록을 `parent_task_id` 기준 트리 순서로 재배열한다.
 *
 * - 상위 일감이 목록에 없는 일감(필터링·권한으로 잘린 경우)은 최상위로 취급해
 *   화면에서 사라지지 않도록 한다.
 * - `collapsedIds`에 포함된 일감의 하위 항목은 결과에서 제외한다.
 * - 데이터가 손상되어 순환이 생기더라도 각 일감을 한 번만 방문한다.
 */
export function flattenTaskTree(
  tasks: Task[],
  collapsedIds?: ReadonlySet<string>,
): TaskTreeNode[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const childrenOf = new Map<string, Task[]>();
  const roots: Task[] = [];

  for (const task of tasks) {
    const parentId = task.parent_task_id;
    if (parentId && parentId !== task.id && byId.has(parentId)) {
      const siblings = childrenOf.get(parentId);
      if (siblings) siblings.push(task);
      else childrenOf.set(parentId, [task]);
    } else {
      roots.push(task);
    }
  }

  const result: TaskTreeNode[] = [];
  const visited = new Set<string>();

  const walk = (task: Task, depth: number) => {
    if (visited.has(task.id)) return;
    visited.add(task.id);

    const children = childrenOf.get(task.id) ?? [];
    result.push({ task, depth, hasChildren: children.length > 0 });

    if (collapsedIds?.has(task.id)) return;
    for (const child of children) walk(child, depth + 1);
  };

  for (const root of roots) walk(root, 0);

  // 순환 때문에 어느 루트에서도 도달하지 못한 일감이 남으면 최상위로 덧붙인다.
  for (const task of tasks) {
    if (!visited.has(task.id)) walk(task, 0);
  }

  return result;
}

/** 특정 일감과 그 하위 일감 전체의 ID 집합을 반환한다. */
export function collectSubtreeIds(tasks: Task[], rootId: string): Set<string> {
  const childrenOf = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.parent_task_id) continue;
    const siblings = childrenOf.get(task.parent_task_id);
    if (siblings) siblings.push(task);
    else childrenOf.set(task.parent_task_id, [task]);
  }

  const ids = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const child of childrenOf.get(id) ?? []) stack.push(child.id);
  }
  return ids;
}
