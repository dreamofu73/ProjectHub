import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';
import { Input } from 'ui/Input';
import { PageHeader } from 'ui/PageHeader';
import { api } from 'shared/lib/api';
import { useLanguage } from '../../context/LanguageContext';

const FIELD_TYPE_KEYS: Record<string, string> = {
  integer: 'fieldTypeInteger',
  float: 'fieldTypeFloat',
  string: 'fieldTypeString',
  text: 'fieldTypeText',
  date: 'fieldTypeDate',
  time: 'fieldTypeTime',
  boolean: 'fieldTypeBoolean',
};

export default function ProjectSettings() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [taskTypes, setTaskTypes] = useState('');
  const [issueTypes, setIssueTypes] = useState('');
  const [statuses, setStatuses] = useState('');
  const [taskCategories, setTaskCategories] = useState('');
  const [taskStatuses, setTaskStatuses] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('string');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldSortOrder, setNewFieldSortOrder] = useState(0);
  const [isAddingField, setIsAddingField] = useState(false);

  useEffect(() => {
    // Fetch project settings
    api(`/api/projects/${id}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setTaskTypes(json.data.task_types || '');
          setIssueTypes(json.data.issue_types || '');
          setStatuses(json.data.statuses || '');
          setTaskCategories(json.data.task_categories || '');
          setTaskStatuses(json.data.task_statuses || '');
        }
      });
  }, [id]);

  useEffect(() => {
    api(`/api/projects/${id}/custom-fields`)
      .then(res => res.json())
      .then(json => { if (json.success) setCustomFields(json.data || []); });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_types: taskTypes,
          issue_types: issueTypes,
          statuses: statuses,
          task_categories: taskCategories,
          task_statuses: taskStatuses,
        }),
      });
      navigate(`/projects/${id}/dashboard`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddField = async () => {
    if (!newFieldName.trim()) return;
    setIsAddingField(true);
    try {
      await api(`/api/projects/${id}/custom-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_name: newFieldName.trim(),
          field_type: newFieldType,
          is_required: newFieldRequired ? 1 : 0,
          sort_order: newFieldSortOrder,
        }),
      });
      setNewFieldName('');
      setNewFieldType('string');
      setNewFieldRequired(false);
      setNewFieldSortOrder(0);
      const listRes = await api(`/api/projects/${id}/custom-fields`);
      const listJson = await listRes.json();
      if (listJson.success) setCustomFields(listJson.data || []);
    } catch (e) { console.error(e); }
    setIsAddingField(false);
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm(t('deleteFieldConfirm'))) return;
    try {
      await api(`/api/projects/${id}/custom-fields/${fieldId}`, { method: 'DELETE' });
      setCustomFields(prev => prev.filter(f => f.id !== fieldId));
    } catch (e) { console.error(e); }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <PageHeader title={t('projectSettingsTitle')} />
      <Card>
        <CardBody className="p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <Input
              label={t('taskTypesLabel')}
              value={taskTypes}
              onChange={(e) => setTaskTypes(e.target.value)}
              fullWidth
            />
            <Input
              label={t('issueTypesLabel')}
              value={issueTypes}
              onChange={(e) => setIssueTypes(e.target.value)}
              fullWidth
            />
             <Input
              label={t('statusesLabel')}
              value={statuses}
              onChange={(e) => setStatuses(e.target.value)}
              fullWidth
            />
            <Input
              label={t('taskCategoriesLabel')}
              value={taskCategories}
              onChange={(e) => setTaskCategories(e.target.value)}
              fullWidth
            />
            <Input
              label={t('taskStatusesLabel')}
              value={taskStatuses}
              onChange={(e) => setTaskStatuses(e.target.value)}
              fullWidth
            />
            <Button type="submit" isLoading={isSubmitting}>{t('save')}</Button>

          </form>

          <hr className="border-[var(--border)]" />
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('customFieldsTitle')}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('customFieldsDesc')}</p>
            </div>

            {customFields.length > 0 && (
              <div className="flex flex-col gap-2">
                {customFields.map(field => (
                  <div key={field.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{field.field_name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface-2)] text-[var(--text-muted)] font-semibold">
                        {FIELD_TYPE_KEYS[field.field_type] ? t(FIELD_TYPE_KEYS[field.field_type]) : field.field_type}
                      </span>
                      {field.is_required ? <span className="text-[10px] text-red-500 font-bold">{t('requiredLabel')}</span> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteField(field.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer bg-transparent border-none"
                    >{t('delete')}</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-dashed border-[var(--border)]">
              <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{t('fieldNameLabel')}</label>
                <input
                  type="text"
                  className="form-control text-xs"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder={t('fieldNamePlaceholder')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{t('fieldTypeLabel')}</label>
                <select
                  className="form-control text-xs"
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                >
                  <option value="integer">{t('fieldTypeInteger')}</option>
                  <option value="float">{t('fieldTypeFloat')}</option>
                  <option value="string">{t('fieldTypeString')}</option>
                  <option value="text">{t('fieldTypeText')}</option>
                  <option value="date">{t('fieldTypeDate')}</option>
                  <option value="time">{t('fieldTypeTime')}</option>
                  <option value="boolean">{t('fieldTypeBoolean')}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{t('sortOrderLabel')}</label>
                <input
                  type="number"
                  className="form-control text-xs w-16"
                  value={newFieldSortOrder}
                  onChange={(e) => setNewFieldSortOrder(Number(e.target.value) || 0)}
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newFieldRequired}
                  onChange={(e) => setNewFieldRequired(e.target.checked)}
                  className="rounded"
                /> {t('requiredLabel')}
              </label>
              <button
                type="button"
                onClick={handleAddField}
                disabled={isAddingField || !newFieldName.trim()}
                className="px-3 py-1.5 bg-[var(--primary)] text-white text-xs font-bold rounded-lg border-none cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isAddingField ? t('addingFieldBtn') : t('addFieldBtn')}
              </button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
