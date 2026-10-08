import { describe, it, expect } from 'vitest';
import { isCircularEmail, CIRCULAR_SEARCH_TERMS } from './circularFilter';
import { buildCircularSearchQuery } from './googleService';

describe('circular fetch pre-filter', () => {
  it('exports circular search terms for fetch-layer filtering', () => {
    expect(Array.isArray(CIRCULAR_SEARCH_TERMS)).toBe(true);
    expect(CIRCULAR_SEARCH_TERMS.length).toBeGreaterThanOrEqual(20);
    expect(CIRCULAR_SEARCH_TERMS).toContain('circular');
    expect(CIRCULAR_SEARCH_TERMS).toContain('notice');
    expect(CIRCULAR_SEARCH_TERMS).toContain('last date');
  });

  it('builds a Gmail query scoped to inbox with quoted multi-word phrases', () => {
    const q = buildCircularSearchQuery();
    expect(q.startsWith('in:inbox (')).toBe(true);
    expect(q.endsWith(')')).toBe(true);
    expect(q.includes('"office order"')).toBe(true);
    expect(q.includes('circular')).toBe(true);
  });
});

describe('circularFilter', () => {
  it('identifies official academic circular with attachment as circular', () => {
    const email = {
      subject: 'CIRCULAR: Odd Semester End Examinations Schedule November 2026',
      bodyText: 'All students are hereby informed that the end semester examinations will commence from 15-11-2026.',
      attachments: [{ filename: 'Exam_Schedule_2026.pdf', fileType: 'pdf' }],
    };
    const result = isCircularEmail(email);
    expect(result.isCircular).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(35);
  });

  it('identifies fee payment notice with PDF attachment', () => {
    const email = {
      subject: 'Notice: Last Date for Fee Payment without Fine',
      bodyText: 'It is hereby notified that the last date for fee payment without fine is 20th October 2026.',
      attachments: [{ filename: 'Fee_Circular.pdf', fileType: 'pdf' }],
    };
    const result = isCircularEmail(email);
    expect(result.isCircular).toBe(true);
  });

  it('rejects marketing / promo emails', () => {
    const email = {
      subject: 'Special 50% discount on Zomato food delivery this weekend!',
      bodyText: 'Order your favorite meal today and save big.',
      attachments: [],
    };
    const result = isCircularEmail(email);
    expect(result.isCircular).toBe(false);
  });

  it('rejects OTP and account security emails', () => {
    const email = {
      subject: 'Your OTP is 492810 for sign-in',
      bodyText: 'Do not share this code with anyone. Valid for 5 minutes.',
      attachments: [],
    };
    const result = isCircularEmail(email);
    expect(result.isCircular).toBe(false);
  });

  it('rejects casual personal emails without circular indicators', () => {
    const email = {
      subject: 'Are we still meeting for lunch today?',
      bodyText: 'Hey, let me know if you are free around 1 PM.',
      attachments: [],
    };
    const result = isCircularEmail(email);
    expect(result.isCircular).toBe(false);
  });
});
