import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { Circular } from '../../types';
import { useMarkCircularRead } from '../../hooks/useApi';
import Badge from '../ui/Badge';
import { formatDate } from '../../lib/expiry';
import { getSenderDisplay } from '../../lib/sender';
import { IconInbox, IconCalendar, IconClock, IconUser } from '../ui/Icons';
import CircularSummaryPopover from './CircularSummaryPopover';

interface CircularTableProps {
  circulars: Circular[];
}

export function getPriorityBadge(
  priority: string,
  isDuplicate?: boolean,
  duplicateTag?: string,
  fullWidth = false
) {
  const p = (priority || 'NORMAL').toUpperCase();
  const badgeClasses = fullWidth
    ? 'flex w-full items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm'
    : 'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-sm';

  let priorityBadge: React.ReactNode;
  if (p === 'HIGH' || p === 'URGENT') {
    priorityBadge = (
      <span className={`${badgeClasses} border-red-300 bg-red-100 text-red-800`}>
        <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
        High
      </span>
    );
  } else if (p === 'LOW') {
    priorityBadge = (
      <span className={`${badgeClasses} border-sky-300 bg-sky-100 text-sky-800`}>
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        Low
      </span>
    );
  } else {
    priorityBadge = (
      <span className={`${badgeClasses} border-amber-300 bg-amber-100 text-amber-800`}>
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Medium
      </span>
    );
  }

  const duplicateBadge = (
    <span className={`${badgeClasses} border-pink-300 bg-pink-100 text-pink-800`}>
      <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />
      {duplicateTag || 'Duplicate'}
    </span>
  );

  return (
    <div className={fullWidth ? 'flex w-full flex-col gap-1.5' : 'flex flex-wrap items-center gap-1.5'}>
      {priorityBadge}
      {isDuplicate && duplicateBadge}
    </div>
  );
}

// The "Removed successfully" overlay holds for 1000ms, then the row slides
// right (900ms), collapses (~650ms), and is dropped from the list.
const SLIDE_AT_MS = 1000;
const COLLAPSE_AT_MS = 1900;
const REMOVE_AT_MS = 2600;

