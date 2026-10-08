import React, { useState, useRef, useEffect } from 'react';
import type { Circular } from '../../types';

interface CircularSummaryPopoverProps {
  circular: Circular;
  children: React.ReactNode;
  className?: string;
}

export default function CircularSummaryPopover({
  circular,
  children,
  className = '',
}: CircularSummaryPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const popoverHeight = 140;
        const popoverWidth = 340;
        const showAbove = rect.bottom + popoverHeight > window.innerHeight && rect.top > popoverHeight;
        const top = showAbove
          ? Math.max(8, rect.top - popoverHeight - 8)
          : Math.min(window.innerHeight - popoverHeight - 8, rect.bottom + 6);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8));
        setCoords({ top, left });
        setIsOpen(true);
      }
    }, 750);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 3 crisp content bullets — prefer stored summaryBullets (minus deadline /
  // issuer / priority noise from legacy data), fall back to a content summary.
  const CONTENT_NOISE_RE =
    /\b(due\s*date|deadline|issued\s*by|office\s+of|priority|expires|expiry|high\s+priority)\b/i;

  const contentBullets: string[] = (circular.summaryBullets || [])
    .map((b) => b.trim())
    .filter((b) => b && !CONTENT_NOISE_RE.test(b));

  const fallbackBullets: string[] = [
    `Circular: ${circular.shortTitle || circular.subject}`,
    circular.bodyText
      ? circular.bodyText.slice(0, 140).trim() + '...'
      : 'Refer to the attached document for complete details.',
    'Review the notice for eligibility, guidelines and the action required.',
  ];

  const bullets: string[] = contentBullets.length > 0
    ? contentBullets.slice(0, 3)
    : fallbackBullets.slice(0, 3);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative block ${className}`}
    >
      {children}

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 9999,
            width: '340px',
          }}
          className="rounded-lg border border-brand-200 bg-white shadow-lg p-3.5 pointer-events-none"
        >
          <ul className="space-y-2">
            {bullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-brand-800 leading-snug">
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <span className="font-medium">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
