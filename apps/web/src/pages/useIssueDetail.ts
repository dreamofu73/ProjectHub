import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from 'ui/Toast';
import { api } from 'shared/lib/api';
import { uploadFilesWithProgress } from 'shared/lib/upload';
import { useLanguage } from '../context/LanguageContext';

import type { Issue, Comment, Member, Attachment } from 'shared/types';

interface IssueDetailData {
  issue: Issue;
  comments: Comment[];
}

export function useIssueDetail() {
  const { id: projectId, issueId } = useParams<{ id: string; issueId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [data, setData] = useState<IssueDetailData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingField, setIsUpdatingField] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isUpdatingIssue, setIsUpdatingIssue] = useState(false);

  // Comment attachment states
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchData();
    fetchMembers();
  }, [issueId]);

  const fetchData = async () => {
    try {
      const res = await api(`/api/issues/${issueId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setEditSubject(json.data.issue.subject);
        setEditDescription(json.data.issue.description || '');
      } else {
        setError(json.error || t('issueNotFound'));
      }
    } catch {
      setError(t('loginErrorConnection'));
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await api(`/api/projects/${projectId}/member-names`);
      const json = await res.json();
      if (json.success) setMembers(json.data);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  };

  const handleUpdateIssue = async (updates: Partial<Issue>) => {
    setIsUpdatingIssue(true);
    try {
      const res = await api(`/api/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        await fetchData();
        setIsEditMode(false);
        showToast(t('issueUpdatedSuccess'), 'success');
      }
    } catch {
      showToast(t('errOccurred'), 'error');
    } finally {
      setIsUpdatingIssue(false);
    }
  };

  const handleFieldUpdate = async (field: string, value: string | number | null) => {
    if (!data) return;
    setIsUpdatingField(field);
    try {
      const res = await api(`/api/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          [field]: value === '' ? (field === 'assigned_to_id' ? null : value) : value 
        })
      });
      if (res.ok) {
        await fetchData();
        showToast(t('infoUpdated'), 'success');
      } else {
        const json = await res.json();
        showToast(json.error || t('errOccurred'), 'error');
      }
    } catch {
      showToast(t('loginErrorConnection'), 'error');
    } finally {
      setIsUpdatingField(null);
    }
  };

  const handleDeleteIssue = async () => {
    try {
      const res = await api(`/api/issues/${issueId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(t('issueDeletedSuccess'), 'info');
        navigate(`/projects/${projectId}`);
      } else {
        showToast(t('errOccurred'), 'error');
      }
    } catch {
      showToast(t('loginErrorConnection'), 'error');
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !data) return;

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      let attachment_ids: string[] = [];
      
      // 1. Upload comment attachments first if any
      if (commentFiles.length > 0) {
        try {
          const uploadRes = await uploadFilesWithProgress<{
            success: boolean;
            data: { attachments: Attachment[] };
          }>(
            '/api/attachments',
            commentFiles,
            { issue_id: data.issue.id.toString() },
            setUploadProgress
          );
          
          if (uploadRes && uploadRes.success && uploadRes.data && uploadRes.data.attachments) {
            attachment_ids = uploadRes.data.attachments.map((a: Attachment) => a.id);
          }
        } catch (err) {
          console.error('Comment attachment upload failed:', err);
          showToast(t('uploadFail'), 'error');
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Create comment with attachment_ids
      const res = await api('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          issue_id: data.issue.id, 
          content: newComment,
          attachment_ids
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setNewComment('');
        setCommentFiles([]);
        setUploadProgress(0);
        fetchData();
        showToast(t('commentCreated'), 'success');
      } else {
        showToast(json.error || t('errOccurred'), 'error');
      }
    } catch (error) {
      console.error('Comment submission error:', error);
      showToast(t('errOccurred'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    projectId,
    issueId,
    data,
    members,
    loading,
    error,
    newComment,
    setNewComment,
    isSubmitting,
    isUpdatingField,
    showDeleteConfirm,
    setShowDeleteConfirm,
    isEditMode,
    setIsEditMode,
    editSubject,
    setEditSubject,
    editDescription,
    setEditDescription,
    isUpdatingIssue,
    commentFiles,
    setCommentFiles,
    uploadProgress,
    handleUpdateIssue,
    handleFieldUpdate,
    handleDeleteIssue,
    handleCommentSubmit,
  };
}
