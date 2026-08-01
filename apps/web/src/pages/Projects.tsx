import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  FolderKanban, Plus, Search, Globe, Lock, 
  Users, Bug, ArrowRight, LayoutGrid, List
} from 'lucide-react';
import { PageHeader } from 'ui/PageHeader';
import { Card, CardBody } from 'ui/Card';
import { Badge } from 'ui/Badge';
import { Button } from 'ui/Button';
import { Input, Select } from 'ui/Input';
import { api } from 'shared/lib/api';
import { useLanguage } from '../context/LanguageContext';
import { Pagination } from 'ui/Pagination';

interface Project {
  id: string;
  identifier: string;
  name: string;
  description: string | null;
  homepage: string | null;
  is_public: number;
  status: 'active' | 'archived' | 'closed';
  member_count: number;
  issue_count: number;
  open_issue_count: number;
  my_role: 'manager' | 'developer' | 'reporter' | 'viewer' | null;
}

export default function ProjectsPage() {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        search: searchTerm,
        page: String(currentPage),
        limit: String(pageSize),
      }).toString();
      
      const res = await api(`/api/projects?${params}`);
      const json = await res.json();
      
      if (json.success) {
        setProjects(json.data);
        setTotalCount(json.total || 0);
      } else {
        setError(json.error || t('failToLoadProjects') || '프로젝트를 불러오는데 실패했습니다.');
      }
    } catch {
      setError(t('serverConnectionError') || '서버 연결 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm, currentPage, pageSize, t]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const pagedProjects = projects;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title={t('projects') || '프로젝트'} 
        description={t('projectsPageDesc') || '참여 중이거나 공개된 프로젝트 목록입니다.'}
        actions={
          <Link to="/projects/new">
            <Button icon={Plus}>{t('newProject') || '새 프로젝트 생성'}</Button>
          </Link>
        }
      />

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 rounded-md transition-all ${viewMode === 'card' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            title={t('cardView') || '카드 뷰'}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            title={t('tableView') || '테이블 뷰'}
          >
            <List size={18} />
          </button>
        </div>

        <Card className="w-full md:w-auto shadow-sm border-border/50">
          <CardBody className="p-1.5 flex flex-row gap-2 items-center">
            <form onSubmit={handleSearchSubmit} className="flex flex-wrap md:flex-nowrap items-center gap-2">
              <div className="w-40">
                <Select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: 'active', label: t('active') || '활성' },
                    { value: 'archived', label: t('archived') || '보관됨' },
                    { value: 'all', label: t('all') || '전체' }
                  ]}
                  fullWidth
                  className="bg-gray-50 dark:bg-slate-800"
                />
              </div>

              <div className="w-64">
                <Input 
                  icon={Search}
                  placeholder={t('searchProjectsPlaceholder') || '프로젝트명, 설명 또는 식별자 검색'} 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  fullWidth
                  className="bg-gray-50 dark:bg-slate-800 border-none"
                />
              </div>
              
              <Button type="submit" variant="primary" size="sm" className="shrink-0">{t('search') || '검색'}</Button>
            </form>
          </CardBody>
        </Card>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map(n => (
            <div key={n} className="card animate-pulse h-48 bg-white" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-danger">
          <CardBody className="text-center py-12">
            <p className="text-danger font-semibold">{error}</p>
            <Button variant="secondary" className="mt-4" onClick={fetchProjects}>{t('retry') || '다시 시도'}</Button>
          </CardBody>
        </Card>
      ) : projects.length === 0 ? (
        <Card>
          <CardBody className="text-center py-20 text-muted">
            <FolderKanban size={48} className="mx-auto mb-4 opacity-20" />
            <p>{t('noProjects') || '프로젝트가 존재하지 않습니다.'}</p>
          </CardBody>
        </Card>
      ) : viewMode === 'card' ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {pagedProjects.map((project) => (
              <Card key={project.id} className="group relative overflow-hidden border border-gray-200 dark:border-slate-700/60 hover:border-primary/50 hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900 rounded-xl">
                {/* Header */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/projects/${project.identifier}/dashboard`} className="flex items-center gap-3 min-w-0 group/link">
                      <div className="p-2.5 bg-primary/10 rounded-xl text-primary flex-shrink-0 group-hover/link:scale-110 transition-transform">
                        <FolderKanban size={20} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-gray-900 dark:text-slate-100 truncate group-hover/link:text-primary transition-colors">
                          {project.name}
                        </h3>
                        <span className="text-xs text-muted dark:text-slate-500 font-mono">{project.identifier}</span>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {project.is_public === 1 ? (
                        <Badge variant="info" icon={<Globe size={10} />}>{t('public') || '공개'}</Badge>
                      ) : (
                        <Badge variant="default" icon={<Lock size={10} />}>{t('private') || '비공개'}</Badge>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-secondary dark:text-slate-400 line-clamp-2 leading-relaxed min-h-[2.5em]">
                    {project.description || t('noDescriptionRegistered') || '프로젝트 설명이 등록되지 않았습니다.'}
                  </p>
                </div>

                {/* Progress */}
                <div className="px-5 pb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-muted dark:text-slate-500 uppercase tracking-wider">{t('progress') || '진행률'}</span>
                    <span className="text-sm font-bold text-primary">{Math.round(((project.issue_count - project.open_issue_count) / (project.issue_count || 1)) * 100)}%</span>
                  </div>
                  <div className="progress-bar h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="progress-fill h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.round(((project.issue_count - project.open_issue_count) / (project.issue_count || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Footer - clickable member/issue links */}
                <div className="border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 px-5 py-3 flex items-center justify-between">
                  <div className="flex gap-1">
                    <Link
                      to={`/projects/${project.identifier}/members`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      <Users size={13} />
                      {t('members') || '맴버'} <span className="text-gray-500 dark:text-slate-400 font-normal">{project.member_count}</span>
                    </Link>
                    <Link
                      to={`/projects/${project.identifier}/issues`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-danger hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                    >
                      <Bug size={13} />
                      {t('issues') || '이슈'} <span className="text-gray-500 dark:text-slate-400 font-normal">{project.open_issue_count}</span>
                    </Link>
                  </div>
                  <Link to={`/projects/${project.identifier}/dashboard`} className="w-7 h-7 rounded-full bg-white dark:bg-slate-900 border border-border flex items-center justify-center text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          {totalCount > 0 && (
            <div className="border-t border-border relative mt-6">
              <Pagination
                currentPage={currentPage}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                pageSizeOptions={[10, 20, 30, 50, 100]}
              />
            </div>
          )}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-border">
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">{t('projects') || '프로젝트'}</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">{t('visibility') || '공개 여부'}</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">{t('progress') || '진행률'}</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">{t('members') || '멤버'}</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">{t('issues') || '이슈'}</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider text-right">{t('details') || '상세'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagedProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-bg rounded-lg text-primary flex-shrink-0">
                          <FolderKanban size={16} />
                        </div>
                        <div>
                          <Link to={`/projects/${project.identifier}/dashboard`} className="font-bold text-gray-900 dark:text-slate-100 hover:text-primary transition-colors">
                            {project.name}
                          </Link>
                          <div className="text-sm text-muted truncate max-w-xs">
                            {project.description || t('noDescription') || '설명 없음'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {project.is_public === 1 ? (
                        <Badge variant="info" icon={<Globe size={10} />}>{t('public') || '공개'}</Badge>
                      ) : (
                        <Badge variant="default" icon={<Lock size={10} />}>{t('private') || '비공개'}</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 w-48">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 progress-bar h-1.5 bg-gray-200 dark:bg-slate-800">
                          <div 
                            className="progress-fill h-full bg-primary" 
                            style={{ width: `${Math.round(((project.issue_count - project.open_issue_count) / (project.issue_count || 1)) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-bold text-primary w-8 text-right">
                          {Math.round(((project.issue_count - project.open_issue_count) / (project.issue_count || 1)) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300">
                        <Users size={14} className="text-primary" /> {project.member_count}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300">
                        <Bug size={14} className="text-danger" /> {project.open_issue_count}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link to={`/projects/${project.identifier}/dashboard`}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" icon={ArrowRight}>
                          {t('view') || '보기'}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalCount > 0 && (
            <div className="border-t border-border relative">
              <Pagination
                currentPage={currentPage}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                pageSizeOptions={[10, 20, 30, 50, 100]}
              />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
