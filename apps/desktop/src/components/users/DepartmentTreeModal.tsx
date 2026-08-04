import { useState, useMemo, useCallback } from 'react';
import { X, FolderTree, FolderOpen, ChevronRight, ChevronDown, Search, Building2, UserMinus } from 'lucide-react';
import type { Department } from 'shared/types/organization';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useLanguage } from 'shared/hooks/LanguageContext';

interface DepartmentTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (departmentId: string | null) => void;
  departments: Department[];
}

interface TreeNode {
  dept: Department;
  depth: number;
  hasChildren: boolean;
}

export function DepartmentTreeModal({ isOpen, onClose, onSelect, departments }: DepartmentTreeModalProps) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const containerRef = useFocusTrap(isOpen);

  // Build children map
  const childrenMap = useMemo(() => {
    const map = new Map<string | null, Department[]>();
    for (const dept of departments) {
      const parentId = dept.parent_id;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(dept);
    }
    return map;
  }, [departments]);

  // Visible tree nodes
  const visibleTree = useMemo(() => {
    if (!searchTerm.trim()) {
      // Normal mode — respect expanded state
      const roots = childrenMap.get(null) || [];
      const build = (parents: Department[], depth: number): TreeNode[] => {
        const result: TreeNode[] = [];
        for (const dept of parents) {
          const children = childrenMap.get(dept.id) || [];
          result.push({ dept, depth, hasChildren: children.length > 0 });
          if (expandedIds.has(dept.id)) {
            result.push(...build(children, depth + 1));
          }
        }
        return result;
      };
      return build(roots, 0);
    }

    // Search mode
    const lower = searchTerm.toLowerCase();
    const matchingIds = new Set<string>();
    const ancestorIds = new Set<string>();
    for (const dept of departments) {
      if (dept.name.toLowerCase().includes(lower)) matchingIds.add(dept.id);
    }
    const deptMap = new Map(departments.map(d => [d.id, d]));
    for (const id of matchingIds) {
      let cur = deptMap.get(id);
      while (cur && cur.parent_id) {
        ancestorIds.add(cur.parent_id);
        cur = deptMap.get(cur.parent_id);
      }
    }
    const visibleIds = new Set([...matchingIds, ...ancestorIds]);
    const roots = childrenMap.get(null) || [];
    const build = (parents: Department[], depth: number): TreeNode[] => {
      const result: TreeNode[] = [];
      for (const dept of parents) {
        const children = childrenMap.get(dept.id) || [];
        const hasVisibleChildren = children.some(c => visibleIds.has(c.id));
        if (visibleIds.has(dept.id) || hasVisibleChildren) {
          result.push({ dept, depth, hasChildren: children.length > 0 && hasVisibleChildren });
          if (hasVisibleChildren) result.push(...build(children, depth + 1));
        }
      }
      return result;
    };
    return build(roots, 0);
  }, [departments, childrenMap, expandedIds, searchTerm]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = (deptId: string | null) => {
    onSelect(deptId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        ref={containerRef}
        className="w-full max-w-md bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border)] animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Building2 size={16} className="text-[var(--primary)]" />
            {t('selectDept')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--bg-surface-2)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors border-none bg-transparent cursor-pointer flex items-center"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder={t('searchDeptPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)]/40 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar min-h-0">
          {/* t('noDept') option */}
          <div
            onClick={() => handleSelect(null)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-[var(--bg-surface-2)]/50 text-[var(--text-muted)] transition-colors mb-1"
          >
            <div className="w-6 h-6 rounded-lg bg-[var(--bg-surface-2)] flex items-center justify-center shrink-0">
              <UserMinus size={13} className="text-[var(--text-muted)]" />
            </div>
            <span className="text-xs font-medium">{t('noDept')}</span>
          </div>

          {departments.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              {t('noDeptsFound')}
            </div>
          ) : visibleTree.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              {t('chatNoUsersFound')}
            </div>
          ) : (
            visibleTree.map((node, idx) => {
              const { dept, depth, hasChildren } = node;
              const isExpanded = expandedIds.has(dept.id);
              return (
                <div
                  key={`${dept.id}-${idx}`}
                  className="flex items-center gap-1 py-1.5 pr-3 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-surface-2)]/50"
                  onClick={() => handleSelect(dept.id)}
                  style={{ paddingLeft: `${8 + depth * 20}px` }}
                >
                  {/* Expand/collapse */}
                  <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                    {hasChildren ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(dept.id); }}
                        className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] border-none bg-transparent cursor-pointer flex items-center justify-center rounded hover:bg-[var(--bg-surface-2)] transition-colors"
                      >
                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>
                    ) : (
                      <div className="w-3.5" />
                    )}
                  </div>
                  {/* Folder icon */}
                  <div className="w-6 h-6 rounded-lg bg-[var(--bg-surface-2)] flex items-center justify-center shrink-0 text-[var(--text-muted)]">
                    {isExpanded && hasChildren ? <FolderOpen size={13} /> : <FolderTree size={13} />}
                  </div>
                  {/* Name */}
                  <span className="text-xs font-medium text-[var(--text-primary)] truncate min-w-0 flex-1 ml-1">
                    {dept.name}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
