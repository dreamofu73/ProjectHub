import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';
import { Input, Select } from 'ui/Input';
import { PageHeader } from 'ui/PageHeader';
import { api } from 'shared/lib/api';

import { useLanguage } from 'shared/hooks/LanguageContext';
export default function NewProject() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const isSysAdmin = currentUser?.role === 'admin';

  if (!isSysAdmin) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl mx-auto mt-8">
        <Card className="border-red-200 dark:border-red-900/50">
          <CardBody className="p-8 text-center">
            <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">
              {t('permissionDenied') || '접근 권한이 없습니다.'}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              {t('onlyAdminCanCreateProject')}
            </p>
            <Link to="/projects">
              <Button variant="secondary">{t('backToProject')}</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [homepage, setHomepage] = useState('');
  const [isPublic, setIsPublic] = useState('true');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !identifier) return;

    setIsSubmitting(true);
    setError('');

    try {
      const res = await api('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          identifier: identifier.trim().toLowerCase(),
          description,
          homepage,
          is_public: isPublic === 'true'
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        navigate(`/projects/${identifier.trim().toLowerCase()}`);
      } else {
        setError(json.error || t('projectCreateError'));
      }
    } catch {
      setError(t('serverCommError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow lowercase letters, numbers, and hyphens for identifier
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setIdentifier(value);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link 
          to="/projects" 
          className="btn btn-secondary btn-icon rounded-full"
        >
          <ArrowLeft size={16} />
        </Link>
        <PageHeader 
          title={t('createNewProject')} 
          description={t('projectDesc2')}
          className="mb-0"
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={t('projectName2')}
                placeholder={t('projectNameExample')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSubmitting}
                fullWidth
              />

              <div>
                <Input
                  label={t('projectIdentifier')}
                  placeholder={t('projectIdentifierExample')}
                  value={identifier}
                  onChange={handleIdentifierChange}
                  required
                  disabled={isSubmitting}
                  fullWidth
                />
                <span className="text-xs text-muted mt-1.5 block">{t('identifierImmutableHint')}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={t('homepage')}
                placeholder={t('urlExamplePlaceholder')}
                value={homepage}
                onChange={(e) => setHomepage(e.target.value)}
                disabled={isSubmitting}
                fullWidth
              />

              <Select
                label={t('visibility')}
                value={isPublic}
                onChange={(e) => setIsPublic(e.target.value)}
                disabled={isSubmitting}
                fullWidth
                options={[
                  { value: 'true', label: t('projectPublic') },
                  { value: 'false', label: t('projectPrivate') }
                ]}
              />
            </div>

            <div>
              <label className="form-label">{t('projectDescription')}</label>
              <textarea
                className="form-control min-h-[120px] resize-y"
                placeholder={t('projectDescPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Link to="/projects">
                <Button 
                  type="button" 
                  variant="secondary"
                  disabled={isSubmitting}
                >
                  {t('cancel')}
                </Button>
              </Link>
              <Button
                type="submit"
                isLoading={isSubmitting}
                icon={Save}
                disabled={isSubmitting || !name || !identifier}
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
