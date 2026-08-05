import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, Bug, Globe, Calendar, Plus } from 'lucide-react';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';
import { Badge } from 'ui/Badge';
import { PageHeader } from 'ui/PageHeader';
import { useLanguage } from '../context/LanguageContext';
import { api } from 'shared/lib/api';


interface ProjectDetailData {
  id: string;
  identifier: string;
  name: string;
  description: string | null;
  homepage: string | null;
  status: string;
  created_at: string;
  member_count: number;
  issue_count: number;
  open_issue_count: number;
  my_role: string | null;
}

export default function ProjectDetail() {
  const { t, formatDate } = useLanguage();
  const { id } = useParams();
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isSysAdmin = currentUser?.role === 'admin';
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const isArchived = project?.status === 'archived';

  const [error, setError] = useState('');

  useEffect(() => {
    api(`/api/projects/${id}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) setProject(json.data);
        else setError(json.error);
      })
      .catch(() => setError(t('serverConnectionError')))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner text-primary" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <Card className="border-danger max-w-xl mx-auto mt-8">
        <CardBody className="text-center py-8">
          <p className="text-danger font-semibold mb-4">{error || t('projectNotFound')}</p>
          <Link to="/projects">
            <Button variant="secondary">{t('goToProjectList')}</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <PageHeader 
          title={project.name} 
          description={t('identifierPrefix').replace('{id}', project.identifier)}
          className="mb-0 flex-1"
          actions={
            <div className="flex gap-2">
              {(isSysAdmin || project.my_role === 'manager') && !isArchived && (
                <Link to={`/projects/${project.identifier}/settings`}>
                  <Button variant="secondary">{t('settings')}</Button>
                </Link>
              )}
              <Link to={`/projects/${project.identifier}/members`}>
                <Button variant="secondary" icon={Users}>{t('members')}</Button>
              </Link>
              <Link to={`/projects/${project.identifier}/wiki`}>
                <Button variant="secondary">{t('wiki')}</Button>
              </Link>
              <Link to={`/projects/${project.identifier}/issues`}>
                <Button variant="secondary">{t('issueList')}</Button>
              </Link>
              {!isArchived && (
                <Link to={`/projects/${project.identifier}/issues/new`}>
                  <Button icon={Plus}>{t('createNewIssue')}</Button>
                </Link>
              )}
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Description */}
          <Card>
            <CardBody className="p-6">
              <h2 className="text-lg font-bold mb-4 border-b border-border pb-2 text-gray-900">{t('projectOverview')}</h2>
              <p className="text-secondary leading-relaxed whitespace-pre-wrap">
                {project.description || t('noProjectDescription')}
              </p>
            </CardBody>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card className="hover:shadow-md transition-all">
                <CardBody className="p-6 flex flex-col justify-between h-full min-h-[160px]">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 bg-danger-bg text-danger rounded-xl flex-shrink-0">
                        <Bug size={20}/>
                      </div>
                      <h3 className="font-bold text-gray-900">{t('issueStatus')}</h3>
                    </div>
                    <div className="text-3xl font-extrabold text-danger mb-1">
                      {project.open_issue_count} <span className="text-sm text-muted font-semibold">{t('inProgress')}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
                    <span className="text-xs text-muted font-medium">{t('total')} {project.issue_count}{t('issues')}</span>
                    <div className="flex gap-3">
                      <Link to={`/projects/${id}/kanban`} className="text-sm font-bold text-primary hover:underline">
                         {t('kanbanBoard')} &rarr;
                      </Link>
                      <Link to={`/projects/${id}/issues`} className="text-sm font-bold text-primary hover:underline">
                         {t('viewList')} &rarr;
                      </Link>
                    </div>
                  </div>
                </CardBody>
             </Card>

             <Card className="hover:shadow-md transition-all">
                <CardBody className="p-6 flex flex-col justify-between h-full min-h-[160px]">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 bg-primary-bg text-primary rounded-xl flex-shrink-0">
                        <Users size={20}/>
                      </div>
                      <h3 className="font-bold text-gray-900">{t('participatingMembers')}</h3>
                    </div>
                    <div className="text-3xl font-extrabold text-gray-900">
                      {project.member_count} <span className="text-sm text-muted font-semibold">{t('persons')}</span>
                    </div>
                  </div>
                  
                    <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
                     <span className="text-xs text-muted font-medium">{t('memberList')}</span>
                     <Link to={`/projects/${id}/members`} className="text-sm font-bold text-primary hover:underline">
                        {t('memberList')} &rarr;
                     </Link>
                   </div>
                </CardBody>
             </Card>
          </div>
        </div>

        <div className="flex flex-col gap-6">
           <Card>
              <CardBody className="p-6">
                <h2 className="text-lg font-bold mb-4 border-b border-border pb-2 text-gray-900">{t('projectInfo')}</h2>
                <div className="flex flex-col gap-4">
                    <div>
                      <div className="text-sm font-bold text-foreground mb-1">{t('status')}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant={project.status === 'active' ? 'success' : 'default'}>
                           {project.status === 'active' ? t('active') : t('archived')}
                        </Badge>
                        {isArchived && (isSysAdmin || project.my_role === 'manager') && (
                          <button
                            onClick={async () => {
                              try {
                                await api(`/api/projects/${project.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'active' }),
                                });
                                window.location.reload();
                              } catch {}
                            }}
                            className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors border-none cursor-pointer"
                          >
                            {t('restoreProject')}
                          </button>
                        )}
                      </div>
                   </div>
                    <div>
                      <div className="text-sm font-bold text-foreground mb-1">{t('homepage')}</div>
                      {project.homepage ? (
                        <a href={project.homepage} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline break-all flex items-center gap-1">
                          <Globe size={14} className="text-muted"/> {project.homepage}
                        </a>
                      ) : <span className="text-sm text-muted">-</span>}
                   </div>
                    <div>
                      <div className="text-sm font-bold text-foreground mb-1">{t('createdAt')}</div>
                      <div className="text-sm text-secondary flex items-center gap-1.5">
                         <Calendar size={14} className="text-muted"/>
                         {formatDate(project.created_at, {
                           year: 'numeric',
                           month: 'long',
                           day: 'numeric'
                         })}
                      </div>
                   </div>
                </div>
              </CardBody>
            </Card>
        </div>
      </div>
    </div>
  );
}
