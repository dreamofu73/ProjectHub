import { useState, useEffect, useCallback } from 'react';
import { api } from 'shared/lib/api';
import { useLanguage } from '../context/LanguageContext';
import type { UserData, Department } from 'shared/types/user';

export function useUsersManagement() {
  const { formatDate, t } = useLanguage();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState<'create' | 'edit' | 'password' | null>(null);
  const [currentUser, setCurrentUser] = useState<Partial<UserData>>({});
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organizationName, setOrganizationName] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/api/users');
      const json = await res.json();
      if (json.success) {
        setUsers(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api('/api/admin/organization/departments');
      const json = await res.json();
      if (json.success) setDepartments(json.data);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  }, []);

  const fetchOrganization = useCallback(async () => {
    try {
      const res = await api('/api/admin/organization/settings');
      const json = await res.json();
      if (json.success) setOrganizationName(json.data.name);
    } catch (err) {
      console.error('Failed to fetch organization:', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchDepartments();
    fetchOrganization();
  }, [fetchDepartments, fetchOrganization]);

  useEffect(() => {
    if (showModal === 'edit' || showModal === 'create') {
      fetchDepartments(); // refresh when modal opens
    }
  }, [showModal, fetchDepartments]);

  const handleBatchChangeDepartment = async (userIds: string[], departmentId: string | null) => {
    try {
      const res = await api('/api/users/bulk/department', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: userIds, department_id: departmentId })
      });
      const json = await res.json();
      if (json.success) {
        return json.data.updated_count as number;
      }
      return 0;
    } catch (err) {
      console.error('Bulk department update failed:', err);
      return 0;
    }
  };

  const handleCreate = async () => {
    if (!currentUser.login || !currentUser.email || !password) {
      setError(t('fillRequiredFields') || '필수 항목을 모두 입력하세요.');
      return;
    }
    
    try {
      const res = await api('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentUser, password })
      });
      const json = await res.json();
      if (json.success) {
        setShowModal(null);
        setCurrentUser({});
        setPassword('');
        fetchUsers();
      } else {
        setError(json.error || t('userCreateFailed') || '사용자 생성 실패');
      }
    } catch (err) {
      setError(t('serverCommunicationError') || '서버 통신 오류');
    }
  };

  const handleUpdate = async () => {
    if (!currentUser.id) return;
    try {
      const res = await api(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentUser)
      });
      const json = await res.json();
      if (json.success) {
        setShowModal(null);
        setCurrentUser({});
        fetchUsers();
      } else {
        setError(json.error || t('userUpdateFailed') || '사용자 정보 수정 실패');
      }
    } catch (err) {
      setError(t('serverCommunicationError') || '서버 통신 오류');
    }
  };

  const handleResetPassword = async () => {
    if (!currentUser.id || !password) return;
    try {
      const res = await api(`/api/users/${currentUser.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const json = await res.json();
      if (json.success) {
        setShowModal(null);
        setPassword('');
        setCurrentUser({});
        alert(t('passwordResetSuccess') || '비밀번호가 초기화되었습니다.');
      } else {
        setError(json.error || t('passwordResetFailed') || '비밀번호 초기화 실패');
      }
    } catch (err) {
      setError(t('serverCommunicationError') || '서버 통신 오류');
    }
  };

  const handleDelete = async (id: string) => {
    if (id === '1') {
      alert(t('cannotDeleteAdmin') || '시스템 관리자 계정은 삭제할 수 없습니다.');
      return;
    }
    if (!window.confirm(t('confirmDeleteUser') || '이 사용자를 삭제하시겠습니까?')) return;
    try {
      const res = await api(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUsers();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const openCreateModal = () => {
    setCurrentUser({ role: 'user', is_active: 1 });
    setShowModal('create');
    setShowPassword(false);
    setPassword('');
    setError('');
  };

  const openEditModal = (user: UserData) => {
    setCurrentUser({
      ...user,
      organization_id: user.organization_id,
      department_id: user.department_id,
    });
    setShowModal('edit');
    setError('');
  };

  const openPasswordModal = (user: UserData) => {
    setCurrentUser(user);
    setShowModal('password');
    setShowPassword(false);
    setPassword('');
    setError('');
  };

  const closeModal = () => {
    setShowModal(null);
    setCurrentUser({});
    setPassword('');
    setError('');
  };

  const filteredUsers = users.filter(u => 
    u.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${u.firstname} ${u.lastname}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalCount = filteredUsers.length;
  const pagedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return {
    users,
    loading,
    searchTerm,
    setSearchTerm,
    showModal,
    currentUser,
    setCurrentUser,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    error,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    fetchUsers,
    handleCreate,
    handleBatchChangeDepartment,
    handleUpdate,
    handleResetPassword,
    handleDelete,
    openCreateModal,
    openEditModal,
    openPasswordModal,
    closeModal,
    totalCount,
    pagedUsers,
    formatDate,
    t,
    departments,
    organizationName,
  };
}
