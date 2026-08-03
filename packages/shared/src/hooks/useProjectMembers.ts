import { useState, useCallback, useEffect } from 'react';
import { api } from 'shared/lib/api';

export interface Member {
  id: string;
  user_id: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
  role: 'manager' | 'developer' | 'reporter' | 'viewer' | 'lead' | 'overseer';
  created_at: string;
}

export interface UserData {
  id: string;
  login: string;
  email: string;
  firstname: string;
  lastname: string;
  role: 'admin' | 'user' | 'overseer';
  is_active: number;
  organization_id?: string | null;
  department_id?: string | null;
  organization_name?: string | null;
  department_name?: string | null;
  created_at: string;
}

export function useProjectMembers(projectId: string | undefined) {
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [projectName, setProjectName] = useState('');

  const fetchMembers = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await api(`/api/projects/${projectId}/members`);
      if (res.status === 403) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setMembers(json.data);
        setAuthorized(true);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api('/api/users');
      const json = await res.json();
      if (json.success) {
        setAllUsers(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    api(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) setProjectName(json.data.name);
      })
      .catch(() => {});
    fetchMembers();
    fetchUsers();
  }, [projectId, fetchMembers, fetchUsers]);

  return {
    members,
    allUsers,
    loading,
    authorized,
    projectName,
    fetchMembers,
  };
}
