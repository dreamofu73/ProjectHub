import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Paperclip, X } from 'lucide-react';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';
import { Input, Select } from 'ui/Input';
import { PageHeader } from 'ui/PageHeader';
import { useToast } from 'ui/Toast';
import { api } from 'shared/lib/api';

import { useLanguage } from 'shared/hooks/LanguageContext';
interface Project {
  id: string;
  identifier: string;
  name: string;
}

interface Attachment {
  id: string;
  filename: string;
}

export default function NewIssue() {
  const { t } = useLanguage();
  const { id: projectId } = useParams<{ id: string }>(); // project identifier
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [tracker, setTracker] = useState('bug');
  const [status, setStatus] = useState('new');
  const [priority, setPriority] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Attachment states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    api(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) setProject(json.data);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        
        const uploadUrl = window.location.port === '5173' ? 'http://localhost:8000/api/attachments' : '/api/attachments';
        const res = await api(uploadUrl, {
          method: 'POST',
          body: formData,
        });
        
        if (!res.ok) {
          if (res.status === 413) {
            showToast(t('fileTooLarge'), 'error');
          } else {
            showToast(t('fileUploadFailedCode').replace('{code}', String(res.status)), 'error');
          }
          continue;
        }
        
        const json = await res.json();
        if (json.success) {
          setAttachments(prev => [...prev, json.data]);
        }
      }
      showToast(t('fileUploaded'), 'success');
    } catch (err) {
      console.error('File upload failed:', err);
      showToast(t('chatUploadError'), 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    
    setIsSubmitting(true);
    setError('');

    try {
      const res = await api('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          subject,
          description,
          tracker,
          status,
          priority,
          attachment_ids: attachments.map(a => a.id)
        }),
      });

      const json = await res.json();
      if (res.ok) {
        showToast(t('issueCreatedSuccess'), 'success');
        navigate(`/projects/${projectId}/issues`);
      } else {
        showToast(json.error || t('issueCreateError'), 'error');
      }
    } catch {
      showToast(t('serverCommError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner text-primary" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
      </div>
    );
  }

  if (!project) {
    return (
      <Card className="border-danger max-w-xl mx-auto mt-8">
        <CardBody className="text-center py-8">
          <p className="text-danger font-semibold mb-4">{t('projectNotFound')}</p>
          <Link to="/projects">
            <Button variant="secondary">{t('goToProjectsList')}</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to={`/projects/${projectId}/dashboard`} className="btn btn-secondary btn-icon rounded-full">
           <ArrowLeft size={16}/>
        </Link>
        <PageHeader 
          title={t('createNewIssue')} 
          description={t('newIssueForProjectDesc').replace('{name}', project.name)}
          className="mb-0 flex-1"
        />
      </div>

      <Card>
        <CardBody className="p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {error && (
              <div className="bg-danger-bg text-danger text-sm font-medium p-4 rounded-lg border border-danger/20 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-danger"></span>
                {error}
              </div>
            )}
            
            <Input
              label={t('title')}
              placeholder={t('enterIssueTitle')}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              disabled={isSubmitting}
              fullWidth
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Select
                label={t('tracker')}
                value={tracker}
                onChange={(e) => setTracker(e.target.value)}
                disabled={isSubmitting}
                fullWidth
                options={[
                  { value: 'bug', label: t('bugLabel') },
                  { value: 'feature', label: t('featureLabel') },
                  { value: 'task', label: t('taskLabel') },
                  { value: 'support', label: t('supportLabel') },
                  { value: 'enhancement', label: t('enhancementLabel') }
                ]}
              />

              <Select
                label={t('status')}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={isSubmitting}
                fullWidth
                options={[
                  { value: 'new', label: t('newTracker') },
                  { value: 'in_progress', label: t('inProgressTracker') },
                  { value: 'resolved', label: t('resolvedTracker') },
                  { value: 'feedback', label: t('feedbackTracker') }
                ]}
              />

              <Select
                label={t('priority')}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={isSubmitting}
                fullWidth
                options={[
                  { value: 'low', label: t('lowLabel') },
                  { value: 'normal', label: t('normalLabel') },
                  { value: 'high', label: t('highLabel') },
                  { value: 'urgent', label: t('urgentLabel') }
                ]}
              />
            </div>

            <div>
              <label className="form-label">{t('description')}</label>
              <textarea
                className="form-control min-h-[180px] resize-y"
                placeholder={t('issueDescPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="pt-2">
              <label className="form-label mb-2 flex items-center justify-between">
                <span>{t('attachFile')}</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm" 
                  icon={Paperclip}
                  onClick={() => fileInputRef.current?.click()}
                  isLoading={isUploading}
                >
                  {t('logsSelectFile')}
                </Button>
              </label>
              
              <div className="flex flex-col gap-2 mt-2">
                {attachments.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-border group hover:bg-gray-100 transition-all">
                    <div className="flex items-center gap-2">
                      <Paperclip size={14} className="text-muted" />
                      <span className="text-sm font-medium text-gray-700">{file.filename}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(file.id)}
                      className="text-muted hover:text-danger p-1 rounded-md hover:bg-danger-bg transition-all border-none bg-transparent cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                {attachments.length === 0 && !isUploading && (
                  <div className="text-xs text-muted text-center py-4 border-2 border-dashed border-gray-100 rounded-xl">
                    {t('noAttachedFiles')}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
               <Button
                 type="button"
                 variant="secondary"
                 onClick={() => navigate(-1)}
                 disabled={isSubmitting}
               >
                 {t('cancel')}
               </Button>
               <Button
                 type="submit"
                 isLoading={isSubmitting}
                 disabled={isSubmitting || !subject}
                 icon={Save}
               >
                 {t('createAction')}
               </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
