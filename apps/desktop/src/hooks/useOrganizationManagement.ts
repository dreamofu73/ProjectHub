import { useState, useEffect, useCallback } from 'react';
import { organizationApi } from 'shared/lib/api';
import { useLanguage } from '../context/LanguageContext';
import type { Department, DepartmentMember, OrganizationSettings } from 'shared/types/organization';

export function useOrganizationManagement() {
  const { formatDate, t } = useLanguage();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [currentDept, setCurrentDept] = useState<Partial<Department>>({});
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [members, setMembers] = useState<DepartmentMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ name: '', domain: '' });

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await organizationApi.listDepartments();
      if (res.success) {
        setDepartments(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrgSettings = useCallback(async () => {
    try {
      const res = await organizationApi.getSettings();
      if (res.success) {
        setOrgSettings(res.data);
        setSettingsForm({ name: res.data.name, domain: res.data.domain });
      }
    } catch (err) {
      console.error('Failed to fetch org settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
    fetchOrgSettings();
  }, [fetchDepartments, fetchOrgSettings]);

  const fetchMembers = useCallback(async (deptId: string) => {
    setMembersLoading(true);
    setMembers([]);
    try {
      const res = await organizationApi.getDepartmentMembers(deptId);
      if (res.success) {
        setMembers(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch department members:', err);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const handleCreate = async () => {
    if (!currentDept.name?.trim()) {
      setError(t('fillRequiredFields'));
      return;
    }
    try {
      const res = await organizationApi.createDepartment({
        name: currentDept.name.trim(),
        parent_id: currentDept.parent_id ?? undefined,
        description: currentDept.description || '',
      });
      if (res.success) {
        setFormMode(null);
        setCurrentDept({});
        fetchDepartments();
      } else {
        setError((res as any).error || t('createFailed'));
      }
    } catch (err) {
      setError(t('serverCommunicationError'));
    }
  };

  const handleUpdate = async () => {
    if (!currentDept.id) return;
    if (!currentDept.name?.trim()) {
      setError(t('fillRequiredFields'));
      return;
    }
    try {
      const res = await organizationApi.updateDepartment(currentDept.id, {
        name: currentDept.name.trim(),
        parent_id: currentDept.parent_id ?? undefined,
        description: currentDept.description || '',
      });
      if (res.success) {
        setFormMode(null);
        setCurrentDept({});
        fetchDepartments();
      } else {
        setError((res as any).error || t('updateFailed'));
      }
    } catch (err) {
      setError(t('serverCommunicationError'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('confirmDeleteDepartment'))) return;
    try {
      const res = await organizationApi.deleteDepartment(id);
      if (res.success) {
        fetchDepartments();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const res = await organizationApi.updateSettings(settingsForm);
      if (res.success) {
        setOrgSettings(res.data);
        setShowSettings(false);
      } else {
        setError((res as any).error || t('updateFailed'));
      }
    } catch (err) {
      setError(t('serverCommunicationError'));
    }
  };

  const openCreateModal = () => {
    setCurrentDept({ parent_id: null, description: '' });
    setFormMode('create');
    setError('');
  };

  const openCreateChild = (parentId: string) => {
    setCurrentDept({ parent_id: parentId, description: '' });
    setFormMode('create');
    setError('');
  };

  const openEditModal = (dept: Department) => {
    setCurrentDept({ ...dept });
    setFormMode('edit');
    setError('');
  };

  const openSettingsModal = () => {
    if (orgSettings) {
      setSettingsForm({ name: orgSettings.name, domain: orgSettings.domain });
    }
    setShowSettings(true);
    setError('');
  };

  const closeModal = () => {
    setFormMode(null);
    setCurrentDept({});
    setError('');
  };

  const closeSettings = () => {
    setShowSettings(false);
    setError('');
  };

  const filteredDepartments = departments.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalCount = filteredDepartments.length;
  const pagedDepartments = filteredDepartments.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return {
    departments,
    orgSettings,
    settingsForm,
    setSettingsForm,
    loading,
    searchTerm,
    setSearchTerm,
    formMode,
    showSettings,
    currentDept,
    setCurrentDept,
    error,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    members,
    membersLoading,
    fetchDepartments,
    fetchOrgSettings,
    fetchMembers,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleUpdateSettings,
    openCreateModal,
    openCreateChild,
    openEditModal,
    openSettingsModal,
    closeModal,
    closeSettings,
    totalCount,
    pagedDepartments,
    formatDate,
    t,
  };
}
