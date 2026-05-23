import { useState, useEffect } from 'react';
import { FileText, Download } from 'lucide-react';
import { fetchBlobUrl } from 'shared/lib/api';

interface ChatFileAttachmentProps {
  fileId: string;
  filename: string;
  isMe: boolean;
  onPreview: (url: string, title: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  t: (key: string) => string;
}

export const ChatFileAttachment = ({ fileId, filename, isMe, onPreview, showToast, t }: ChatFileAttachmentProps) => {
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
  const fileUrl = `/api/attachments/${fileId}`;
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    let revoke: string | null = null;
    fetchBlobUrl(fileUrl).then(url => {
      revoke = url;
      setThumbUrl(url);
    }).catch(err => console.error('Chat thumbnail error:', err));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [fileUrl, isImage]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const blobUrl = await fetchBlobUrl(fileUrl);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Chat download error:', err);
    }
  };

  if (isImage) {
    return (
      <div
        onClick={async () => { 
          try {
            const fullUrl = await fetchBlobUrl(fileUrl);
            onPreview(fullUrl, filename); 
          } catch (err) {
            console.error('Chat preview error:', err);
            showToast(t('chatPreviewFail') || '미리보기를 불러올 수 없습니다.', 'error');
          }
        }}
        className={`cursor-pointer rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800 ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
        style={{ width: '220px' }}
      >
        <div className="relative w-full aspect-video bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden group/img">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={filename}
              className="w-full h-full object-cover select-none"
            />
          ) : (
            <div className="spinner-sm" />
          )}
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-white text-xs font-bold bg-black/40 px-2.5 py-1.5 rounded-lg backdrop-blur-sm">
              {t('chatPreviewLarge')}
            </span>
          </div>
        </div>
        <div className="p-2.5 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{filename}</div>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0 border-none cursor-pointer"
          >
            <Download size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border transition-all ${
        isMe
          ? 'bg-indigo-600 border-transparent text-white rounded-br-sm shadow-sm'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 rounded-bl-sm'
      }`}
      style={{ width: '220px' }}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
        <FileText size={16} className={isMe ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold truncate ${isMe ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{filename}</div>
        <div className={`text-xs mt-0.5 ${isMe ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>{t('chatClickDownload')}</div>
      </div>
      <button
        onClick={handleDownload}
        className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors border-none cursor-pointer shrink-0 ${
          isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400'
        }`}
      >
        <Download size={13} />
      </button>
    </div>
  );
};
