import { useLanguage } from '../../context/LanguageContext';
import { CommentSection } from '../comments/CommentSection';

interface WikiCommentsProps {
  wikiPageId: string;
}

export function WikiComments({ wikiPageId }: WikiCommentsProps) {
  const { formatDate, formatTime } = useLanguage();

  return (
    <CommentSection
      fetchCommentsUrl={`/api/wiki/${wikiPageId}/comments`}
      createCommentUrl={`/api/wiki/${wikiPageId}/comments`}
      getUpdateCommentUrl={(id) => `/api/wiki/${wikiPageId}/comments/${id}`}
      getDeleteCommentUrl={(id) => `/api/wiki/${wikiPageId}/comments/${id}`}
      formatDate={formatDate}
      formatTime={formatTime}
    />
  );
}