export default function CircularTable({
  circulars,
}: CircularTableProps) {
  const navigate = useNavigate();
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [successIds, setSuccessIds] = useState<Set<string>>(() => new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());
  const { mutate: markCircularRead } = useMarkCircularRead();

  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const phaseTimers = useRef(
    new Map<string, {
      slide?: number;
      collapse?: number;
      remove?: number;
    }>()
  );

  const setRowRef = (id: string) => (el: HTMLTableRowElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };

  const clearPhaseTimers = (id: string) => {
    const timers = phaseTimers.current.get(id);
    if (timers) {
      if (timers.slide) window.clearTimeout(timers.slide);
      if (timers.collapse) window.clearTimeout(timers.collapse);
      if (timers.remove) window.clearTimeout(timers.remove);
      phaseTimers.current.delete(id);
    }
  };

  useEffect(() => {
    const map = phaseTimers.current;
    return () => {
      for (const timers of map.values()) {
        if (timers.slide) window.clearTimeout(timers.slide);
        if (timers.collapse) window.clearTimeout(timers.collapse);
        if (timers.remove) window.clearTimeout(timers.remove);
      }
      map.clear();
    };
  }, []);

  const visibleCirculars = circulars.filter((circular) => !readIds.has(circular.id));

  const handleMarkRead = (circular: Circular) => {
    if (
      readIds.has(circular.id) ||
      removingIds.has(circular.id) ||
      successIds.has(circular.id)
    ) {
      return;
    }

    const timers: {
      slide?: number;
      collapse?: number;
      remove?: number;
    } = {};
    phaseTimers.current.set(circular.id, timers);

    const revert = () => {
      clearPhaseTimers(circular.id);
      const row = rowRefs.current.get(circular.id);
      if (row) {
        row.classList.remove('cc-removing');
        row.style.transition = '';
        row.style.transform = '';
        row.style.opacity = '';
        row.style.overflow = '';
        row.style.height = '';
        for (const cell of row.cells) {
          cell.style.transition = '';
          cell.style.paddingTop = '';
          cell.style.paddingBottom = '';
        }
      }
      setSuccessIds((prev) => {
        const next = new Set(prev);
        next.delete(circular.id);
        return next;
      });
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(circular.id);
        return next;
      });
      toast.error('Could not mark circular as read');
    };

    markCircularRead(
      { id: circular.id },
      {
        // Success is shown inline by the animated overlay; no toast needed.
        onError: () => revert(),
      }
    );

    // Success overlay with popping check badge appears over the row content.
    setSuccessIds((prev) => new Set(prev).add(circular.id));

    // After the overlay holds, slide the whole row right and fade it out.
    timers.slide = window.setTimeout(() => {
      setRemovingIds((prev) => new Set(prev).add(circular.id));
    }, SLIDE_AT_MS);

    // Then collapse its height so the rows below flow smoothly upwards.
    timers.collapse = window.setTimeout(() => {
      const row = rowRefs.current.get(circular.id);
      if (row) {
        row.style.height = `${row.getBoundingClientRect().height}px`;
        void row.offsetHeight;
        row.style.transition = 'height 650ms cubic-bezier(0.2, 0.8, 0.2, 1)';
        row.style.overflow = 'hidden';
        for (const cell of row.cells) {
          cell.style.transition = 'padding 650ms cubic-bezier(0.2, 0.8, 0.2, 1)';
          cell.style.paddingTop = '0px';
          cell.style.paddingBottom = '0px';
        }
        requestAnimationFrame(() => {
          row.style.height = '0px';
        });
      }
    }, COLLAPSE_AT_MS);

    // Finally drop the row from the list entirely.
    timers.remove = window.setTimeout(() => {
      clearPhaseTimers(circular.id);
      rowRefs.current.delete(circular.id);
      setReadIds((prev) => new Set(prev).add(circular.id));
      setSuccessIds((prev) => {
        const next = new Set(prev);
        next.delete(circular.id);
        return next;
      });
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(circular.id);
        return next;
      });
    }, REMOVE_AT_MS);
  };

  if (visibleCirculars.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-white/70 px-6 py-16 text-center shadow-card">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-500">
          <IconInbox className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold text-brand-900">No circulars found</p>
        <p className="mt-1 text-xs text-brand-400 max-w-sm">
          Try adjusting your search terms or filter selections to view relevant announcements.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-brand-100">
          <thead>
            <tr className="bg-brand-50/70">
              <th className="w-24 whitespace-nowrap px-3 py-3.5 text-left text-sm font-bold uppercase tracking-wider text-brand-600">
                Mark as Read
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-bold uppercase tracking-wider text-brand-600">
                Category
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-bold uppercase tracking-wider text-brand-600">
                Sender
              </th>
              <th className="px-3 py-3.5 text-left text-sm font-bold uppercase tracking-wider text-brand-600">
                Title
              </th>
              <th className="w-36 whitespace-nowrap px-3 py-3.5 text-left text-sm font-bold uppercase tracking-wider text-brand-600">
                Priority
              </th>
              <th className="w-36 whitespace-nowrap px-3 py-3.5 text-left text-sm font-bold uppercase tracking-wider text-brand-600">
                Received Date
              </th>
              <th className="w-36 whitespace-nowrap px-3 py-3.5 text-left text-sm font-bold uppercase tracking-wider text-brand-600">
                Due Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-50">
            {visibleCirculars.map((circular) => {
              const categoryName = circular.category?.name ?? 'General';
              const categoryColor = circular.category?.color ?? '#8B5CF6';
              const displayTitle = circular.shortTitle || circular.subject;
              const sender = getSenderDisplay(circular);

              // Find duplicate tag if present
              const dupTag = circular.tags?.find((t) => t.toLowerCase().includes('duplicate'));

              return (
                <tr
                  key={circular.id}
                  ref={setRowRef(circular.id)}
                  className={`group relative transition-colors duration-150 hover:bg-brand-50/80 ${
                    removingIds.has(circular.id) ? 'cc-removing' : ''
                  }`}
                >
                  {/* Mark as Read Column */}
                  <td className="whitespace-nowrap px-3 py-4 align-top">
                    <label
                      className="inline-flex cursor-pointer items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => handleMarkRead(circular)}
                        className="h-4 w-4 cursor-pointer rounded border-brand-300 text-brand-600 focus:ring-brand-500"
                        aria-label={`Mark "${displayTitle}" as read`}
                      />
                      <span className="text-xs font-medium text-brand-500">Read</span>
                    </label>
                  </td>

                  {/* Category Column */}
                  <td className="whitespace-nowrap px-3 py-4 align-top">
                    <Badge color={categoryColor} size="md" className="w-full justify-center">
                      {categoryName}
                    </Badge>
                  </td>

                  {/* Sender Column (between category and title) */}
                  <td className="px-3 py-4 align-top min-w-[110px]">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-semibold text-xs">
                        <IconUser className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-900 truncate">{sender.primary}</p>
                        {sender.secondary && (
                          <p className="text-xs text-brand-400 truncate">{sender.secondary}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Title Column with 1.5s Hover Summary */}
                  <td className="px-3 py-4 align-top min-w-0 max-w-[26rem]">
                    <CircularSummaryPopover circular={circular}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/circulars/${circular.id}`);
                        }}
                        className="block w-full truncate text-left text-base font-bold text-brand-900 transition-colors group-hover:text-brand-600"
                      >
                        {displayTitle}
                      </button>

                      {/* Full original subject */}
                      <p className="mt-1 text-sm text-brand-500 line-clamp-1 leading-relaxed">
                        {circular.subject}
                      </p>
                    </CircularSummaryPopover>
                  </td>

                  {/* Priority Column (priority + duplicate tags) */}
                  <td className="w-36 whitespace-nowrap px-3 py-4 align-top">
                    {getPriorityBadge(circular.priority, circular.isDuplicate, dupTag, true)}
                  </td>

                  {/* Received Date Column */}
                  <td className="w-36 whitespace-nowrap px-3 py-4 align-top text-sm text-brand-700 font-medium">
                    <span className="flex items-center gap-1.5">
                      <IconCalendar className="h-4 w-4 text-brand-300" />
                      {formatDate(circular.receivedDate)}
                    </span>
                  </td>

                  {/* Due Date Column */}
                  <td className="w-36 whitespace-nowrap px-3 py-4 align-top">
                    {circular.expireDate ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-1 text-xs font-semibold text-amber-800">
                        <IconClock className="h-3.5 w-3.5 text-amber-600" />
                        {formatDate(circular.expireDate)}
                      </span>
                    ) : (
                      <span className="text-sm font-normal text-neutral-400">No deadline</span>
                    )}
                  </td>

                  {/* Success overlay (check badge pops in over the row) */}
                  {successIds.has(circular.id) && (
                    <td colSpan={7} className="cc-success-overlay">
                      <span className="cc-success">
                        <span className="cc-check">✓</span>
                        <span className="cc-success-text">Removed successfully</span>
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}