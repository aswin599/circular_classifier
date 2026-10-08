import { useState } from 'react';
import Button from '../ui/Button';
import { IconChevronDown, IconClose, IconFilter } from '../ui/Icons';
import type { Category, Priority, SearchFilters } from '../../types';

interface FilterPanelProps {
  categories: Category[];
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onReset: () => void;
}

const priorities: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const inputClasses =
  'w-full px-3 py-2 border border-brand-200 rounded-lg bg-white text-sm text-brand-900 placeholder-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400';

export default function FilterPanel({ categories, filters, onChange, onReset }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof SearchFilters, value: unknown) => {
    onChange({ ...filters, [key]: value === '' ? undefined : value });
  };

  const hasActiveFilters = !!(
    filters.categoryId ||
    filters.priority ||
    filters.startDate ||
    filters.endDate ||
    filters.tag
  );

  const controls = (
    <div className="flex flex-wrap items-end gap-3">
      {/* Category */}
      <div className="min-w-[180px] flex-1">
        <label className="mb-1 block text-xs font-semibold text-brand-600">Category</label>
        <select
          value={filters.categoryId ?? ''}
          onChange={(e) => updateFilter('categoryId', e.target.value)}
          className={inputClasses}
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div className="min-w-[150px] flex-1">
        <label className="mb-1 block text-xs font-semibold text-brand-600">Priority</label>
        <select
          value={filters.priority ?? ''}
          onChange={(e) => updateFilter('priority', e.target.value as Priority)}
          className={inputClasses}
        >
          <option value="">All priorities</option>
          {priorities.map((p) => (
            <option key={p} value={p}>
              {p === 'NORMAL' ? 'Medium' : p[0] + p.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Tag */}
      <div className="min-w-[160px] flex-1">
        <label className="mb-1 block text-xs font-semibold text-brand-600">Tag</label>
        <input
          type="text"
          value={filters.tag ?? ''}
          onChange={(e) => updateFilter('tag', e.target.value)}
          placeholder="e.g., final, schedule"
          className={inputClasses}
        />
      </div>

      {/* From date */}
      <div className="min-w-[150px] flex-1">
        <label className="mb-1 block text-xs font-semibold text-brand-600">From date</label>
        <input
          type="date"
          value={filters.startDate ?? ''}
          onChange={(e) => updateFilter('startDate', e.target.value)}
          className={inputClasses}
        />
      </div>

      {/* To date */}
      <div className="min-w-[150px] flex-1">
        <label className="mb-1 block text-xs font-semibold text-brand-600">To date</label>
        <input
          type="date"
          value={filters.endDate ?? ''}
          onChange={(e) => updateFilter('endDate', e.target.value)}
          className={inputClasses}
        />
      </div>

      {/* Apply */}
      <Button onClick={() => onChange({ ...filters })} className="min-w-[120px]" size="sm">
        Apply Filters
      </Button>
    </div>
  );

  return (
    <div className="animate-fade-in-down w-full rounded-2xl border border-brand-100 bg-white shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-brand-900 flex items-center gap-2">
          <IconFilter className="h-4 w-4 text-brand-400" />
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-700"
          >
            <IconClose className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full md:hidden flex items-center justify-between text-sm text-brand-700"
      >
        <span>Advanced filters {hasActiveFilters ? '(active)' : ''}</span>
        <IconChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <div className={`${isOpen ? 'block' : 'hidden'} md:block`}>{controls}</div>
    </div>
  );
}