/**
 * Pagination — 공통 페이지네이션 컴포넌트
 *
 * Props:
 *   currentPage  : 현재 페이지 (1-based)
 *   totalCount   : 전체 항목 수
 *   pageSize     : 페이지당 항목 수
 *   onPageChange : 페이지 변경 콜백
 *   onPageSizeChange? : 페이지 크기 변경 콜백 (없으면 선택 UI 미표시)
 *   pageSizeOptions?  : 페이지 크기 옵션 (기본 [10, 20, 30, 50, 100])
 *   className?   : 추가 클래스
 */
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, List } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  blockSize?: number;
}

export function Pagination({
  currentPage,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 50, 100],
  className = '',
  blockSize = 10,
}: PaginationProps) {
  const { t } = useLanguage();

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage   = Math.min(Math.max(1, currentPage), totalPages);

  // 블록 단위 탐색: safePage 가 속한 블록의 페이지 번호 반환
  const blockStart = Math.floor((safePage - 1) / blockSize) * blockSize + 1;
  const blockEnd   = Math.min(totalPages, blockStart + blockSize - 1);

  const getPageNumbers = (): number[] =>
    Array.from({ length: blockEnd - blockStart + 1 }, (_, i) => blockStart + i);

  const hasPrevBlock = blockStart > 1;
  const hasNextBlock = blockEnd < totalPages;

  if (totalCount === 0) return null;

  const btnBase =
    'p-1 rounded-md border border-border bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-600 flex items-center justify-center h-7 w-7';

  return (
    <div
      className={`relative flex flex-row flex-nowrap items-center justify-center gap-2 py-2 px-3 ${className}`}
    >
      {/* 좌측: 페이지당 행 수 선택 (콜백이 있을 때만 표시) */}
      {onPageSizeChange && (
        <div className="flex items-center gap-1 text-xs text-muted shrink-0 absolute left-3 whitespace-nowrap">
          <List size={12} className="text-muted-foreground" />
          <select
            className="py-0.5 px-1 h-6 text-xs w-12 rounded border border-border bg-white text-foreground hover:bg-gray-50 focus:outline-none transition-colors cursor-pointer"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s} className="text-xs">{s}</option>
            ))}
          </select>
        </div>
      )}

      {/* 가운데: 페이지 버튼 */}
      <div className="flex items-center gap-1 flex-nowrap">
        {hasPrevBlock && (
          <button
            onClick={() => onPageChange(1)}
            className={btnBase}
            title={t('paginationFirstPage')}
          >
            <ChevronsLeft size={13} />
          </button>
        )}
        {hasPrevBlock && (
          <button
            onClick={() => onPageChange(blockStart - blockSize)}
            className={btnBase}
            title={t('paginationPrevBlock').replace('10', String(blockSize))}
          >
            <ChevronLeft size={13} />
          </button>
        )}

        {getPageNumbers().map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`min-w-[28px] h-7 px-1.5 rounded-md border text-xs font-semibold transition-colors ${
              page === safePage
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-white border-border text-foreground hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        ))}

        {hasNextBlock && (
          <button
            onClick={() => onPageChange(blockStart + blockSize)}
            className={btnBase}
            title={t('paginationNextBlock').replace('10', String(blockSize))}
          >
            <ChevronRight size={13} />
          </button>
        )}
        {hasNextBlock && (
          <button
            onClick={() => onPageChange(totalPages)}
            className={btnBase}
            title={t('paginationLastPage')}
          >
            <ChevronsRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * usePagination — 페이지네이션 상태 관리 헬퍼 훅
 */
export function usePagination<T>(
  items: T[],
  initialPageSize = 10,
) {
  // 이 훅은 호출처에서 직접 useState로 관리하는 것과 동일하므로
  // 필요한 값만 반환합니다.
  // 실제로는 각 컴포넌트에서 useState를 직접 사용합니다.
  // (이 함수는 참고용이며, 실제 파일에서 import 불필요)
  return { items, initialPageSize };
}
