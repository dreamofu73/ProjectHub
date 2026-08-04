import { Users, Trash2 } from 'lucide-react';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';
import { useLanguage } from 'shared/hooks/LanguageContext';

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
  const { t } = useLanguage();
  if (selectedIds.size === 0) return null;

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardBody className="px-5 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-semibold text-foreground whitespace-nowrap" aria-live="polite" aria-atomic="true">
            <Users size={14} className="inline mr-1.5 text-primary" />
            {t('selectedCountSuffix').replace('{count}', String(selectedIds.size))}
          </span>

          <div className="h-5 w-px bg-border" />

          <div className="flex items-center gap-2">
            <select
              className="text-xs font-medium rounded-lg px-3 py-1.5 border border-border bg-[var(--bg-surface-2)] cursor-pointer text-foreground"
              value={bulkRole}
              onChange={(e) => setBulkRole(e.target.value)}
              aria-label={t('changeMemberPermission')}
            >
              <option value="">{t('changeRoleTo')}</option>
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
              {bulkUpdating ? t('processing') : t('editorApply')}
            </Button>
          </div>

          <div className="h-5 w-px bg-border" />

          <button
            onClick={handleBulkDelete}
            disabled={bulkUpdating}
            className="px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-bg rounded-lg transition-all border border-danger/30 bg-transparent cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={13} className="inline mr-1" />
            {t('excludeSelected')}
          </button>

          <div className="flex-1" />

          <button
            onClick={clearSelection}
            className="text-xs text-muted hover:text-foreground transition-colors bg-transparent border-none cursor-pointer"
          >
            {t('deselect')}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
