import { useMemo } from 'react';
import { IconClose, IconCalendar, IconFilter, IconUser, IconSearch } from '../ui/Icons';
import type { Category, Priority } from '../../types';

export interface InboxFilters {
  categoryId: string;
  senderName: string;
  q: string;
  startDate: string;
  endDate: string;
  priority: '' | Priority;
}

interface CircularFiltersProps {
  filters: InboxFilters;
  categories: Category[];
  onChange: (filters: InboxFilters) => void;
}

export const EMPTY_FILTERS: InboxFilters = {
  categoryId: '',
  senderName: '',
  q: '',
  startDate: '',
  endDate: '',
  priority: '',
};

const priorityOptions: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export default function CircularFilters({ filters, categories, onChange }: CircularFiltersProps) {
  const isActive = useMemo(
    () =>
      filters.categoryId !== EMPTY_FILTERS.categoryId ||
      Boolean(filters.senderName) ||
      Boolean(filters.q) ||
      filters.priority !== EMPTY_FILTERS.priority ||
      filters.startDate !== '' ||
      filters.endDate !== '',
    [filters]
  );

  const inputClass =
    'w-full rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm text-brand-900 placeholder-brand-300 outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-100';

  return (
    <div className="animate-fade-in-down rounded-2xl border border-brand-100 bg-white p-4 shadow-card space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {/* Instant Search input */}
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-xs font-semibold text-brand-600">Search</label>
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-brand-400" />
            <input
              type="text"
              placeholder="Search keyword (instant)..."
              className={`${inputClass} pl-9`}
              value={filters.q}
              onChange={(e) => onChange({ ...filters, q: e.target.value })}
            />
          </div>
        </div>

        {/* Filter by Sender Name (Instant character by character) */}
        <div className="flex-1 min-w-[190px]">
          <label className="mb-1 block text-xs font-semibold text-brand-600">Filter by sender name</label>
          <div className="relative">
            <IconUser className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-brand-400" />
            <input
              type="text"
              placeholder="Enter name or email..."
              className={`${inputClass} pl-9`}
              value={filters.senderName}
              onChange={(e) => onChange({ ...filters, senderName: e.target.value })}
            />
          </div>
        </div>

        {/* Category selector */}
        <div className="min-w-[150px]">
          <label className="mb-1 block text-xs font-semibold text-brand-600">Category</label>
          <select
            className={inputClass}
            value={filters.categoryId}
            onChange={(e) => onChange({ ...filters, categoryId: e.target.value })}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Priority selector */}
        <div className="min-w-[150px]">
          <label className="mb-1 block text-xs font-semibold text-brand-600">Priority</label>
          <select
            className={inputClass}
            value={filters.priority}
            onChange={(e) =>
              onChange({ ...filters, priority: e.target.value as InboxFilters['priority'] })
            }
          >
            <option value="">All priorities</option>
            {priorityOptions.map((p) => (
              <option key={p} value={p}>
                {p === 'NORMAL' ? 'Medium' : p[0] + p.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div className="min-w-[140px]">
          <label className="mb-1 block text-xs font-semibold text-brand-600">From date</label>
          <div className="relative">
            <IconCalendar className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-brand-400" />
            <input
              type="date"
              className={`${inputClass} pl-9`}
              value={filters.startDate}
              onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
            />
          </div>
        </div>

        {/* Date To */}
        <div className="min-w-[140px]">
          <label className="mb-1 block text-xs font-semibold text-brand-600">To date</label>
          <div className="relative">
            <IconCalendar className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-brand-400" />
            <input
              type="date"
              className={`${inputClass} pl-9`}
              value={filters.endDate}
              onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
            />
          </div>
        </div>

        {/* Clear Filters */}
        {isActive && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50"
          >
            <IconClose className="h-4 w-4" />
            Clear
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-brand-400 self-center">
          <IconFilter className="h-4 w-4" />
          {isActive ? 'Filtered' : 'All circulars'}
        </div>
      </div>
    </div>
  );
}