import { Save, X, Plus, Edit2 } from 'lucide-react';
import { Input } from 'ui/Input';
import type { Department } from 'shared/types/organization';

interface OrgFormProps {
  formMode: 'create' | 'edit';
  currentDept: Partial<Department>;
  setCurrentDept: (dept: Partial<Department>) => void;
  departments: Department[];
  error: string;
  onClose: () => void;
  onSubmit: () => void;
  t: (key: string) => string;
}

export function OrgForm({
  formMode,
  currentDept,
  setCurrentDept,
  departments,
  error,
  onClose,
  onSubmit,
  t,
}: OrgFormProps) {
  const parentOptions = departments.filter(d =>
    formMode === 'edit' ? d.id !== currentDept.id : true
  );

  return (
    <div className="flex flex-col h-full select-none overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">
      {/* 헤더 */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            {formMode === 'create' ? (
              <Plus size={20} className="text-[var(--primary)]" />
            ) : (
              <Edit2 size={20} className="text-[var(--primary)]" />
            )}
            {formMode === 'create'
              ? t('addDepartment')
              : t('editDepartment')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 폼 본문 */}
      <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
        {error && (
          <div className="bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm p-3 rounded-lg mb-4 border border-[var(--destructive)]/20">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-5">
          <Input
            label={t('deptName')}
            value={currentDept.name || ''}
            onChange={(e) =>
              setCurrentDept({ ...currentDept, name: e.target.value })
            }
            required
            fullWidth
          />

          <div>
            <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
              {t('parentDept')}
            </label>
            <select
              className="w-full h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors"
              value={currentDept.parent_id ?? ''}
              onChange={(e) =>
                setCurrentDept({
                  ...currentDept,
                  parent_id: e.target.value || null,
                })
              }
            >
              <option value="">{t('none')}</option>
              {parentOptions.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-[var(--text-primary)] mb-2">
              {t('description')}
            </label>
            <textarea
              className="w-full min-h-[100px] px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-colors resize-y"
              value={currentDept.description || ''}
              onChange={(e) =>
                setCurrentDept({ ...currentDept, description: e.target.value })
              }
              placeholder={t('deptDescriptionPlaceholder')}
            />
          </div>
        </div>
      </div>

      {/* 하단 액션 */}
      <div className="shrink-0 px-6 py-4 border-t border-[var(--border)] flex items-center gap-3">
        <button
          onClick={onClose}
          className="flex-1 h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] text-sm font-bold transition-colors cursor-pointer"
        >
          {t('cancel')}
        </button>
        <button
          onClick={onSubmit}
          className="flex-1 h-10 rounded-xl bg-[var(--primary)] hover:opacity-90 text-white text-sm font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] border-none"
        >
          <Save size={15} />
          {formMode === 'create'
            ? t('submitAdd')
            : t('submitUpdate')}
        </button>
      </div>
    </div>
  );
}
