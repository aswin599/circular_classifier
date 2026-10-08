import { useState, useCallback } from 'react';
import SearchBar from '../components/search/SearchBar';
import FilterPanel from '../components/search/FilterPanel';
import SearchResults from '../components/search/SearchResults';
import Pagination from '../components/ui/Pagination';
import { useSearch, useCategories, useSearchSuggestions } from '../hooks/useApi';
import { IconSearch } from '../components/ui/Icons';
import type { SearchFilters } from '../types';

const emptyFilters: SearchFilters = {
  q: '',
  page: 1,
  limit: 10,
};

export default function SearchPage() {
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);
  const { data: categories = [] } = useCategories();
  useSearchSuggestions();

  const { data, isLoading } = useSearch(filters);

  const handleSearch = useCallback((newFilters: SearchFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const handleFilterChange = useCallback((newFilters: SearchFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const handleReset = useCallback(() => {
    setFilters(emptyFilters);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const hasActiveQuery = !!filters.q || !!filters.categoryId || !!filters.priority || !!filters.startDate || !!filters.endDate || !!filters.tag;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-down">
        <h1 className="text-2xl font-bold text-brand-900">Search Circulars</h1>
        <p className="mt-1 text-sm text-brand-500">
          Search through all circulars by keyword, category, priority, or date
        </p>
      </div>

      <div className="animate-fade-in-up bg-white rounded-2xl border border-brand-100 shadow-card p-5">
        <SearchBar onSearch={handleSearch} initialQuery={filters.q || ''} />
      </div>

      <div className="animate-fade-in-up">
        <FilterPanel
          categories={categories}
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleReset}
        />
      </div>

      {hasActiveQuery && (
        <div className="bg-white rounded-2xl border border-brand-100 shadow-card p-3 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-brand-700">
            <span>
              {data?.pagination.total ?? 0} result{(data?.pagination.total ?? 0) !== 1 ? 's' : ''}
            </span>
            {filters.q && <span className="text-brand-600">for "{filters.q}"</span>}
          </div>
          <button
            onClick={handleReset}
            className="text-sm font-medium text-brand-400 hover:text-brand-600"
          >
            Clear All
          </button>
        </div>
      )}

      {data ? (
        <>
          <SearchResults circulars={data.data} loading={isLoading} />

          {data.pagination.totalPages > 1 && (
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              hasNextPage={data.pagination.hasNextPage}
              hasPrevPage={data.pagination.hasPrevPage}
              onPageChange={handlePageChange}
            />
          )}
        </>
      ) : (
        <div className="animate-fade-in bg-white rounded-2xl border border-brand-100 shadow-card p-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-400">
            <IconSearch className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-brand-900">Start searching</h3>
          <p className="mt-2 text-sm text-brand-500 max-w-md mx-auto">
            Enter keywords to search for circulars by subject, content, sender, or tags.
            Use the filters to narrow down your results by category, priority, or date range.
          </p>
        </div>
      )}
    </div>
  );
}
