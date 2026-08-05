import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  FolderKanban, Plus, Search, Globe, Lock, 
  Users, Bug, ArrowRight, LayoutGrid, List
} from 'lucide-react';
import { PageHeader } from '../PageHeader';
import { Card, CardBody } from '../Card';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Input, Select } from '../Input';
import { api } from 'shared/lib/api';
import { useLanguage } from 'shared/hooks/LanguageContext';
import { Pagination } from '../Pagination';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [membershipFilter, setMembershipFilter] = useState<'all' | 'mine'>(
    () => (searchParams.get('all') === 'true' ? 'all' : 'mine')
  );
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
        my_projects_only: String(membershipFilter === 'mine'),
        all: String(membershipFilter === 'all'),
        page: String(currentPage),
        limit: String(pageSize),
      }).toString();
      
      const res = await api(`/api/projects?${params}`);
      const json = await res.json();
      
      if (json.success) {
        setProjects(json.data);
        setTotalCount(json.total || 0);
      } else {
        setError(json.error || t('failToLoadProjects'));
      }
    } catch {
      setError(t('serverConnectionError'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, membershipFilter, searchTerm, currentPage, pageSize, t]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, membershipFilter, searchTerm]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isSysAdmin = currentUser?.role === 'admin';
  const pagedProjects = projects;

  return (
    <div className="flex flex-col gap-6">
      <div className="stagger-1">
        <PageHeader 
          title={t('projects')} 
          description={t('projectsPageDesc')}
          actions={
            isSysAdmin ? (
              <Link to="/projects/new">
                <Button icon={Plus}>{t('newProject')}</Button>
              </Link>
            ) : undefined
          }
        />
      </div>

      <div className="stagger-2 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-1 bg-[var(--bg-surface-2)]! p-1 rounded-lg" role="group" aria-label={t('viewMode')}>
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 rounded-md transition-all ${viewMode === 'card' ? 'bg-[var(--bg-surface)] shadow-sm text-primary' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            title={t('cardView')}
            aria-pressed={viewMode === 'card'}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-[var(--bg-surface)] shadow-sm text-primary' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            title={t('tableView')}
            aria-pressed={viewMode === 'table'}
          >
            <List size={18} />
          </button>
        </div>

        <Card className="w-full md:w-auto shadow-sm border-border/50">
          <CardBody className="p-1.5 flex flex-row gap-2 items-center">
            <form onSubmit={handleSearchSubmit} className="flex flex-wrap md:flex-nowrap items-center gap-2">
              <div className="w-44">
                <Select 
                  value={membershipFilter} 
                  onChange={(e) => {
                    const v = e.target.value as 'all' | 'mine';
                    setMembershipFilter(v);
                    const params = new URLSearchParams(searchParams);
                    if (v === 'all') params.set('all', 'true');
                    else {
                      params.delete('all');
                      params.delete('my_projects_only');
                    }
                    setSearchParams(params);
                  }}
                  options={[
                    { value: 'mine', label: t('myProjectsOnly') },
                    { value: 'all', label: t('allProjects') }
                  ]}
                  fullWidth
                  className="bg-[var(--bg-surface-2)]!"
                />
              </div>

              <div className="w-36">
                <Select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: 'active', label: t('active') },
                    { value: 'archived', label: t('archived') },
                    { value: 'all', label: t('all') }
                  ]}
                  fullWidth
                  className="bg-[var(--bg-surface-2)]!"
                />
              </div>

              <div className="w-64">
                <Input 
                  icon={Search}
                  placeholder={t('searchProjectsPlaceholder')} 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  fullWidth
                  className="bg-[var(--bg-surface-2)]! border-none"
                />
              </div>
              
              <Button type="submit" variant="primary" size="sm" className="shrink-0">{t('search')}</Button>
            </form>
          </CardBody>
        </Card>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map(n => (
            <div key={n} className="card animate-pulse h-48" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-danger">
          <CardBody className="text-center py-12">
            <p className="text-danger font-semibold">{error}</p>
            <Button variant="secondary" className="mt-4" onClick={fetchProjects}>{t('retry')}</Button>
          </CardBody>
        </Card>
      ) : projects.length === 0 ? (
        <Card className="stagger-3">
          <CardBody className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--primary-bg)] text-[var(--primary)] mb-5">
              <FolderKanban size={28} />
            </div>
            <p className="text-[var(--text-primary)] font-semibold text-lg">{t('noProjects')}</p>
            <p className="text-[var(--text-muted)] text-sm mt-1.5 max-w-sm mx-auto">{t('noProjectsDesc')}</p>
            {isSysAdmin && (
              <Link to="/projects/new">
                <Button icon={Plus} className="mt-6">{t('newProject')}</Button>
              </Link>
            )}
          </CardBody>
        </Card>
      ) : viewMode === 'card' ? (
        <div className="flex flex-col gap-4 stagger-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {pagedProjects.map((project) => (
              <Card key={project.id} className="group relative overflow-hidden border hover:shadow-lg transition-all duration-300 bg-[var(--bg-surface)]">
                {/* Header */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/projects/${project.identifier}/dashboard`} className="flex items-center gap-3 min-w-0 group/link">
                      <div className="p-2.5 bg-primary/10 rounded-xl text-primary flex-shrink-0 group-hover/link:scale-110 transition-transform">
                        <FolderKanban size={20} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-[var(--text-primary)] truncate group-hover/link:text-primary transition-colors">
                          {project.name}
                        </h3>
                        <span className="text-xs text-[var(--text-muted)] font-mono">{project.identifier}</span>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {project.is_public === 1 ? (
                        <Badge variant="info" icon={<Globe size={10} />}>{t('public')}</Badge>
                      ) : (
                        <Badge variant="default" icon={<Lock size={10} />}>{t('private')}</Badge>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed min-h-[2.5em]">
                    {project.description || t('noDescriptionRegistered')}
                  </p>
                </div>

                {/* Progress */}
                <div className="px-5 pb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('progress')}</span>
                    <span className="text-sm font-bold text-primary">{Math.round(((project.issue_count - project.open_issue_count) / (project.issue_count || 1)) * 100)}%</span>
                  </div>
                  <div className="progress-bar h-2 bg-[var(--border)] rounded-full overflow-hidden">
                    <div 
                      className="progress-fill h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.round(((project.issue_count - project.open_issue_count) / (project.issue_count || 1)) * 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Footer - clickable member/issue links */}
                <div className="border-t border-[var(--border)] bg-[var(--bg-surface-2)]/50! px-5 py-3 flex items-center justify-between">
                  <div className="flex gap-1">
                    <Link
                      to={`/projects/${project.identifier}/members`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      <Users size={13} />
                      {t('members')} <span className="text-[var(--text-muted)] font-normal">{project.member_count}</span>
                    </Link>
                    <Link
                      to={`/projects/${project.identifier}/issues`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-danger hover:bg-[var(--danger-bg)] transition-colors cursor-pointer"
                    >
                      <Bug size={13} />
                      {t('issues')} <span className="text-[var(--text-muted)] font-normal">{project.open_issue_count}</span>
                    </Link>
                  </div>
                  <Link to={`/projects/${project.identifier}/dashboard`} className="w-7 h-7 rounded-full bg-[var(--bg-surface)] border border-border flex items-center justify-center text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          {totalCount > 0 && (
            <div className="border-t border-border mt-4 pt-4">
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
        <Card className="overflow-hidden stagger-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-surface-2)]! border-b border-border">
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">{t('projects')}</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">{t('visibility')}</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">{t('progress')}</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">{t('members')}</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider">{t('issues')}</th>
                  <th className="py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wider text-right">{t('details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pagedProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-[var(--bg-surface-2)]/60! transition-colors group">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-bg rounded-lg text-primary flex-shrink-0">
                          <FolderKanban size={16} />
                        </div>
                        <div>
                          <Link to={`/projects/${project.identifier}/dashboard`} className="font-bold text-[var(--text-primary)] hover:text-primary transition-colors">
                            {project.name}
                          </Link>
                          <div className="text-sm text-muted truncate max-w-xs">
                            {project.description || t('noDescription')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {project.is_public === 1 ? (
                        <Badge variant="info" icon={<Globe size={10} />}>{t('public')}</Badge>
                      ) : (
                        <Badge variant="default" icon={<Lock size={10} />}>{t('private')}</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 w-48">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 progress-bar h-1.5 bg-[var(--border)]">
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
                      <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
                        <Users size={14} className="text-primary" /> {project.member_count}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
                        <Bug size={14} className="text-danger" /> {project.open_issue_count}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link to={`/projects/${project.identifier}/dashboard`}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity" icon={ArrowRight}>
                          {t('view')}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalCount > 0 && (
            <div className="border-t border-border pt-4">
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
