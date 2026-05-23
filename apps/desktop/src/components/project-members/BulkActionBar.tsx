import { Users, Trash2 } from 'lucide-react';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';

interface BulkActionBarProps {
  selectedIds: Set<string>;
  bulkRole: string;
  setBulkRole: (role: string) => void;
  ROLE_OPTIONS: { value: string; label: string }[];
  handleBulkRoleChange: () => void;
  handleBulkDelete: () => void;
  bulkUpdating: boolean;
  clearSelection: () => void;
}

export function BulkActionBar({
  selectedIds,
  bulkRole,
  setBulkRole,
  ROLE_OPTIONS,
  handleBulkRoleChange,
  handleBulkDelete,
  bulkUpdating,
  clearSelection,
}: BulkActionBarProps) {
  if (selectedIds.size === 0) return null;

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardBody className="px-5 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-semibold text-foreground whitespace-nowrap" aria-live="polite" aria-atomic="true">
            <Users size={14} className="inline mr-1.5 text-primary" />
            {selectedIds.size}명 선택됨
          </span>

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-2">
            <select
              className="text-xs font-medium rounded-lg px-3 py-1.5 border border-border bg-[var(--bg-surface-2)] cursor-pointer text-foreground"
              value={bulkRole}
              onChange={(e) => setBulkRole(e.target.value)}
              aria-label="선택한 멤버의 권한 변경"
            >
              <option value="">권한 변경...</option>
              {ROLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              disabled={!bulkRole || bulkUpdating}
              onClick={handleBulkRoleChange}
            >
              {bulkUpdating ? '처리 중...' : '적용'}
            </Button>
          </div>

          <div className="h-5 w-px bg-border" />

          <button
            onClick={handleBulkDelete}
            disabled={bulkUpdating}
            className="px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-bg rounded-lg transition-all border border-danger/30 bg-transparent cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={13} className="inline mr-1" />
            선택 제외
          </button>

          <div className="flex-1" />

          <button
            onClick={clearSelection}
            className="text-xs text-muted hover:text-foreground transition-colors bg-transparent border-none cursor-pointer"
          >
            선택 해제
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
