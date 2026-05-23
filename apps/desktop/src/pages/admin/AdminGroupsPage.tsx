import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from 'ui/Toast';
import { groupApi } from 'shared/lib/api';
import { Button } from 'ui/Button';
import { Shield, RefreshCw } from 'lucide-react';
import type { Group } from 'shared/types';
import { GroupsTable } from './components/GroupsTable';
import { GroupDetailPanel } from './components/GroupDetailPanel';

export default function AdminGroupsPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await groupApi.adminList({ limit: 100 });
      if (res.success) {
        setGroups(res.data || []);
      } else {
        setError(res.message || 'Failed to load groups');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleDeleteGroup = async (id: string) => {
    const group = groups.find(g => g.id === id);
    if (!window.confirm(t('groupForceDeleteConfirm') + (group?.name ? ` (${group.name})` : ''))) return;
    try {
      const res = await groupApi.adminDelete(id);
      if (res.success) {
        showToast(t('chatGroupDeleteSuccess'), 'success');
        if (selectedGroup?.id === id) setSelectedGroup(null);
        fetchGroups();
      } else {
        showToast(res.message || 'Failed to delete', 'error');
      }
    } catch {
      showToast(t('serverCommunicationError'), 'error');
    }
  };

  return (
    <div className="w-full h-[calc(100vh-105px)] animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-2xl border border-[var(--border)] shadow-sm">
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-[var(--bg-surface)] border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Shield size={16} className="text-[var(--primary)]" />
            <span>{t('adminGroups')}</span>
          </h2>
          <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-surface-2)] px-2 py-0.5 rounded-full">
            {groups.length} groups
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={fetchGroups}>
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
          <span className="text-xs text-red-700">{error}</span>
          <button
            onClick={fetchGroups}
            className="text-xs font-semibold text-red-700 underline hover:no-underline border-none bg-transparent cursor-pointer"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {/* Split view */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left - Groups table */}
        <div className={selectedGroup ? 'w-[55%] min-w-[400px] border-r border-[var(--border)]' : 'flex-1'}>
          <GroupsTable
            groups={groups}
            loading={loading}
            onSelectGroup={setSelectedGroup}
            onDeleteGroup={handleDeleteGroup}
            selectedGroupId={selectedGroup?.id || null}
          />
        </div>

        {/* Right - Group detail panel */}
        {selectedGroup && (
          <div className="flex-1 min-w-[350px] flex flex-col overflow-hidden">
            <GroupDetailPanel
              group={selectedGroup}
              onClose={() => setSelectedGroup(null)}
              onDelete={handleDeleteGroup}
              onRefresh={fetchGroups}
            />
          </div>
        )}
      </div>
    </div>
  );
}
