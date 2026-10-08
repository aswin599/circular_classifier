import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import Badge from '../ui/Badge';
import { IconClock, IconSearch } from '../ui/Icons';
import type { Circular } from '../../types';
import CircularSummaryPopover from '../circulars/CircularSummaryPopover';
import { getPriorityBadge } from '../circulars/CircularTable';
import { getSenderDisplay } from '../../lib/sender';

interface SearchResultsProps {
  circulars: Circular[];
  loading?: boolean;
}

export default function SearchResults({ circulars, loading = false }: SearchResultsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-brand-100 bg-white p-5 shadow-card">
            <div className="h-4 bg-brand-100 rounded w-3/4 mb-3" />
            <div className="h-3 bg-brand-50 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (circulars.length === 0) {
    return (
      <div className="animate-fade-in rounded-2xl border border-dashed border-brand-200 bg-white/70 p-12 text-center shadow-card">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-400">
          <IconSearch className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-brand-900">No circulars match your search</h3>
        <p className="mt-1 text-xs text-brand-400">Try modifying your query or clearing applied filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {circulars.map((circular) => {
        const displayTitle = circular.shortTitle || circular.subject;
        const dupTag = circular.tags?.find((t) => t.toLowerCase().includes('duplicate'));
        const sender = getSenderDisplay(circular);

        return (
          <div
            key={circular.id}
            className="animate-fade-in-up rounded-2xl border border-brand-100 bg-white p-5 shadow-card hover:shadow-card-hover transition-all duration-150"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Title with 1.5s hover popover */}
                <CircularSummaryPopover circular={circular}>
                  <Link
                    to={`/circulars/${circular.id}`}
                    className="text-base font-bold text-brand-950 hover:text-brand-600 transition-colors block line-clamp-1"
                  >
                    {displayTitle}
                  </Link>
                  <p className="mt-1 text-xs text-brand-500 line-clamp-1">
                    {circular.subject}
                  </p>
                </CircularSummaryPopover>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-brand-400">
                  <span className="font-semibold text-brand-700">
                    {sender.primary}
                  </span>
                  <span>•</span>
                  <span>Received {format(new Date(circular.receivedDate), 'MMM d, yyyy')}</span>

                  {circular.expireDate && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <IconClock className="h-3 w-3 text-amber-600" />
                        Due: {format(new Date(circular.expireDate), 'MMM d, yyyy')}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Badges: Category & Priority */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                {circular.category ? (
                  <Badge color={circular.category.color} size="sm">
                    {circular.category.name}
                  </Badge>
                ) : (
                  <Badge color="#8B5CF6" size="sm">
                    General
                  </Badge>
                )}

                {getPriorityBadge(circular.priority, circular.isDuplicate, dupTag)}
              </div>
            </div>

            {(circular.extractedText || circular.bodyText) && (
              <p className="mt-3 text-xs text-brand-700/80 line-clamp-2 leading-relaxed bg-brand-50/50 p-2.5 rounded-xl border border-brand-100">
                {(circular.extractedText || circular.bodyText)?.slice(0, 200)}...
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}