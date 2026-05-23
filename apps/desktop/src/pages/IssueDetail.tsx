import { Link } from 'react-router-dom';
import { 
  MessageSquare, Clock, ChevronRight, 
  ArrowLeft, Trash2
} from 'lucide-react';
import { Card, CardBody } from 'ui/Card';
import { Button } from 'ui/Button';
import { Badge } from 'ui/Badge';
import { FileUploader } from 'ui/FileUploader';
import { AttachmentList } from 'ui/AttachmentList';
import { useLanguage } from '../context/LanguageContext';
import { useIssueDetail } from './useIssueDetail';

export default function IssueDetail() {
  const { formatDateTime, formatDate, t } = useLanguage();
  const {
    projectId,
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
  } = useIssueDetail();

  // tracker, priority, status labels
  const trackerLabels: Record<string, string> = { bug: t('bug'), feature: t('feature'), task: t('task'), support: t('support'), enhancement: t('enhancement') };
  const statusLabels: Record<string, string> = { new: t('new'), in_progress: t('in_progress'), resolved: t('resolved'), feedback: t('feedback'), closed: t('closed'), rejected: t('rejected') };
  const priorityLabels: Record<string, string> = { low: t('low'), normal: t('normal'), high: t('high'), urgent: t('urgent'), immediate: t('immediate') };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner text-primary w-10 h-10 border-[3px]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-danger max-w-xl mx-auto mt-8">
        <CardBody className="text-center py-8">
          <p className="text-danger font-bold mb-4">{error || '이슈 데이터를 찾을 수 없습니다.'}</p>
          <Link to={`/projects/${projectId}/dashboard`}>
            <Button variant="secondary" icon={ArrowLeft}>프로젝트로 돌아가기</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  const { issue, comments } = data;

  return (
    <div className="flex flex-col gap-3">
      {/* 브레드크럼 & 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 text-xs text-muted font-semibold">
          <Link to="/projects" className="hover:text-primary transition-colors">프로젝트</Link>
          <ChevronRight size={12} className="opacity-50" />
          <Link to={`/projects/${projectId}/dashboard`} className="hover:text-primary transition-colors">{issue.project_name}</Link>
          <ChevronRight size={12} className="opacity-50" />
          <span className="text-foreground">#{issue.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/projects/${projectId}/dashboard`}>
            <Button variant="secondary" size="sm" icon={ArrowLeft}>목록으로</Button>
          </Link>
          <Button 
            variant="danger" 
            size="sm" 
            icon={Trash2} 
            onClick={() => setShowDeleteConfirm(true)}
          >
            삭제
          </Button>
        </div>
      </div>

      {showDeleteConfirm && (
        <Card className="border-danger bg-danger/5 stagger-1">
          <CardBody className="flex items-center justify-between flex-wrap gap-4 py-3">
            <div className="text-sm font-semibold text-danger">이 이슈를 정말로 삭제하시겠습니까? 되돌릴 수 없습니다.</div>
            <div className="flex gap-2">
              <Button size="sm" variant="danger" onClick={handleDeleteIssue}>예, 삭제합니다</Button>
              <Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>취소</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 2단 구성 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 stagger-2">
        {/* 왼쪽: 이슈 상세정보 및 댓글 */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <Card>
            <CardBody className="flex flex-col gap-4">
              {isEditMode ? (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    className="form-control text-lg font-bold w-full"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="이슈 제목"
                  />
                  <textarea
                    rows={6}
                    className="form-control text-sm w-full"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="이슈 설명 (Markdown 지원)"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button 
                      size="sm" 
                      onClick={() => handleUpdateIssue({ subject: editSubject, description: editDescription })}
                      disabled={isUpdatingIssue}
                    >
                      {isUpdatingIssue ? '저장 중...' : '저장'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setIsEditMode(false)}>취소</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-border pb-3.5">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-bold text-muted font-mono">#{issue.id}</span>
                        <Badge variant={issue.tracker}>{trackerLabels[issue.tracker] || issue.tracker}</Badge>
                        <Badge variant={issue.priority}>{priorityLabels[issue.priority] || issue.priority}</Badge>
                      </div>
                      <h1 className="text-xl font-bold text-foreground leading-snug">{issue.subject}</h1>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setIsEditMode(true)}>수정</Button>
                  </div>

                  <div className="text-sm leading-relaxed text-secondary whitespace-pre-wrap min-h-[100px]">
                    {issue.description || <span className="text-muted italic">작성된 설명이 없습니다.</span>}
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          {/* 댓글 목록 */}
          <div className="flex flex-col gap-2 mt-2">
            <h3 className="text-base font-bold text-foreground flex items-center gap-1.5 px-1.5">
              <MessageSquare size={16} />댓글 ({comments.length})
            </h3>
            {comments.map((comment) => (
              <Card key={comment.id} className="border-l-2 border-l-indigo-500/30">
                <CardBody className="py-3.5 px-4 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold text-muted">
                    <span>{comment.author_name} ({comment.author_login})</span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {formatDateTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                  
                  {comment.attachments && comment.attachments.length > 0 && (
                    <AttachmentList attachments={comment.attachments} className="mt-2" />
                  )}
                </CardBody>
              </Card>
            ))}
          </div>

          {/* 댓글 입력 폼 */}
          <Card className="mt-2">
            <CardBody className="p-4">
              <form onSubmit={handleCommentSubmit} className="flex flex-col gap-3">
                <textarea
                  rows={3}
                  className="form-control text-sm w-full"
                  placeholder="의견을 남겨주세요... (Markdown 지원)"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={isSubmitting}
                />
                
                {/* 첨부 파일 업로더 */}
                <FileUploader
                  files={commentFiles}
                  onChange={setCommentFiles}
                  maxSizeMB={10}
                />

                {isSubmitting && commentFiles.length > 0 && (
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted">엔터 대신 전송 버튼을 눌러 입력하세요.</span>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || !newComment.trim()}
                  >
                    {isSubmitting ? '전송 중...' : '댓글 등록'}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* 오른쪽: 메타데이터 관리 */}
        <div className="flex flex-col gap-3">
          <Card>
            <CardBody className="p-4 flex flex-col gap-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted border-b border-border pb-2">메타데이터</h3>

              <div className="flex flex-col gap-4">
                <div className="pt-0">
                  <div className="text-sm font-bold text-foreground uppercase mb-2 tracking-widest flex justify-between items-center">
                    상태
                    {isUpdatingField === 'status' && <div className="spinner text-primary w-3 h-3 border-[1.5px]" />}
                  </div>
                  <select 
                    className="form-control text-sm font-bold bg-white"
                    value={issue.status}
                    onChange={(e) => handleFieldUpdate('status', e.target.value)}
                    disabled={isUpdatingField === 'status'}
                  >
                    {Object.entries(statusLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4">
                  <div className="text-sm font-bold text-foreground uppercase mb-2 tracking-widest flex justify-between items-center">
                    담당자
                    {isUpdatingField === 'assigned_to_id' && <div className="spinner text-primary w-3 h-3 border-[1.5px]" />}
                  </div>
                  <select 
                    className="form-control text-sm font-bold bg-white"
                    value={issue.assigned_to_id || ''}
                    onChange={(e) => handleFieldUpdate('assigned_to_id', e.target.value === '' ? null : Number(e.target.value))}
                    disabled={isUpdatingField === 'assigned_to_id'}
                  >
                    <option value="">미배정</option>
                    {members.map(member => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.firstname} {member.lastname} (@{member.login})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-4">
                  <div className="text-sm font-bold text-foreground uppercase mb-2 tracking-widest flex justify-between items-center">
                    우선순위
                    {isUpdatingField === 'priority' && <div className="spinner text-primary w-3 h-3 border-[1.5px]" />}
                  </div>
                  <div className="flex gap-2 items-center">
                    <select 
                      className="form-control text-sm font-bold bg-white flex-1"
                      value={issue.priority}
                      onChange={(e) => handleFieldUpdate('priority', e.target.value)}
                      disabled={isUpdatingField === 'priority'}
                    >
                      {Object.entries(priorityLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <Badge variant={issue.priority} className="shrink-0">
                      {priorityLabels[issue.priority] || issue.priority}
                    </Badge>
                  </div>
                </div>

                <div className="pt-4">
                  <div className="text-sm font-bold text-foreground uppercase mb-2 tracking-widest flex justify-between items-center">
                    유형
                    {isUpdatingField === 'tracker' && <div className="spinner text-primary w-3 h-3 border-[1.5px]" />}
                  </div>
                  <div className="flex gap-2 items-center">
                    <select 
                      className="form-control text-sm font-bold bg-white flex-1"
                      value={issue.tracker}
                      onChange={(e) => handleFieldUpdate('tracker', e.target.value)}
                      disabled={isUpdatingField === 'tracker'}
                    >
                      {Object.entries(trackerLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <Badge variant={issue.tracker} className="shrink-0">
                      {trackerLabels[issue.tracker] || issue.tracker}
                    </Badge>
                  </div>
                </div>

                <div className="pt-4">
                  <div className="text-sm font-bold text-foreground uppercase mb-2 tracking-widest flex justify-between items-center">
                    진행률 ({issue.done_ratio || 0}%)
                    {isUpdatingField === 'done_ratio' && <div className="spinner text-primary w-3 h-3 border-[1.5px]" />}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input 
                      type="range" 
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                      min="0" 
                      max="100" 
                      step="10"
                      value={issue.done_ratio || 0}
                      onChange={(e) => handleFieldUpdate('done_ratio', Number(e.target.value))}
                      disabled={isUpdatingField === 'done_ratio'}
                    />
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-primary h-full transition-all duration-300" style={{ width: `${issue.done_ratio || 0}%` }} />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border mt-2 text-xs font-semibold text-muted flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span>만든 이</span>
                    <span className="text-secondary font-bold">{issue.author_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>생성일</span>
                    <span className="text-secondary font-bold">{formatDate(issue.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>수정일</span>
                    <span className="text-secondary font-bold">{formatDate(issue.updated_at)}</span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
