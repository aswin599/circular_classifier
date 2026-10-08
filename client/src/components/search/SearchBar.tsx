import { useState, FormEvent, useEffect } from 'react';
import type { SearchFilters } from '../../types';
import Button from '../ui/Button';
import { IconSearch } from '../ui/Icons';

interface SearchBarProps {
  onSearch: (filters: SearchFilters) => void;
  initialQuery?: string;
}

export default function SearchBar({ onSearch, initialQuery = '' }: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    // Instant search triggered upon every single character entered
    onSearch({ q: val });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch({ q: query });
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2.5">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <IconSearch className="h-5 w-5 text-brand-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Type to search circulars instantly (by title, sender, content)..."
          className="w-full pl-11 pr-4 py-3 border border-brand-200 rounded-xl bg-white text-sm text-brand-900 placeholder-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-400 shadow-sm transition-all"
        />
      </div>
      <Button type="submit">Search</Button>
    </form>
  );
}