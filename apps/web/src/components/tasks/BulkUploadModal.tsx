import { useState } from 'react';
import { X, Upload, Download } from 'lucide-react';
import { Button } from 'ui/Button';
import { useToast } from 'ui/Toast';
import { useLanguage } from '../../context/LanguageContext';
import type { Project } from 'shared/types';

interface BulkUploadModalProps {
  project: Project;
  onClose: () => void;
  onUploaded: () => void;
}

export function BulkUploadModal({ project, onClose, onUploaded }: BulkUploadModalProps) {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const downloadTemplate = () => {
    const headers = 'title,description,task_type,task_category,status,planned_start_date,planned_end_date,actual_start_date,actual_end_date,progress,assignee_login';
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task_template_${project.identifier}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('project_id', project.id.toString());
    formData.append('file', file);

    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        showToast(t('bulkUploadSuccess'), 'success');
        onUploaded();
        onClose();
      } else {
        showToast(json.error || t('bulkUploadError'), 'error');
      }
    } catch {
      showToast(t('serverConnectionError'), 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-surface)] p-6 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{t('bulkUpload')}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Button type="button" variant="secondary" icon={Download} onClick={downloadTemplate} fullWidth>
            {t('downloadTemplate')}
          </Button>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full" required />
          <Button type="submit" icon={Upload} disabled={isUploading || !file} fullWidth>
            {isUploading ? t('uploading') : t('upload')}
          </Button>
        </form>
      </div>
    </div>
  );
}
