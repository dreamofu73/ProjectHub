import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useToast } from 'ui/Toast';
import { groupApi } from 'shared/lib/api';
import { Button } from 'ui/Button';
import { Users, Shield, X, Trash2 } from 'lucide-react';
import type { Group, GroupMember, GroupResourceShare } from 'shared/types';

interface GroupDetailPanelProps {
  group: Group;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export function GroupDetailPanel({ group, onClose, onDelete, onRefresh: _onRefresh }: GroupDetailPanelProps) {
  const { t, formatDateTime } = useLanguage();
  const { showToast } = useToast();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [shares, setShares] = useState<GroupResourceShare[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingShares, setLoadingShares] = useState(true);
  const [activeSection, setActiveSection] = useState<'members' | 'shares'>('members');

  const fetchDetails = useCallback(async () => {
    setLoadingMembers(true);
    setLoadingShares(true);
    try {
      const [mRes, sRes] = await Promise.all([
        groupApi.listMembers(group.id),
        groupApi.listShares(group.id),
      ]);
      if (mRes.success) setMembers(mRes.data || []);
      if (sRes.success) setShares(sRes.data || []);
    } catch {
      showToast(t('serverCommunicationError'), 'error');
    } finally {
      setLoadingMembers(false);
      setLoadingShares(false);
    }
  }, [group.id, showToast, t]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
            group.is_shared ? 'bg-violet-100 text-violet-700' : 'bg-[var(--primary)]/10 text-[var(--primary)]'
          }`}>
            {group.is_shared ? <Shield size={18} /> : <Users size={18} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{group.name}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {group.owner_name ? `${t('groupOwner')}: ${group.owner_name}` : ''}
              {group.member_count > 0 ? ` · ${group.member_count} members` : ''}
              {group.description ? ` · ${group.description}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => onDelete(group.id)}>
            {t('groupForceDelete')}
          </Button>
          <Button size="sm" variant="ghost" icon={X} onClick={onClose} />
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-[var(--border)] shrink-0">
        <button
          onClick={() => setActiveSection('members')}
          className={`px-4 py-2.5 text-xs font-semibold transition-colors border-none bg-transparent cursor-pointer ${
            activeSection === 'members'
              ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          {t('groupMembers')} ({members.length})
        </button>
        <button
          onClick={() => setActiveSection('shares')}
          className={`px-4 py-2.5 text-xs font-semibold transition-colors border-none bg-transparent cursor-pointer ${
            activeSection === 'shares'
              ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          {t('groupShares')} ({shares.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeSection === 'members' && (
          <div className="divide-y divide-[var(--border)]">
            {loadingMembers ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--text-muted)]">{t('noMembers')}</p>
            ) : (
              members.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)] border border-[var(--border)]">
                    {m.login.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{m.login}</span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">({m.firstname} {m.lastname})</span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    m.role === 'owner' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    m.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    m.role === 'member' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    'bg-gray-50 text-gray-600 border-gray-200'
                  }`}>
                    {m.role}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeSection === 'shares' && (
          <div className="divide-y divide-[var(--border)]">
            {loadingShares ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin" />
              </div>
            ) : shares.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--text-muted)]">{t('groupNoGroups')}</p>
            ) : (
              shares.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Shield size={14} className="text-[var(--text-muted)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[var(--text-primary)]">{s.resource_type} #{s.resource_id}</span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">({s.permission_level})</span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">{formatDateTime(s.created_at)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
