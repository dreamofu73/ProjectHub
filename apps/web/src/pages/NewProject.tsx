import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';
import { Input, Select } from 'ui/Input';
import { PageHeader } from 'ui/PageHeader';
import { api } from 'shared/lib/api';

export default function NewProject() {
  const navigate = useNavigate();
  
  // Form states
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
        setError(json.error || '프로젝트 생성 중 오류가 발생했습니다.');
      }
    } catch {
      setError('서버 통신 오류가 발생했습니다.');
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
          title="새 프로젝트 생성" 
          description="새로운 협업 및 이슈 관리 공간을 만듭니다."
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
                label="프로젝트 이름"
                placeholder="예: 마케팅 웹사이트 제작"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSubmitting}
                fullWidth
              />

              <div>
                <Input
                  label="프로젝트 식별자 (URL 경로에 사용)"
                  placeholder="예: marketing-website (소문자, 숫자, - 만 가능)"
                  value={identifier}
                  onChange={handleIdentifierChange}
                  required
                  disabled={isSubmitting}
                  fullWidth
                />
                <span className="text-xs text-muted mt-1.5 block">생성 후 변경할 수 없으며, 고유해야 합니다.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="홈페이지"
                placeholder="예: https://example.com"
                value={homepage}
                onChange={(e) => setHomepage(e.target.value)}
                disabled={isSubmitting}
                fullWidth
              />

              <Select
                label="공개 여부"
                value={isPublic}
                onChange={(e) => setIsPublic(e.target.value)}
                disabled={isSubmitting}
                fullWidth
                options={[
                  { value: 'true', label: '공개 (모든 사용자 접근 가능)' },
                  { value: 'false', label: '비공개 (프로젝트 멤버만 접근 가능)' }
                ]}
              />
            </div>

            <div>
              <label className="form-label">프로젝트 설명</label>
              <textarea
                className="form-control min-h-[120px] resize-y"
                placeholder="프로젝트에 대한 간단한 설명을 입력하세요..."
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
                  취소
                </Button>
              </Link>
              <Button
                type="submit"
                isLoading={isSubmitting}
                icon={Save}
                disabled={isSubmitting || !name || !identifier}
              >
                생성하기
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
