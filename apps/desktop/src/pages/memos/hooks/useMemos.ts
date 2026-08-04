import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from 'shared/lib/api';
import { useToast } from 'ui/Toast';
import type { Memo, CustomFolder, FolderType } from 'shared/types';

import { useLanguage } from 'shared/hooks/LanguageContext';
export function useMemos(currentFolder: FolderType, currentUserId: string | null) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [customFolders, setCustomFolders] = useState<CustomFolder[]>([]);
  const [prevFolder, setPrevFolder] = useState<FolderType>(currentFolder);
  
  // Pagination state
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('limit') || '10');
  const [total, setTotal] = useState(0);

  const setPage = useCallback((newPage: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', String(newPage));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setPageSize = useCallback((newPageSize: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('limit', String(newPageSize));
      next.set('page', '1');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const fetchMemos = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = '/api/memos/received';
      let filter = 'all';

      if (currentFolder === 'sent') {
        endpoint = '/api/memos/sent';
      } else if (currentFolder === 'reserved') {
        endpoint = '/api/memos/sent/reserved';
      } else if (currentFolder === 'archived') {
        endpoint = '/api/memos/archived';
      } else if (currentFolder === 'spam') {
        endpoint = '/api/memos/spam';
      } else if (currentFolder === 'trash') {
        endpoint = '/api/memos/trash';
      } else if (currentFolder === 'self') {
        filter = 'self';
      } else if (currentFolder === 'personal') {
        filter = 'personal';
      } else if (currentFolder === 'group') {
        filter = 'group';
      } else if (currentFolder.startsWith('folder_')) {
        const folderId = currentFolder.replace('folder_', '');
        endpoint = `/api/memos/folders/${folderId}/memos`;
      }

      const res = await api(`${endpoint}?page=${page}&limit=${pageSize}&filter=${filter}`);
      const json = await res.json();
      
      if (json.success) {
        let fetchedData: Memo[] = json.data || [];
        let totalCount = json.total || 0;
        
        setMemos(fetchedData);
        setTotal(totalCount);
      } else {
        showToast(json.error || t('memoFetchError'), 'error');
      }
    } catch (err) {
      console.error('Failed to fetch memos:', err);
      showToast(t('networkError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [currentFolder, currentUserId, showToast, page, pageSize]);

  const fetchCustomFolders = useCallback(async () => {
    try {
      const res = await api('/api/memos/folders');
      const json = await res.json();
      if (json.success) {
        setCustomFolders(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load custom folders", err);
    }
  }, []);

  useEffect(() => {
    if (currentFolder !== prevFolder) {
      setPrevFolder(currentFolder);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (next.get('page') && next.get('page') !== '1') {
          next.set('page', '1');
        }
        return next;
      }, { replace: true });
    }
  }, [currentFolder, prevFolder, setSearchParams]);

  useEffect(() => {
    fetchMemos();
  }, [fetchMemos]);

  useEffect(() => {
    fetchCustomFolders();
  }, [fetchCustomFolders]);

  useEffect(() => {
    window.addEventListener('refresh_memos', fetchMemos);
    window.addEventListener('refresh_memo_folders', fetchCustomFolders);
    return () => {
      window.removeEventListener('refresh_memos', fetchMemos);
      window.removeEventListener('refresh_memo_folders', fetchCustomFolders);
    };
  }, [fetchMemos, fetchCustomFolders]);

  return {
    memos,
    setMemos,
    loading,
    customFolders,
    fetchMemos,
    fetchCustomFolders,
    page,
    setPage,
    pageSize,
    setPageSize,
    total
  };
}
