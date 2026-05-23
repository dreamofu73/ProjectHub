import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import WikiClient from '../../components/wiki/WikiClient';
import { Card, CardBody } from 'ui/Card';
import { useLanguage } from '../../context/LanguageContext';
import { api } from 'shared/lib/api';

import type { Project, WikiPage } from 'shared/types';

export default function ProjectWikiPage() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<{ project?: Project; wikiList: WikiPage[]; activePage: WikiPage | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const pageId = searchParams.get('id');

  useEffect(() => {
    async function fetchWiki() {
      setLoading(true);
      setError('');
      try {
        let project = undefined;
        // Fetch project info only if ID exists
        if (id) {
            const projectRes = await api(`/api/projects/${id}`);
            const projectJson = await projectRes.json();
            
            if (!projectJson.success) {
              setError(t('projectNotFound'));
              return;
            }
            project = projectJson.data;
        }

        // Fetch wiki list
        const url = id ? `/api/wiki?project_id=${project!.id}` : '/api/wiki';
        const wikiListRes = await api(url);
        const wikiListJson = await wikiListRes.json();
        const wikiList = wikiListJson.data || [];

        // Find active page from list
        let activePage = pageId && pageId !== 'new' ? wikiList.find((p: WikiPage) => p.id === pageId) || null : pageId === 'new' ? null : wikiList.find((p: WikiPage) => p.slug === 'home') || null;
        
        if (!activePage && !pageId && wikiList.length > 0) {
           activePage = wikiList[0];
        }

        setData({ project, wikiList, activePage });
      } catch {
        setError(t('failToLoadData'));
      } finally {
        setLoading(false);
      }
    }
    fetchWiki();
  }, [id, pageId, searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner text-primary" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-danger max-w-xl mx-auto mt-8">
        <CardBody className="text-center py-8">
          <p className="text-danger font-semibold mb-4">{error}</p>
          <Link to="/projects" className="btn btn-secondary">{t('goToProjectsList')}</Link>
        </CardBody>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col w-full bg-white dark:bg-slate-900 min-h-[calc(100vh-var(--header-height))]">
      <WikiClient 
        key={data.activePage?.id || 'new'}
        project={data.project}
        wikiList={data.wikiList}
        activePage={data.activePage}
        initialId={pageId}
        isArchived={data.project?.status === 'archived'}
      />
    </div>
  );
}
