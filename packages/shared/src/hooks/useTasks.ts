import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from './LanguageContext';
import { api } from 'shared/lib/api';

import type { Task, Project } from 'shared/types';

export function useTasks() {
  const { t } = useLanguage();
  const { id: projectId } = useParams();

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

  // Optimistically apply a partial update locally, then persist it via PUT.
  // On failure the local list is reverted to its previous state.
  const updateTask = useCallback(async (taskId: string, patch: Partial<Task>): Promise<boolean> => {
    if (!projectId) return false;
    const previous = tasks;
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, ...patch } : task));
    try {
      const res = await api(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (json.success) return true;
      setTasks(previous);
      return false;
    } catch {
      setTasks(previous);
      return false;
    }
  }, [projectId, tasks]);

  // Apply the same partial update to multiple selected tasks via the bulk endpoint.
  const bulkUpdateTasks = useCallback(async (taskIds: string[], updates: Record<string, unknown>): Promise<boolean> => {
    if (!projectId || taskIds.length === 0) return false;
    try {
      const res = await api('/api/tasks/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: taskIds, ...updates }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchTasks();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [projectId, fetchTasks]);

  return {
    tasks,
    total,
    loading,
    error,
    project,
    fetchTasks,
    updateTask,
    bulkUpdateTasks,
  };
}
