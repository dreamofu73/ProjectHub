import { useState, useEffect, useCallback } from 'react';
import { Building2, Settings, X, Save } from 'lucide-react';
import { useOrganizationManagement } from '../../hooks/useOrganizationManagement';
import { OrgList } from '../../components/organization/OrgList';
import { OrgDetail } from '../../components/organization/OrgDetail';
import { OrgToolbar } from '../../components/organization/OrgToolbar';
import { OrgForm } from '../../components/organization/OrgForm';
import { Input } from 'ui/Input';
import type { Department } from 'shared/types/organization';

export default function OrganizationPage() {
  const {
    loading,
    searchTerm,
    setSearchTerm,
    formMode,
    showSettings,
    currentDept,
    setCurrentDept,
    error,
    members,
    membersLoading,
    departments,
    fetchMembers,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleUpdateSettings,
    openCreateModal,
    openCreateChild,
    openEditModal,
    openSettingsModal,
    closeModal,
    closeSettings,
    t,
    formatDate,
    orgSettings,
    settingsForm,
    setSettingsForm,
  } = useOrganizationManagement();

  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  // Inline department form: render when create/edit mode
  const isFormActive = formMode === 'create' || formMode === 'edit';

  // Auto-select first department from full list
  useEffect(() => {
    if (!loading && departments.length > 0 && !selectedDept) {
      setSelectedDept(departments[0]);
    }
  }, [loading, departments, selectedDept]);

  // ESC 키로 상세보기 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (isFormActive) return;
      if (selectedDept) {
        e.preventDefault();
        setSelectedDept(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDept, isFormActive]);

  // Fetch members when selected department changes
  useEffect(() => {
    if (selectedDept && !isFormActive) {
      fetchMembers(selectedDept.id);
    }
  }, [selectedDept, isFormActive, fetchMembers]);

  // Prevent body scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Split layout resizer
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem('org_leftWidth');
    return saved ? Number(saved) : 55;
  });

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = 'none';

    const container = document.getElementById('org-split-container');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const startX = e.clientX;
    const startWidth = leftWidth;

    const doResize = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerRect.width) * 100;
      const newWidth = Math.min(Math.max(startWidth + deltaPercent, 20), 80);
      setLeftWidth(newWidth);
      localStorage.setItem('org_leftWidth', String(newWidth));
    };

    const stopResize = () => {
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
    };

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
  }, [leftWidth]);

  return (
    <div className="w-full h-[calc(100vh-105px)] animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-2xl border border-[var(--border)] shadow-sm">

      {/* ── 상단 헤더 ── */}
      <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-surface)] border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Building2 size={16} className="text-[var(--primary)]" />
            <span>{t('organizationInfo') || '조직정보 관리'}</span>
            {orgSettings && (
              <span className="text-xs font-medium text-[var(--text-muted)] ml-1">
                {orgSettings.name}
              </span>
            )}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openSettingsModal}
            className="h-8 px-3.5 bg-[var(--primary)] hover:opacity-90 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98] border-none"
          >
            <Settings size={13} />
            {t('orgSettings') || '조직 설정'}
          </button>
        </div>
      </div>

      {/* ── 인라인 조직 설정 패널 ── */}
      {showSettings && (
        <div className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-surface-2)]/30 animate-in slide-in-from-top-2 duration-200">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Settings size={16} className="text-[var(--primary)]" />
                {t('orgSettings') || '조직 설정'}
              </h3>
            </div>

            {error && (
              <div className="bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm p-3 rounded-lg mb-4 border border-[var(--destructive)]/20">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  label={t('orgName') || '조직명 (회사명)'}
                  value={settingsForm.name}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, name: e.target.value })
                  }
                  required
                  fullWidth
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <Input
                  label={t('domain') || '대표 도메인'}
                  value={settingsForm.domain}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, domain: e.target.value })
                  }
                  fullWidth
                />
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <button
                  onClick={handleUpdateSettings}
                  className="h-10 px-4 rounded-xl bg-[var(--primary)] hover:opacity-90 text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-[0.98] border-none"
                >
                  <Save size={14} />
                  {t('save') || '저장'}
                </button>
                <button
                  onClick={closeSettings}
                  className="h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] text-xs font-bold transition-colors cursor-pointer flex items-center"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 메인 콘텐츠 ── */}
      <div className="flex flex-col flex-1 overflow-hidden p-5 gap-4">
        <OrgToolbar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          openCreateModal={openCreateModal}
          t={t}
        />

        {/* 목록 + 상세 분할 영역 */}
        <div id="org-split-container" className="flex-1 overflow-hidden flex min-h-0 flex-row">

          {/* 목록 영역 */}
          <div
            className="flex flex-col overflow-hidden border-[var(--border)] min-w-[280px] min-h-[150px]"
            style={{ width: `${leftWidth}%` }}
          >
            <OrgList
              departments={departments}
              loading={loading}
              selectedDeptId={selectedDept?.id || null}
                  onSelectDept={setSelectedDept}
                  onCreateChild={openCreateChild}
                  searchTerm={searchTerm}
                  t={t}
                />
          </div>

          {/* 리사이저 */}
          <div
            className="bg-[var(--border)] w-px h-full mx-0.5 shrink-0 relative cursor-col-resize group"
            onMouseDown={startResize}
          >
            <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-[var(--primary)]/20 transition-colors" />
          </div>

          {/* 우측 상세 패널 — 인라인 폼 또는 부서 상세 */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[var(--bg-surface)]">
            {isFormActive ? (
              <OrgForm
                formMode={formMode}
                currentDept={currentDept}
                setCurrentDept={setCurrentDept}
                departments={departments}
                error={error}
                onClose={closeModal}
                onSubmit={formMode === 'create' ? handleCreate : handleUpdate}
                t={t}
              />
            ) : (
              <OrgDetail
                department={selectedDept}
                members={members}
                membersLoading={membersLoading}
                onEdit={openEditModal}
                onDelete={(id) => {
                  handleDelete(id);
                  if (selectedDept?.id === id) setSelectedDept(null);
                }}
                formatDate={formatDate}
                t={t}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
