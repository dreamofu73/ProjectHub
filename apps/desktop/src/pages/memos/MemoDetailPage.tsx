import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Paperclip, Download, RefreshCw } from 'lucide-react';
import { api } from 'shared/lib/api';
import { sanitizeHtml } from 'shared/lib/sanitize';
import { useToast } from 'ui/Toast';
import type { Memo } from 'shared/types';

export default function MemoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnFolder = searchParams.get('folder');
  const goBack = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (returnFolder) params.set('folder', returnFolder);
    navigate(`/memos?${params.toString()}`);
  };
  const [memo, setMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const handleExtendExpiry = async () => {
    if (!id) return;
    try {
      const res = await api(`/api/memos/${id}/extend`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        showToast('보관 만료 기한이 30일 연장되었습니다.', 'success');
        setMemo(prev => {
          if (prev) {
            return { ...prev, expires_at: json.data.new_expires_at };
          }
          return prev;
        });
      } else {
        showToast(json.error || '연장에 실패했습니다.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('네트워크 오류가 발생했습니다.', 'error');
    }
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api(`/api/memos/${id}`);
        const json = await res.json();
        if (json.success) {
          setMemo(json.data);
        }
      } catch (err) {
        console.error('Failed to fetch memo detail:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const formatMemoDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${yy}-${mm}-${dd} [${hh}:${min}]`;
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[calc(100vh-105px)] p-6 flex items-center justify-center bg-[var(--bg-surface)]">
        <div className="text-center">
          <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-[var(--primary)]" />
          <p className="text-xs font-medium text-[var(--text-muted)]">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!memo) {
    return (
      <div className="w-full h-[calc(100vh-105px)] p-6 flex items-center justify-center bg-[var(--bg-surface)]">
        <div className="text-center text-[var(--text-muted)]">
          <p className="text-sm font-semibold">쪽지를 찾을 수 없습니다.</p>
          <button
            onClick={goBack}
            className="mt-3 text-[var(--primary)] hover:underline text-xs font-semibold border-none bg-transparent cursor-pointer"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const senderLabel = `${memo.sender_lastname || ''}${memo.sender_firstname || memo.sender_login}`;

  return (
    <div className="w-full h-[calc(100vh-105px)] animate-in fade-in duration-200 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-2xl shadow-sm">
      {/* 상단 헤더 */}
      <div className="flex items-start gap-3 px-6 py-5 border-b border-[var(--border)] shrink-0 bg-[var(--bg-surface-2)]/50">
        <button
          onClick={goBack}
          className="p-1.5 mt-0.5 rounded-lg hover:bg-[var(--bg-surface-2)] text-[var(--text-secondary)] transition-colors border-none bg-transparent cursor-pointer shrink-0"
          title="목록으로"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-extrabold text-[var(--text-primary)] leading-snug break-words">
            {memo.title}
          </h1>
        </div>
      </div>

      {/* 본문 영역 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* 메타데이터 */}
        <div className="px-6 py-4 border-b border-[var(--border)] text-xs flex items-center gap-6 bg-[var(--bg-surface-2)]/20">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] font-medium shrink-0">보낸사람</span>
            <span className="text-[var(--text-primary)] font-bold flex items-center gap-1">
              {senderLabel}
              {memo.sender_login && <span className="text-[var(--text-muted)] font-normal">@{memo.sender_login}</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] font-medium shrink-0">받은시간</span>
            <span className="text-[var(--text-secondary)] font-medium">
              {formatMemoDate(memo.created_at)}
            </span>
          </div>
        </div>

        {/* 만료 기한 및 기한 연장 */}
        {memo.is_read === 1 && memo.is_archived === 0 && memo.expires_at && (
          <div className="mx-6 mt-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs flex items-center justify-between animate-in fade-in duration-200 select-text bg-[var(--bg-surface)]">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-amber-600 dark:text-amber-400 font-bold">보관 만료 예정일</span>
              <span className="text-[var(--text-secondary)] font-semibold truncate">
                {formatMemoDate(memo.expires_at)} (30일 후 자동 삭제)
              </span>
            </div>
            <button
              onClick={handleExtendExpiry}
              className="px-3 py-1.5 h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors border-none cursor-pointer text-xs shrink-0 select-none"
            >
              30일 연장하기
            </button>
          </div>
        )}

        {/* 내용 */}
        <div className="px-6 py-5 space-y-4">
          <div
            className="memo-detail-content text-[var(--text-secondary)] text-xs leading-relaxed whitespace-normal break-words overflow-x-auto select-text prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(memo.content) }}
          />

          {/* 첨부파일 */}
          {memo.attachments && memo.attachments.length > 0 && (
            <div className="pt-4 border-t border-[var(--border)] space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  첨부파일 ({memo.attachments.length})
                </h4>
                {memo.attachments.length > 1 && (
                  <a
                    href={`/api/attachments/batch-download?memo_id=${memo.id}`}
                    className="text-xs font-bold hover:opacity-85 flex items-center gap-1 cursor-pointer text-[var(--primary)]"
                  >
                    전체 다운로드
                  </a>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {memo.attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2.5 bg-[var(--bg-surface-2)]/40 border border-[var(--border)] rounded hover:border-[var(--primary)] transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="text-[var(--text-muted)] shrink-0" size={14} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {file.filename}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] font-medium">
                          {(file.filesize / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                    <a
                      href={`/api/attachments/${file.id}`}
                      download
                      className="p-1 hover:bg-[var(--bg-surface-2)] border border-[var(--border)] rounded text-[var(--text-secondary)] cursor-pointer"
                    >
                      <Download size={12} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .memo-detail-content table { border-collapse: collapse; width: 100% !important; margin: 1.5em 0; }
        .memo-detail-content th, .memo-detail-content td { border: 1px solid var(--border); padding: 8px 12px; min-width: 50px; text-align: left; }
        .memo-detail-content th { background-color: var(--bg-surface-2); font-weight: 600; }
        .memo-detail-content blockquote { border-left: 4px solid var(--primary); padding-left: 1rem; margin-left: 0; color: var(--text-muted); font-style: italic; }
        .memo-detail-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.5em 0; }
        .memo-detail-content hr { border: 0; border-top: 1px solid var(--border); margin: 1.5em 0; }
      `}</style>
    </div>
  );
}
