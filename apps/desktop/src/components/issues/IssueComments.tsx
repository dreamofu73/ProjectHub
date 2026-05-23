import { CommentSection } from '../comments/CommentSection';

interface IssueCommentsProps {
  issueId: string;
  formatDate: (date: string) => string;
  formatTime?: (date: string) => string;
  compact?: boolean;
}

export function IssueComments({ issueId, formatDate, formatTime, compact = false }: IssueCommentsProps) {
  return (
    <CommentSection
      fetchCommentsUrl={`/api/issues/${issueId}/comments`}
      createCommentUrl={`/api/issues/${issueId}/comments`}
      getUpdateCommentUrl={(id) => `/api/issues/comments/${id}`}
      getDeleteCommentUrl={(id) => `/api/issues/comments/${id}`}
      formatDate={formatDate}
      formatTime={formatTime}
      compact={compact}
    />
  );
}
