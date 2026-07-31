import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { api } from 'shared/lib/api';

import type { Issue, Project, User } from 'shared/types';

function sortIssues(issues: Issue[], sortKey: string, sortOrder: 'asc' | 'desc') {
  return [...issues].sort((a, b) => {
    let aVal = a[sortKey as keyof Issue] as unknown as string | number | null | undefined;
    let bVal = b[sortKey as keyof Issue] as unknown as string | number | null | undefined;
    if (sortKey === 'assigned_name') { aVal = a.assigned_name || ''; bVal = b.assigned_name || ''; }
    else if (sortKey === 'project_name') { aVal = a.project_name || ''; bVal = b.project_name || ''; }
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;
    if (typeof aVal === 'string') {
      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal as string, undefined, { numeric: true, sensitivity: 'base' })
        : (bVal as string).localeCompare(aVal, undefined, { numeric: true, sensitivity: 'base' });
    }
    const aNum = aVal as number;
    const bNum = bVal as number;
    return sortOrder === 'asc' ? (aNum > bNum ? 1 : -1) : (bNum > aNum ? 1 : -1);
  });
}

export function useIssues() {
  const { t } = useLanguage();
  const { id: projectId } = useParams();

  const [searchParams, setSearchParams] = useSearchParams();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const [searchVal, setSearchVal] = useState(searchParams.get('search') || '');
  const [searchCategory, setSearchCategory] = useState<'all' | 'title' | 'content' | 'author'>('all');
  const statusVal = searchParams.get('status') || 'all';
  const trackerVal = searchParams.get('tracker') || 'all';
  const priorityVal = searchParams.get('priority') || 'all';
  const projectFilterVal = searchParams.get('project') || 'all';
  const assignedToVal = searchParams.get('assigned_to') || 'all';
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectMembers, setProjectMembers] = useState<{project_id: string, user_id: string}[]>([]);

  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '10');

  useEffect(() => {
    const timer = setTimeout(() => {
      const currentParam = searchParams.get('search') || '';
      if (searchVal !== currentParam) {
        const params = new URLSearchParams(searchParams);
        params.set('page', '1');
        if (searchVal) params.set('search', searchVal);
        else params.delete('search');
        setSearchParams(params);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [searchVal, setSearchParams, searchParams]);

  useEffect(() => {
    if (projectId) {
      api(`/api/projects/${projectId}`)
        .then(res => res.json())
        .then(json => { if (json.success) setProject(json.data); });
    } else {
      api('/api/projects')
        .then(res => res.json())
        .then(json => { if (json.success) setProjects(json.data); });
    }
    api('/api/users')
      .then(res => res.json())
      .then(json => { if (json.success) setUsers(json.data); });
      
    api('/api/projects/all/members')
      .then(res => res.json())
      .then(json => { if (json.success) setProjectMembers(json.data); });
  }, [projectId]);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams(searchParams);
      if (projectId) params.set('project', projectId);
      const res = await api(`/api/issues?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setIssues(json.data);
        setTotal(json.total);
      } else {
        setError(json.error || t('failToLoadIssues'));
      }
    } catch {
      setError(t('serverConnectionError'));
    } finally {
      setLoading(false);
    }
  }, [searchParams, projectId, t]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    if (value && value !== 'all') params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const sortedIssues = sortIssues(issues, searchParams.get('sort_by') || 'updated_at', (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc');
  const startIndex = (page - 1) * limit;
  const paginatedIssues = sortedIssues.slice(startIndex, startIndex + limit);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIssues(paginatedIssues.map(i => i.id));
    else setSelectedIssues([]);
  };

  const handleSelectIssue = (id: string) => {
    setSelectedIssues(prev => 
      prev.includes(id) ? prev.filter(iid => iid !== id) : [...prev, id]
    );
  };

  const handleBulkConvertToTask = async (projectId: string) => {
    if (selectedIssues.length === 0) return;
    if (!window.confirm(`선택한 ${selectedIssues.length}개의 이슈를 일감(Task)으로 일괄 등록하시겠습니까?`)) return;
    
    try {
      const issuesToConvert = issues.filter(i => selectedIssues.includes(i.id));
      let successCount = 0;
      
      for (const issue of issuesToConvert) {
        const res = await api('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            title: issue.subject,
            description: issue.description || '',
            status: 'todo',
            priority: issue.priority || 'normal',
            start_date: null,
            due_date: issue.due_date || null,
            parent_id: null,
          }),
        });
        if (res.ok) {
          successCount++;
          // 이슈 상태를 resolved로 변경 (옵션)
          await api(`/api/issues/${issue.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'resolved' }),
          });
        }
      }
      
      alert(`${successCount}개의 이슈가 일감으로 등록되었습니다.`);
      setSelectedIssues([]);
      fetchIssues();
    } catch (err) {
      console.error('Failed to convert issues to tasks:', err);
      alert('일부 이슈를 일감으로 변환하는 중 오류가 발생했습니다.');
    }
  };

  const handleBulkAction = async (type: 'status' | 'assignee' | 'due_date', value: string) => {
    if (selectedIssues.length === 0 || !value) return;
    if (!window.confirm(t('bulkUpdateConfirm').replace('{count}', selectedIssues.length.toString()))) return;
    try {
      const body: { ids: string[]; status?: string; assigned_to_id?: string | null; due_date?: string } = { ids: selectedIssues };
      if (type === 'status') body.status = value;
      if (type === 'assignee') body.assigned_to_id = value === 'unassigned' ? null : value;
      if (type === 'due_date') body.due_date = value;
      const res = await api('/api/issues/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) { setSelectedIssues([]); fetchIssues(); }
      else alert(json.error || t('bulkUpdateError'));
    } catch (err) {
      console.error('Bulk action failed:', err);
      alert(t('bulkUpdateError'));
    }
  };

  const handleSort = (key: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', '1');
    const currentSortKey = searchParams.get('sort_by') || 'updated_at';
    const currentSortOrder = searchParams.get('sort_order') || 'desc';
    if (currentSortKey === key) params.set('sort_order', currentSortOrder === 'asc' ? 'desc' : 'asc');
    else { params.set('sort_by', key); params.set('sort_order', 'asc'); }
    setSearchParams(params);
  };

  const handleResetFilters = () => {
    setSearchVal('');
    setSearchParams(new URLSearchParams());
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  const handlePageSizeChange = (newLimit: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('limit', newLimit.toString());
    params.set('page', '1');
    setSearchParams(params);
  };

  const trackerLabels: Record<string, string> = { bug: t('bug'), feature: t('feature'), task: t('task'), support: t('support'), enhancement: t('enhancement') };
  const statusLabels: Record<string, string> = { new: t('new'), in_progress: t('in_progress'), resolved: t('resolved'), feedback: t('feedback'), closed: t('closed'), rejected: t('rejected') };
  const priorityLabels: Record<string, string> = { low: t('low'), normal: t('normal'), high: t('high'), urgent: t('urgent'), immediate: t('immediate') };

  const sortKey = searchParams.get('sort_by') || 'updated_at';
  const sortOrder = (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc';

  const hasActiveFilters = statusVal !== 'all' || trackerVal !== 'all' || priorityVal !== 'all' || projectFilterVal !== 'all' || assignedToVal !== 'all' || searchVal !== '';

  return {
    issues,
    total,
    loading,
    error,
    project,
    projects,
    searchVal,
    setSearchVal,
    statusVal,
    trackerVal,
    priorityVal,
    projectFilterVal,
    assignedToVal,
    selectedIssues,
    setSelectedIssues,
    users,
    projectMembers,
    page,
    limit,
    paginatedIssues,
    fetchIssues,
    updateFilter,
    handleSelectAll,
    handleSelectIssue,
    handleBulkAction,
    handleBulkConvertToTask,
    handleSort,
    handleResetFilters,
    handlePageChange,
    handlePageSizeChange,
    trackerLabels,
    statusLabels,
    priorityLabels,
    hasActiveFilters,
    filterType: assignedToVal === 'me' ? 'me' as const : 'all' as const,
    setFilterType: (val: 'all' | 'me') => updateFilter('assigned_to', val),
    searchCategory,
    setSearchCategory,
    sortKey,
    sortOrder,
  };
}
