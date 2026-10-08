import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/authContext';
import { useCirculars, useCategories, useTriggerEmailFetch, MailboxSyncResult } from '../hooks/useApi';
import CircularFilters, { EMPTY_FILTERS, InboxFilters } from '../components/circulars/CircularFilters';
import CircularTable from '../components/circulars/CircularTable';
import Pagination from '../components/ui/Pagination';
import { IconMail, IconShield, IconClock } from '../components/ui/Icons';
import type { Priority } from '../types';

const PAGE_SIZE = 10;

const PRIORITY_VALUES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

function buildInitialFilters(searchParams: URLSearchParams): InboxFilters {
  const priorityParam = (searchParams.get('priority') || '').toUpperCase();
  return {
    ...EMPTY_FILTERS,
    priority: PRIORITY_VALUES.includes(priorityParam) ? (priorityParam as Priority) : '',
    startDate: searchParams.get('startDate') || '',
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isEndingToday = searchParams.get('endingToday') === 'true';

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<InboxFilters>(() => buildInitialFilters(searchParams));

  const { data: categories = [] } = useCategories();

  // Reset page when switching views
  useEffect(() => {
    setPage(1);
  }, [isEndingToday]);

  const { data, isLoading, isError, refetch } = useCirculars({
    page,
    limit: PAGE_SIZE,
    categoryId: filters.categoryId || undefined,
    senderName: filters.senderName || undefined,
    q: filters.q || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    priority: filters.priority || undefined,
    endingToday: isEndingToday ? true : undefined,
  });

  const { mutate: syncMailbox, isPending: isSyncing } = useTriggerEmailFetch();

  const handleSync = (result: MailboxSyncResult) => {
    if (result.saved > 0) {
      toast.success(`Imported ${result.saved} new circular(s) from mailbox`);
    } else {
      toast.success('Mailbox is up to date');
    }
  };

  const handleSyncError = (err: unknown) => toast.error(err instanceof Error ? err.message : 'Sync failed');

  const handleFilterChange = (next: InboxFilters) => {
    setFilters(next);
    setPage(1);
  };

  const pagination = data?.pagination;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="animate-fade-in">
          <div className="flex items-center gap-3.5">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md ${
              isEndingToday
                ? 'bg-gradient-to-br from-amber-500 to-red-600'
                : 'bg-gradient-to-br from-brand-600 to-indigo-700'
            }`}>
              {isEndingToday ? <IconClock className="h-6 w-6" /> : <IconMail className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-2xl font-black text-brand-950 tracking-tight">
                {isEndingToday ? 'Ending Today Circulars' : 'Circular Hub'}
              </h1>
              <p className="text-xs text-brand-500 font-medium mt-0.5">
                {isEndingToday
                  ? 'All institutional circulars with due dates or deadlines today, sorted by priority'
                  : 'Centralized institutional circulars sorted by date and priority'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Admin mailbox check button (Live & Train classifier removed as requested) */}
          {user?.role === 'ADMIN' && (
            <button
              type="button"
              onClick={() => syncMailbox(undefined, { onSuccess: handleSync, onError: handleSyncError })}
              disabled={isSyncing}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:opacity-95 disabled:opacity-50 active:scale-[0.98]"
            >
              <IconShield className="h-4 w-4" />
              {isSyncing ? 'Syncing Mailbox...' : 'Sync Mailbox'}
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="space-y-4">
        <CircularFilters filters={filters} categories={categories} onChange={handleFilterChange} />

        {isLoading ? (
          <div className="animate-pulse rounded-2xl border border-brand-100 bg-white p-12 text-center text-sm font-semibold text-brand-400 shadow-card">
            Loading circulars...
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-brand-200 bg-white p-10 text-center shadow-card">
            <p className="text-sm font-bold text-brand-900">Could not load circulars</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <CircularTable circulars={data?.data ?? []} />
            {pagination && pagination.totalPages > 1 && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                hasNextPage={pagination.hasNextPage}
                hasPrevPage={pagination.hasPrevPage}
                onPageChange={setPage}
                limit={PAGE_SIZE}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}