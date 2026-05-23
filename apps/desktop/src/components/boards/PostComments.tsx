import { CommentSection } from '../comments/CommentSection';

interface PostCommentsProps {
  postId: string;
  formatDate: (date: string) => string;
  formatTime?: (date: string) => string;
  compact?: boolean;
}

export function PostComments({ postId, formatDate, formatTime, compact = false }: PostCommentsProps) {
  return (
    <CommentSection
      fetchCommentsUrl={`/api/posts/${postId}/comments`}
      createCommentUrl={`/api/posts/${postId}/comments`}
      getUpdateCommentUrl={(id) => `/api/posts/comments/${id}`}
      getDeleteCommentUrl={(id) => `/api/posts/comments/${id}`}
      formatDate={formatDate}
      formatTime={formatTime}
      compact={compact}
    />
  );
}
