import { useState } from 'react';
import { FolderTree, Building2, Calendar, Edit2, Trash2, FileText, Users, UserCheck, UserX, Shield, Mail, Info } from 'lucide-react';
import type { Department, DepartmentMember } from 'shared/types/organization';

interface OrgDetailProps {
  department: Department | null;
  members: DepartmentMember[];
  membersLoading: boolean;
  onEdit: (dept: Department) => void;
  onDelete: (id: string) => void;
  formatDate: (date: string) => string;
  t: (key: string) => string;
}

export function OrgDetail({
  department,
  members,
  membersLoading,
  onEdit,
  onDelete,
  formatDate,
  t,
}: OrgDetailProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'members'>('basic');

  if (!department) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-4 select-none bg-[var(--bg-surface-2)]/20">
        <div className="w-16 h-16 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center shadow-inner border border-[var(--border)]">
          <Building2 size={24} className="text-[var(--text-muted)] opacity-60" />
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-[var(--text-secondary)]">{t('noDeptSelected') || '선택된 부서가 없습니다.'}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{t('selectDeptHint') || '목록에서 확인하려는 부서를 선택하세요.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full select-none overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)]">
      {/* 헤더 영역 */}
      <div className="relative shrink-0">
        <div className="h-24 bg-gradient-to-r from-[var(--primary)]/20 to-[var(--primary)]/5 border-b border-[var(--border)]" />
        <div className="px-6 pb-5">
          <div className="flex justify-between items-end -mt-10 mb-3">
            <div className="w-20 h-20 rounded-2xl bg-[var(--bg-surface)] p-1 shadow-sm border border-[var(--border)]">
              <div className="w-full h-full rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
                <FolderTree size={28} className="text-[var(--primary)]" />
              </div>
            </div>
            {/* 액션 버튼 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(department)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-bold transition-colors cursor-pointer"
              >
                <Edit2 size={12} />
                {t('edit') || '수정'}
              </button>
              <button
                onClick={() => onDelete(department.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-bold transition-colors cursor-pointer"
              >
                <Trash2 size={12} />
                {t('delete') || '삭제'}
              </button>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              {department.name}
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold">
                <Building2 size={10} /> {t('department') || '부서'}
              </span>
            </h2>
            <p className="text-sm text-[var(--text-muted)] font-medium mt-0.5">
              {department.member_count > 0
                ? `${t('memberCount') || '구성원'} ${department.member_count}${t('people') || '명'}`
                : t('noMembers') || '구성원 없음'}
            </p>
          </div>
        </div>
      </div>

      {/* ── 탭 ── */}
      <div className="flex gap-1 px-6 pt-3 pb-0 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/10">
        <button
          onClick={() => setActiveTab('basic')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-xs font-bold transition-all -mb-px ${
            activeTab === 'basic'
              ? 'text-[var(--primary)] bg-[var(--bg-surface)] border border-[var(--border)] border-b-[var(--bg-surface)]'
              : 'text-[var(--text-muted)] border border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]/60'
          }`}
        >
          <Info size={14} />
          기본 정보
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-xs font-bold transition-all -mb-px ${
            activeTab === 'members'
              ? 'text-[var(--primary)] bg-[var(--bg-surface)] border border-[var(--border)] border-b-[var(--bg-surface)]'
              : 'text-[var(--text-muted)] border border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-2)]/60'
          }`}
        >
          <Users size={14} />
          멤버
          {members.length > 0 && (
            <span className="text-xs font-bold bg-[var(--bg-surface-2)] px-1.5 py-0.5 rounded-full leading-none ml-0.5">
              {members.length}
            </span>
          )}
        </button>
      </div>

      {/* ── 탭 콘텐츠 ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
        {activeTab === 'basic' ? (
          /* 기본 정보 */
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--bg-surface-2)]/40 p-3.5 rounded-xl border border-[var(--border)] flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <FolderTree size={12} /> {t('parentDept') || '상위 부서'}
              </div>
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {department.parent_name || '-'}
              </span>
            </div>
            <div className="bg-[var(--bg-surface-2)]/40 p-3.5 rounded-xl border border-[var(--border)] flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <Building2 size={12} /> {t('members') || '구성원'}
              </div>
              <span className="text-xs font-bold text-[var(--text-primary)]">
                {department.member_count}{t('people') || '명'}
              </span>
            </div>
            <div className="bg-[var(--bg-surface-2)]/40 p-3.5 rounded-xl border border-[var(--border)] flex flex-col gap-1 col-span-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <FileText size={12} /> {t('description') || '설명'}
              </div>
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {department.description || '-'}
              </span>
            </div>
            <div className="bg-[var(--bg-surface-2)]/40 p-3.5 rounded-xl border border-[var(--border)] flex flex-col gap-1 col-span-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <Calendar size={12} /> {t('createdAt') || '등록일'}
              </div>
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {formatDate(department.created_at)}
              </span>
            </div>
          </div>
        ) : (
          /* ── 구성원 목록 ── */
          membersLoading ? (
            <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-xs gap-2">
              <div className="w-4 h-4 border-2 border-[var(--border-strong)] border-t-[var(--primary)] rounded-full animate-spin" />
              {t('loading') || '로딩 중...'}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--text-muted)] font-medium">
              {t('noDeptMembers') || '이 부서에 소속된 구성원이 없습니다.'}
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] overflow-hidden">
              {/* 헤더 */}
              <div className="flex items-center gap-3 px-4 py-2 bg-[var(--bg-surface-2)]/40 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <div className="flex-1 min-w-0">{t('name') || '이름'}</div>
                <div className="w-44 hidden sm:block">{t('email') || '이메일'}</div>
                <div className="w-20 text-center">{t('role') || '권한'}</div>
                <div className="w-16 text-center">{t('status') || '상태'}</div>
              </div>
              {/* 맴버 행 */}
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-surface-2)]/30 transition-colors text-xs"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[var(--primary)]">
                        {member.lastname?.[0] || member.login[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] truncate">
                        {member.lastname}{member.firstname}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        @{member.login}
                      </p>
                    </div>
                  </div>
                  <div className="w-44 hidden sm:flex items-center gap-1.5 text-[var(--text-muted)] truncate">
                    <Mail size={11} className="shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="w-20 text-center">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold ${
                      member.role === 'admin'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                        : member.role === 'manager'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'bg-[var(--bg-surface-2)] text-[var(--text-secondary)]'
                    }`}>
                      <Shield size={9} />
                      {member.role === 'admin'
                        ? (t('admin') || '관리자')
                        : member.role === 'manager'
                        ? (t('manager') || '매니저')
                        : (t('member') || '맴버')}
                    </span>
                  </div>
                  <div className="w-16 text-center">
                    {member.is_active ? (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-bold">
                        <UserCheck size={11} />
                        {t('active') || '활성'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-500 text-xs font-bold">
                        <UserX size={11} />
                        {t('inactive') || '비활성'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
