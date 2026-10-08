import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCircularStream } from '../../lib/realtime';
import type { NewCircularEvent } from '../../lib/realtime';
import { IconClose, IconClock, IconMail } from '../ui/Icons';
import { formatDate } from '../../lib/expiry';

interface ActiveNotification {
  key: string;
  subject: string;
  categoryName?: string;
  receivedDate?: string;
  excerpt?: string;
}

const AUTO_DISMISS_MS = 5000;

export default function NewCircularNotification() {
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<ActiveNotification[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = (key: string) => {
    const timer = timers.current.get(key);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(key);
    }
    setNotifications((prev) => prev.filter((n) => n.key !== key));
  };

  useCircularStream((event: NewCircularEvent) => {
    const key = `${event.id}-${Date.now()}`;
    setNotifications((prev) => [{ ...event, key }, ...prev].slice(0, 4));

    const timer = setTimeout(() => dismiss(key), AUTO_DISMISS_MS);
    timers.current.set(key, timer);

    queryClient.invalidateQueries({ queryKey: ['circulars'], refetchType: 'all' });
    queryClient.invalidateQueries({ queryKey: ['stats'], refetchType: 'all' });
  });

  useEffect(() => {
    const map = timers.current;
    const keys = notifications.map((n) => n.key);
    return () => {
      keys.forEach((k) => {
        const timer = map.get(k);
        if (timer) clearTimeout(timer);
      });
      map.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[99999] flex w-80 flex-col gap-3" role="region" aria-live="assertive">
      {notifications.map((n) => (
        <div
          key={n.key}
          className="animate-slide-in-right rounded-xl border border-brand-100 bg-white p-4 shadow-card-hover"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <IconMail className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                  {n.categoryName ?? 'New circular'}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                  <IconClock className="h-3 w-3" />
                  {formatDate(n.receivedDate)}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-brand-900 line-clamp-2">{n.subject}</p>
              {n.excerpt && <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{n.excerpt}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(n.key)}
              className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
              aria-label="Dismiss notification"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-brand-50">
            <div className="h-full animate-[notify-progress_5s_linear_both] rounded-full bg-brand-300" />
          </div>
        </div>
      ))}
    </div>
  );
}