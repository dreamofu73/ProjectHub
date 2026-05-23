import { useState, useEffect } from 'react';
import { Folder } from 'lucide-react';
import { apiJson, apiPut } from 'shared/lib/api';
import type { Project, ApiResponse } from 'shared/types';
import { useLanguage } from '../../context/LanguageContext';

export default function ProjectManagement() {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' ? '/api/projects' : `/api/projects?status=${statusFilter}`;
      const res = await apiJson<ApiResponse<Project[]>>(url);
      setProjects(res.data);
    } catch (err) {
      setError(t('fetchError') || '데이터를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [statusFilter]);

  const handleUpdateProject = async (id: string, updates: { is_public?: boolean; status?: string }) => {
    try {
      await apiPut<ApiResponse<Project>>(`/api/projects/${id}`, updates);
      await fetchProjects(); // Refresh list
    } catch (err) {
      alert(t('updateError') || '업데이트에 실패했습니다');
    }
  };

  if (loading) return <div className="p-6">{t('loading') || '로딩 중...'}</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Folder className="text-[var(--primary)]" />
        {t('projectManagement') || '프로젝트 관리'}
      </h2>
      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'archived')}
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded px-3 py-2"
        >
          <option value="all">{t('allProjects') || '모든 프로젝트'}</option>
          <option value="active">{t('activeProjectsOnly') || '활성 프로젝트만'}</option>
          <option value="archived">{t('archivedProjectsOnly') || '보관된 프로젝트만'}</option>
        </select>
      </div>
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-surface-2)] border-b border-[var(--border)]">
            <tr>
              <th className="px-4 py-3 text-left">{t('name') || '이름'}</th>
              <th className="px-4 py-3 text-left">{t('identifier') || '식별자'}</th>
              <th className="px-4 py-3 text-left">{t('public') || '공개'}</th>
              <th className="px-4 py-3 text-left">{t('status') || '상태'}</th>
              <th className="px-4 py-3 text-left">{t('actions') || '작업'}</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-[var(--border)]">
                <td className="px-4 py-3">{project.name}</td>
                <td className="px-4 py-3">{project.identifier}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleUpdateProject(project.id, { is_public: !project.is_public })}
                    className={`px-2 py-1 rounded text-xs font-bold ${project.is_public ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                  >
                    {project.is_public ? (t('public') || '공개') : (t('private') || '비공개')}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${project.status === 'active' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                    {project.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {project.status === 'archived' ? (
                    <button
                      onClick={() => handleUpdateProject(project.id, { status: 'active' })}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors border-none cursor-pointer"
                    >
                      {t('restore') || '복원'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpdateProject(project.id, { status: 'archived' })}
                      className="px-3 py-1.5 bg-amber-500/10 text-amber-600 text-xs font-bold rounded-lg hover:bg-amber-500/20 transition-colors border-none cursor-pointer"
                    >
                      {t('archive') || '보관'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
