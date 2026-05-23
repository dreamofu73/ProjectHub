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
      .catch(() => setError(t('serverConnectionError') || '서버 연결 오류가 발생했습니다.'))
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
          <p className="text-danger font-semibold mb-4">{error || t('projectNotFound') || '프로젝트를 찾을 수 없습니다.'}</p>
          <Link to="/projects">
            <Button variant="secondary">{t('goToProjectList') || '프로젝트 목록으로 이동'}</Button>
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
          description={`식별자: ${project.identifier}`}
          className="mb-0 flex-1"
          actions={
            <div className="flex gap-2">
              {(isSysAdmin || project.my_role === 'manager') && !isArchived && (
                <Link to={`/projects/${project.identifier}/settings`}>
                  <Button variant="secondary">{t('settings') || '설정'}</Button>
                </Link>
              )}
              {(isSysAdmin || project.my_role === 'manager') && !isArchived && (
                <Link to={`/projects/${project.identifier}/members`}>
                  <Button variant="secondary" icon={Users}>{t('members') || '멤버'}</Button>
                </Link>
              )}
              <Link to={`/projects/${project.identifier}/wiki`}>
                <Button variant="secondary">{t('wiki') || '위키'}</Button>
              </Link>
              <Link to={`/projects/${project.identifier}/issues`}>
                <Button variant="secondary">{t('issueList') || '이슈 목록'}</Button>
              </Link>
              {!isArchived && (
                <Link to={`/projects/${project.identifier}/issues/new`}>
                  <Button icon={Plus}>{t('createNewIssue') || '새 이슈 생성'}</Button>
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
              <h2 className="text-lg font-bold mb-4 border-b border-border pb-2 text-gray-900">{t('projectOverview') || '프로젝트 개요'}</h2>
              <p className="text-secondary leading-relaxed whitespace-pre-wrap">
                {project.description || t('noProjectDescription') || '등록된 프로젝트 설명이 없습니다.'}
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
                      <h3 className="font-bold text-gray-900">{t('issueStatus') || '이슈 현황'}</h3>
                    </div>
                    <div className="text-3xl font-extrabold text-danger mb-1">
                      {project.open_issue_count} <span className="text-sm text-muted font-semibold">{t('inProgress') || '진행 중'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
                    <span className="text-xs text-muted font-medium">{t('total') || '전체'} {project.issue_count}{t('issues') || '개 이슈'}</span>
                    <div className="flex gap-3">
                      <Link to={`/projects/${id}/kanban`} className="text-sm font-bold text-primary hover:underline">
                         {t('kanbanBoard') || '칸반 보드'} &rarr;
                      </Link>
                      <Link to={`/projects/${id}/issues`} className="text-sm font-bold text-primary hover:underline">
                         {t('viewList') || '목록 보기'} &rarr;
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
                      <h3 className="font-bold text-gray-900">{t('participatingMembers') || '참여 멤버'}</h3>
                    </div>
                    <div className="text-3xl font-extrabold text-gray-900">
                      {project.member_count} <span className="text-sm text-muted font-semibold">{t('persons') || '명'}</span>
                    </div>
                  </div>
                  
                    <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
                     <span className="text-xs text-muted font-medium">{t('memberList') || '멤버 리스트'}</span>
                     {(isSysAdmin || project.my_role === 'manager') && !isArchived && (
                       <Link to={`/projects/${id}/members`} className="text-sm font-bold text-primary hover:underline">
                          {t('manageMembers') || '멤버 관리'} &rarr;
                       </Link>
                     )}
                   </div>
                </CardBody>
             </Card>
          </div>
        </div>

        <div className="flex flex-col gap-6">
           <Card>
              <CardBody className="p-6">
                <h2 className="text-lg font-bold mb-4 border-b border-border pb-2 text-gray-900">{t('projectInfo') || '프로젝트 정보'}</h2>
                <div className="flex flex-col gap-4">
                    <div>
                      <div className="text-sm font-bold text-foreground mb-1">{t('status') || '상태'}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant={project.status === 'active' ? 'success' : 'default'}>
                           {project.status === 'active' ? (t('active') || '활성 (Active)') : (t('archived') || '보관됨 (Archived)')}
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
                            {t('restoreProject') || '프로젝트 복원'}
                          </button>
                        )}
                      </div>
                   </div>
                    <div>
                      <div className="text-sm font-bold text-foreground mb-1">{t('homepage') || '홈페이지'}</div>
                      {project.homepage ? (
                        <a href={project.homepage} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline break-all flex items-center gap-1">
                          <Globe size={14} className="text-muted"/> {project.homepage}
                        </a>
                      ) : <span className="text-sm text-muted">-</span>}
                   </div>
                    <div>
                      <div className="text-sm font-bold text-foreground mb-1">{t('createdAt') || '생성일'}</div>
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
