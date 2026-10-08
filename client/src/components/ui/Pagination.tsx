import { IconChevronLeft, IconChevronRight } from './Icons';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  onPageChange: (page: number) => void;
  limit?: number;
}

export default function Pagination({
  page,
  totalPages,
  total,
  hasNextPage,
  hasPrevPage,
  onPageChange,
  limit = 10,
}: PaginationProps) {
  if (total === 0) return null;

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  const pageButtonClasses = (isCurrent: boolean) =>
    `px-3 py-1.5 text-sm rounded-lg transition-colors ${
      isCurrent
        ? 'bg-brand-300 text-white'
        : 'bg-white text-brand-800/70 border border-brand-100 hover:bg-brand-50'
    }`;

  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
      <p className="text-xs text-brand-500">
        Showing {first}–{last} of {total} results
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevPage}
          aria-label="Previous page"
          className={`${pageButtonClasses(false)} flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <IconChevronLeft className="h-4 w-4" />
        </button>

        {pageNumbers[0] > 1 && (
          <>
            <button onClick={() => onPageChange(1)} className={pageButtonClasses(false)}>
              1
            </button>
            {pageNumbers[0] > 2 && <span className="px-1 text-brand-300">...</span>}
          </>
        )}

        {pageNumbers.map((p) => (
          <button key={p} onClick={() => onPageChange(p)} className={pageButtonClasses(p === page)}>
            {p}
          </button>
        ))}

        {pageNumbers[pageNumbers.length - 1] < totalPages && (
          <>
            {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
              <span className="px-1 text-brand-300">...</span>
            )}
            <button onClick={() => onPageChange(totalPages)} className={pageButtonClasses(false)}>
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
          aria-label="Next page"
          className={`${pageButtonClasses(false)} flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}