import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { api } from 'shared/lib/api';

import type { Task, Project } from 'shared/types';

export function useTasks() {
  const { t } = useLanguage();
  const { id: projectId } = useParams();

  const [] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (projectId) {
      api(`/api/projects/${projectId}`)
        .then(res => res.json())
        .then(json => { if (json.success) setProject(json.data); });
    }
  }, [projectId]);

  const fetchTasks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api(`/api/tasks?project=${projectId}`);
      const json = await res.json();
      if (json.success) {
        setTasks(json.data);
        setTotal(json.data.length); // Assuming API returns all for now or needs pagination
      } else {
        setError(json.error || t('failToLoadTasks'));
      }
    } catch {
      setError(t('serverConnectionError'));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  return {
    tasks,
    total,
    loading,
    error,
    project,
    fetchTasks,
  };
}
