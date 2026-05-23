import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, Paperclip, X } from 'lucide-react';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';
import { Input, Select } from 'ui/Input';
import { PageHeader } from 'ui/PageHeader';
import { useToast } from 'ui/Toast';
import { api } from 'shared/lib/api';

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
            showToast('파일 용량이 너무 큽니다 (최대 100MB).', 'error');
          } else {
            showToast(`파일 업로드에 실패했습니다 (오류 코드: ${res.status}).`, 'error');
          }
          continue;
        }
        
        const json = await res.json();
        if (json.success) {
          setAttachments(prev => [...prev, json.data]);
        }
      }
      showToast('파일이 업로드되었습니다.', 'success');
    } catch (err) {
      console.error('File upload failed:', err);
      showToast('파일 업로드 중 오류가 발생했습니다.', 'error');
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
        showToast('이슈가 성공적으로 생성되었습니다.', 'success');
        navigate(`/projects/${projectId}/issues`);
      } else {
        showToast(json.error || '이슈 생성 중 오류가 발생했습니다.', 'error');
      }
    } catch {
      showToast('서버 통신 오류가 발생했습니다.', 'error');
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
          <p className="text-danger font-semibold mb-4">프로젝트를 찾을 수 없습니다.</p>
          <Link to="/projects">
            <Button variant="secondary">프로젝트 목록으로 이동</Button>
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
          title="새 이슈 만들기" 
          description={`${project.name} 프로젝트에 새 이슈를 등록합니다.`}
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
              label="제목"
              placeholder="이슈 제목을 입력하세요"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              disabled={isSubmitting}
              fullWidth
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Select
                label="유형"
                value={tracker}
                onChange={(e) => setTracker(e.target.value)}
                disabled={isSubmitting}
                fullWidth
                options={[
                  { value: 'bug', label: '결함 (Bug)' },
                  { value: 'feature', label: '새 기능 (Feature)' },
                  { value: 'task', label: '작업 (Task)' },
                  { value: 'support', label: '지원 (Support)' },
                  { value: 'enhancement', label: '개선 (Enhancement)' }
                ]}
              />

              <Select
                label="상태"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={isSubmitting}
                fullWidth
                options={[
                  { value: 'new', label: '신규 (New)' },
                  { value: 'in_progress', label: '진행중 (In Progress)' },
                  { value: 'resolved', label: '해결됨 (Resolved)' },
                  { value: 'feedback', label: '피드백 (Feedback)' }
                ]}
              />

              <Select
                label="우선순위"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={isSubmitting}
                fullWidth
                options={[
                  { value: 'low', label: '낮음 (Low)' },
                  { value: 'normal', label: '보통 (Normal)' },
                  { value: 'high', label: '높음 (High)' },
                  { value: 'urgent', label: '긴급 (Urgent)' }
                ]}
              />
            </div>

            <div>
              <label className="form-label">설명</label>
              <textarea
                className="form-control min-h-[180px] resize-y"
                placeholder="이슈에 대한 상세 내용을 작성하세요..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="pt-2">
              <label className="form-label mb-2 flex items-center justify-between">
                <span>파일 첨부</span>
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
                  파일 선택
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
                    첨부된 파일이 없습니다.
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
                 취소
               </Button>
               <Button
                 type="submit"
                 isLoading={isSubmitting}
                 disabled={isSubmitting || !subject}
                 icon={Save}
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
