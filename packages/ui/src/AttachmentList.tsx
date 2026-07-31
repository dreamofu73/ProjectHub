import { useState, useEffect, useCallback } from 'react';
import { Paperclip, FileText, Download, Eye, X, Image, File, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from './Button';
import { useToast } from './Toast';
import { api, fetchBlobUrl } from 'shared/lib/api';

import type { Attachment } from 'shared/types';
export type { Attachment };

export interface AttachmentListProps {
  attachments: Attachment[];
  onDownloadAll?: () => void;
  onDownloadSelected?: (ids: string[]) => void;
  className?: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ─── 파일 유형 판별 ───────────────────────────────────────────────────────────
type FileCategory = 'image' | 'pdf' | 'text' | 'unsupported';

function getFileCategory(contentType: string, filename: string): FileCategory {
  const mime = contentType.toLowerCase();
  const ext  = filename.split('.').pop()?.toLowerCase() ?? '';

  if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg','bmp','ico'].includes(ext))
    return 'image';
  if (mime === 'application/pdf' || ext === 'pdf')
    return 'pdf';
  if (
    mime.startsWith('text/') ||
    ['txt','md','csv','json','xml','yaml','yml','log','ini','conf','sh','ts','tsx','js','jsx','py','rs','go','java','cs','cpp','c','html','css'].includes(ext)
  )
    return 'text';
  return 'unsupported';
}

function getFileIcon(category: FileCategory) {
  switch (category) {
    case 'image': return Image;
    case 'pdf':   return FileText;
    case 'text':  return FileText;
    default:      return File;
  }
}

// ─── 다운로드 핸들러 ─────────────────────────────────────────────────────────
async function handleDownload(e: React.MouseEvent, file: Attachment, onError?: (message: string) => void) {
  e.preventDefault();
  e.stopPropagation();
  try {
    const blobUrl = await fetchBlobUrl(`/api/attachments/${file.id}`);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch {
    onError?.('파일을 다운로드할 수 없습니다.');
  }
}

// ─── 미리보기 모달 ───────────────────────────────────────────────────────────
interface PreviewModalProps {
  file: Attachment;
  onClose: () => void;
  onDownload: (e: React.MouseEvent) => void;
}

function PreviewModal({ file, onClose, onDownload }: PreviewModalProps) {
  const category = getFileCategory(file.content_type || '', file.filename);
  const sourceUrl = `/api/attachments/${file.id}`;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textError,   setTextError]   = useState(false);
  const [imgScale,    setImgScale]    = useState(1);
  const [imgRotation, setImgRotation] = useState(0);

  // ESC 키로 닫기
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // 이미지/PDF는 인증된 fetch로 blob URL을 만들어 사용
  useEffect(() => {
    if (category !== 'image' && category !== 'pdf') return;
    let revokeUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blobUrl = await fetchBlobUrl(sourceUrl);
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        revokeUrl = blobUrl;
        setPreviewUrl(blobUrl);
      } catch {
        if (!cancelled) setPreviewError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [category, sourceUrl]);

  // 텍스트 파일 로드 (인증된 fetch)
  useEffect(() => {
    if (category !== 'text') return;
    let cancelled = false;
    api(sourceUrl)
      .then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then(t => { if (!cancelled) setTextContent(t); })
      .catch(() => { if (!cancelled) setTextError(true); });
    return () => { cancelled = true; };
  }, [category, sourceUrl]);

  const categoryLabel: Record<FileCategory, string> = {
    image: '이미지',
    pdf: 'PDF',
    text: '문서',
    unsupported: '파일',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0 bg-white/5 border-b border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/25 text-indigo-200">
            {categoryLabel[category]}
          </span>
          <span className="text-sm font-medium text-white truncate max-w-xs">{file.filename}</span>
          <span className="text-xs text-gray-400 shrink-0">{formatFileSize(file.filesize)}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 이미지 전용 컨트롤 */}
          {category === 'image' && (
            <>
              <button
                className="icon-btn-modal"
                title="축소"
                onClick={() => setImgScale(s => Math.max(0.25, s - 0.25))}
              ><ZoomOut size={16} /></button>
              <span className="text-xs text-gray-300 w-10 text-center">{Math.round(imgScale * 100)}%</span>
              <button
                className="icon-btn-modal"
                title="확대"
                onClick={() => setImgScale(s => Math.min(5, s + 0.25))}
              ><ZoomIn size={16} /></button>
              <button
                className="icon-btn-modal"
                title="회전"
                onClick={() => setImgRotation(r => (r + 90) % 360)}
              ><RotateCw size={16} /></button>
              <div className="w-px h-5 bg-white/20" />
            </>
          )}
          <button
            className="icon-btn-modal"
            title="다운로드"
            onClick={onDownload}
          ><Download size={16} /></button>
          <button
            className="icon-btn-modal"
            title="닫기"
            onClick={onClose}
          ><X size={18} /></button>
        </div>
      </div>

      {/* 본문 */}
      <div
        className="flex-1 flex items-center justify-center overflow-auto p-4"
        onClick={e => e.stopPropagation()}
      >
        {/* 이미지 */}
        {category === 'image' && (
          previewError ? (
            <div className="text-gray-300 text-sm">이미지를 불러올 수 없습니다.</div>
          ) : previewUrl ? (
            <div className="overflow-auto max-w-full max-h-full">
              <img
                src={previewUrl}
                alt={file.filename}
                className={`block rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.5)] transition-transform duration-200 origin-center ${
                  imgScale > 1 ? 'max-w-none max-h-none' : 'max-w-full max-h-[calc(100vh-120px)]'
                }`}
                style={{
                  transform: `scale(${imgScale}) rotate(${imgRotation}deg)`,
                }}
              />
            </div>
          ) : (
            <div className="spinner w-7 h-7 !border-t-indigo-400" />
          )
        )}

        {/* PDF */}
        {category === 'pdf' && (
          previewError ? (
            <div className="text-gray-300 text-sm">PDF를 불러올 수 없습니다.</div>
          ) : previewUrl ? (
            <iframe
              src={`${previewUrl}#toolbar=1&navpanes=0`}
              title={file.filename}
              className="w-full h-[calc(100vh-80px)] border-none rounded-lg bg-white shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
            />
          ) : (
            <div className="spinner w-7 h-7 !border-t-indigo-400" />
          )
        )}

        {/* 텍스트 / 문서 */}
        {category === 'text' && (
          <div className="w-full max-w-[860px] max-h-[calc(100vh-100px)] overflow-auto bg-[#1e1e2e] rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] border border-white/10">
            {textError ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <File size={40} />
                <p className="text-sm">파일을 불러올 수 없습니다.</p>
              </div>
            ) : textContent === null ? (
              <div className="flex items-center justify-center py-16">
                <div className="spinner w-7 h-7 !border-t-indigo-400" />
              </div>
            ) : (
              <pre className="m-0 p-6 font-mono text-xs leading-relaxed text-slate-200 whitespace-pre-wrap break-all">
                {textContent}
              </pre>
            )}
          </div>
        )}

        {/* 지원 안 됨 */}
        {category === 'unsupported' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-18 h-18 rounded-[18px] bg-white/10 flex items-center justify-center">
              <File size={36} color="#94a3b8" />
            </div>
            <p className="text-gray-300 font-medium">{file.filename}</p>
            <p className="text-gray-500 text-sm">이 파일 형식은 미리보기를 지원하지 않습니다.</p>
            <Button
              variant="primary"
              icon={Download}
              onClick={onDownload}
            >
              다운로드하여 열기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function AttachmentList({ attachments, onDownloadAll, onDownloadSelected, className = '' }: AttachmentListProps) {
  const [previewFile, setPreviewFile] = useState<Attachment | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  // 네이티브 alert 대체 — 다운로드 실패를 앱 토스트로 알림
  const notifyDownloadError = useCallback((message: string) => showToast(message, 'error'), [showToast]);

  if (!attachments || attachments.length === 0) return null;

  const handleToggleSelectAll = () => {
    if (selectedIds.size === attachments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(attachments.map(a => a.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <>
      <div className={`bg-surface border border-border rounded-xl p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-secondary">
            <Paperclip size={16} />
            <span>첨부 파일 ({attachments.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {onDownloadSelected && selectedIds.size > 0 && (
              <Button variant="primary" size="sm" icon={Download} onClick={() => onDownloadSelected(Array.from(selectedIds))}>
                선택 다운로드 ({selectedIds.size})
              </Button>
            )}
            {onDownloadAll && attachments.length > 1 && (
              <Button variant="secondary" size="sm" icon={Download} onClick={onDownloadAll}>
                전체 다운로드
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#0f0f0f] text-xs font-semibold text-secondary uppercase tracking-wider">
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === attachments.length && attachments.length > 0}
                    onChange={handleToggleSelectAll}
                    className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </th>
                <th className="w-10 px-3 py-3 text-center"></th>
                <th className="px-2 py-3 text-left">파일명</th>
                <th className="w-24 px-3 py-3 text-right">크기</th>
                <th className="w-20 px-2 py-3 text-center">미리보기</th>
                <th className="w-20 px-2 py-3 text-center">다운로드</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {attachments.map((file) => {
                const category = getFileCategory(file.content_type || '', file.filename);
                const FileIcon = getFileIcon(category);
                return (
                  <tr
                    key={file.id}
                    className="group hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    {/* Checkbox */}
                    <td className="w-10 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(file.id)}
                        onChange={() => handleToggleSelect(file.id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
                    {/* File icon */}
                    <td className="w-10 px-3 py-3 text-center">
                      <div className="inline-flex w-8 h-8 items-center justify-center rounded-md bg-primary-bg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <FileIcon size={16} />
                      </div>
                    </td>
                    {/* File name */}
                    <td className="px-2 py-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[360px]">
                        {file.filename}
                      </div>
                    </td>
                    {/* File size */}
                    <td className="w-24 px-3 py-3 text-right">
                      <span className="text-xs text-muted">{formatFileSize(file.filesize)}</span>
                    </td>
                    {/* Preview */}
                    <td className="w-20 px-2 py-3 text-center">
                      <button
                        type="button"
                        title="미리보기"
                        className="inline-flex w-7 h-7 items-center justify-center rounded-md text-gray-400 hover:text-primary hover:bg-primary-bg transition-colors"
                        onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                    {/* Download */}
                    <td className="w-20 px-2 py-3 text-center">
                      <button
                        type="button"
                        title="다운로드"
                        className="inline-flex w-7 h-7 items-center justify-center rounded-md text-gray-400 hover:text-primary hover:bg-primary-bg transition-colors"
                        onClick={(e) => handleDownload(e, file, notifyDownloadError)}
                      >
                        <Download size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 미리보기 모달 */}
      {previewFile && (
        <PreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={(e) => handleDownload(e, previewFile, notifyDownloadError)}
        />
      )}
    </>
  );
}
