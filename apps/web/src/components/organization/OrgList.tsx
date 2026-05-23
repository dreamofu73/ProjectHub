import { useState, useMemo, useCallback } from 'react';
import { FolderTree, FolderOpen, ChevronRight, ChevronDown, Plus } from 'lucide-react';
import type { Department } from 'shared/types/organization';

interface OrgListProps {
  departments: Department[];
  loading: boolean;
  selectedDeptId: string | null;
  onSelectDept: (dept: Department) => void;
  onCreateChild: (parentId: string) => void;
  searchTerm: string;
  t: (key: string) => string;
}

interface TreeNode {
  dept: Department;
  depth: number;
  hasChildren: boolean;
}

export function OrgList({
  departments,
  loading,
  selectedDeptId,
  onSelectDept,
  searchTerm,
  t,
  onCreateChild,
}: OrgListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Build children map
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, Department[]>();
    for (const dept of departments) {
      const parentId = dept.parent_id;
      if (!map.has(parentId)) {
        map.set(parentId, []);
      }
      map.get(parentId)!.push(dept);
    }
    return map;
  }, [departments]);

  // Compute visible nodes (for search: matching + ancestors)
  const visibleTree = useMemo(() => {
    if (!searchTerm.trim()) {
      // No search — build tree from roots with expanded state
      const roots = childrenMap.get(null) || [];
      const buildVisible = (parents: Department[], depth: number): TreeNode[] => {
        const result: TreeNode[] = [];
        for (const dept of parents) {
          const children = childrenMap.get(dept.id) || [];
          result.push({ dept, depth, hasChildren: children.length > 0 });
          if (expandedIds.has(dept.id)) {
            result.push(...buildVisible(children, depth + 1));
          }
        }
        return result;
      };
      return buildVisible(roots, 0);
    }

    // Search mode — find matching departments and their ancestors
    const lowerSearch = searchTerm.toLowerCase();
    const matchingIds = new Set<string>();
    const ancestorIds = new Set<string>();

    // Find all matching departments
    for (const dept of departments) {
      if (dept.name.toLowerCase().includes(lowerSearch)) {
        matchingIds.add(dept.id);
      }
    }

    // Build ancestor chain for each match
    const deptMap = new Map(departments.map(d => [d.id, d]));
    for (const id of matchingIds) {
      let current = deptMap.get(id);
      while (current && current.parent_id) {
        ancestorIds.add(current.parent_id);
        current = deptMap.get(current.parent_id);
      }
    }

    // All visible IDs = matching + ancestors
    const visibleIds = new Set([...matchingIds, ...ancestorIds]);

    // Build visible tree (auto-expand all)
    const roots = childrenMap.get(null) || [];
    const buildVisible = (parents: Department[], depth: number): TreeNode[] => {
      const result: TreeNode[] = [];
      for (const dept of parents) {
        const children = childrenMap.get(dept.id) || [];
        const hasVisibleChildren = children.some(c => visibleIds.has(c.id));
        if (visibleIds.has(dept.id) || hasVisibleChildren || matchingIds.has(dept.id)) {
          result.push({ dept, depth, hasChildren: children.length > 0 && hasVisibleChildren });
          if (hasVisibleChildren) {
            result.push(...buildVisible(children, depth + 1));
          }
        }
      }
      return result;
    };
    return buildVisible(roots, 0);
  }, [departments, childrenMap, expandedIds, searchTerm]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center text-[var(--text-muted)]">
        <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin mx-auto mb-2" />
        <p className="font-medium text-xs">{t('loading') || '로딩 중...'}</p>
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="py-24 text-center text-[var(--text-muted)] font-medium text-xs">
        {t('noDeptsFound') || '등록된 부서가 없습니다.'}
      </div>
    );
  }

  if (visibleTree.length === 0) {
    return (
      <div className="py-24 text-center text-[var(--text-muted)] font-medium text-xs">
        {t('noSearchResults') || '검색 결과가 없습니다.'}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar select-none py-0.5">
      {visibleTree.map((node, idx) => {
        const { dept, depth, hasChildren } = node;
        const isSelected = selectedDeptId === dept.id;
        const isExpanded = expandedIds.has(dept.id);

        return (
          <div
            key={`${dept.id}-${idx}`}
            className="group"
          >
            {/* Tree row */}
            <div
              onClick={() => onSelectDept(dept)}
              className={`flex items-center gap-1 py-2 pr-3 cursor-pointer transition-colors rounded-lg mx-1 ${
                isSelected
                  ? 'bg-[var(--primary)]/10 text-[var(--text-primary)]'
                  : 'hover:bg-[var(--bg-surface-2)]/50 text-[var(--text-secondary)]'
              }`}
              style={{ paddingLeft: `${12 + depth * 20}px` }}
            >
              {/* Expand/collapse chevron */}
              <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                {hasChildren ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(dept.id);
                    }}
                    className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] border-none bg-transparent cursor-pointer flex items-center justify-center rounded hover:bg-[var(--bg-surface-2)] transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown size={13} />
                    ) : (
                      <ChevronRight size={13} />
                    )}
                  </button>
                ) : (
                  <div className="w-3.5" />
                )}
              </div>

              {/* Folder icon */}
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                isSelected
                  ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
                  : 'bg-[var(--bg-surface-2)] text-[var(--text-muted)]'
              }`}>
                {isExpanded && hasChildren ? (
                  <FolderOpen size={13} />
                ) : (
                  <FolderTree size={13} />
                )}
              </div>

              {/* Name */}
              <span className={`text-xs truncate min-w-0 flex-1 ${
                isSelected ? 'font-bold text-[var(--text-primary)]' : 'font-medium'
              }`}>
                {dept.name}
              </span>

              {/* Member count badge */}
              {dept.member_count > 0 && (
                <span className="text-xs font-bold text-[var(--text-muted)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 rounded-full shrink-0 leading-none">
                  {dept.member_count}
                </span>
              )}

              {/* Add sub-department button (visible on hover) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateChild(dept.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 border-none bg-transparent cursor-pointer flex items-center justify-center transition-all"
                title={t('addSubDept') || '하위 부서 추가'}
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
