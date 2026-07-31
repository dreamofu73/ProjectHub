import { useState, useEffect, useCallback } from 'react';
import { api } from 'shared/lib/api';

import type { Milestone } from 'shared/types';

export interface MilestoneInput {
  name: string;
  due_date: string;
  description?: string;
  status?: string;
}

/** 프로젝트의 마일스톤 목록을 불러오고 생성/삭제한다. */
export function useMilestones(projectId: string | undefined) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMilestones = useCallback(async () => {
    if (!projectId) {
      setMilestones([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api(`/api/milestones?project_id=${projectId}`);
      const json = await res.json();
      setMilestones(json.success && Array.isArray(json.data) ? json.data : []);
    } catch {
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchMilestones(); }, [fetchMilestones]);

  const createMilestone = useCallback(async (input: MilestoneInput): Promise<boolean> => {
    if (!projectId) return false;
    try {
      const res = await api('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, status: 'open', ...input }),
      });
      const json = await res.json();
      if (!json.success) return false;
      await fetchMilestones();
      return true;
    } catch {
      return false;
    }
  }, [projectId, fetchMilestones]);

  const deleteMilestone = useCallback(async (milestoneId: string): Promise<boolean> => {
    try {
      const res = await api(`/api/milestones/${milestoneId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) return false;
      await fetchMilestones();
      return true;
    } catch {
      return false;
    }
  }, [fetchMilestones]);

  return { milestones, loading, fetchMilestones, createMilestone, deleteMilestone };
}
