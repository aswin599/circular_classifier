import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { detectExpiry } from './expiryDetector';

describe('detectExpiry', () => {
  beforeEach(() => {
    // Fix "today" to 2026-09-04 for deterministic tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('detects "valid until DD/MM/YYYY"', () => {
    const result = detectExpiry(
      'This office order is valid until 30/11/2026 for all students.'
    );
    expect(result.expireDate).not.toBeNull();
    expect(result.expireDate!.toISOString().slice(0, 10)).toBe('2026-11-30');
    expect(result.expiryConfidence).toBeGreaterThan(90);
  });

  it('detects "last date" with text date', () => {
    const result = detectExpiry(
      'The last date for submission of applications is 15th November 2026.'
    );
    expect(result.expireDate).not.toBeNull();
    expect(result.expireDate!.toISOString().slice(0, 10)).toBe('2026-11-15');
    expect(result.matchedPhrase).toBe('last date');
  });

  it('detects "deadline" followed by a date', () => {
    const result = detectExpiry('Deadline: December 31, 2026 for fee payment.');
    expect(result.expireDate).not.toBeNull();
    expect(result.expireDate!.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('detects YYYY-MM-DD in "expires on"', () => {
    const result = detectExpiry('This circular expires on 2026-10-01.');
    expect(result.expireDate).not.toBeNull();
    expect(result.expireDate!.toISOString().slice(0, 10)).toBe('2026-10-01');
  });

  it('detects dot-separated DD.MM.YYYY dates (Indian circular format)', () => {
    const result = detectExpiry(
      'Submission of Hard Copy on or before 09.10.2026 - Reg.'
    );
    expect(result.expireDate).not.toBeNull();
    expect(result.expireDate!.toISOString().slice(0, 10)).toBe('2026-10-09');
    expect(result.matchedPhrase).toBe('On or Before');
  });

  it('detects dot-separated date embedded in a subject line', () => {
    const result = detectExpiry(
      'Faculty Interaction Session on 09.09.2026 @ 10.00 a.m. to 11.30 a.m.'
    );
    expect(result.expireDate).not.toBeNull();
    expect(result.expireDate!.toISOString().slice(0, 10)).toBe('2026-09-09');
  });

  it('ignores clock times that look like DD.MM shorts', () => {
    const result = detectExpiry('Session runs from 10.00 a.m. to 4.30 p.m. daily.');
    expect(result.expireDate).toBeNull();
  });

  it('ignores past dates near expiry phrases', () => {
    const result = detectExpiry('Application closed on 10/01/2025.');
    // The only date is in the past; no future expiry should be returned.
    expect(result.expireDate).toBeNull();
  });

  it('returns null when no date-like text present', () => {
    const result = detectExpiry('Please submit your form at the office.');
    expect(result.expireDate).toBeNull();
    expect(result.expiryConfidence).toBeNull();
  });

  it('falls back to earliest future date in deadline-related window', () => {
    const result = detectExpiry(
      'All departments must complete the audit. The relevant date of relevance is 20 December 2026 and reports are reviewed weekly.'
    );
    const today = new Date();
    expect(result.expireDate).not.toBeNull();
    expect(result.expireDate!.getFullYear()).toBe(2026);
  });

  it('detects multiple dates with different types and titles', () => {
    const text = `
      CIRCULAR - EXAMINATION SCHEDULE 2026
      1. Last date for online registration: 15/10/2026
      2. Last date for fee payment without fine: 20/10/2026
      3. Last date for fee payment with fine of Rs 500: 25/10/2026
      4. Date of examination: 05/11/2026
    `;
    const result = detectExpiry(text);
    expect(result.importantDates.length).toBeGreaterThanOrEqual(3);

    const types = result.importantDates.map((d) => d.dateType);
    expect(types).toContain('fee_without_fine');
    expect(types).toContain('fee_with_fine');

    const withoutFine = result.importantDates.find((d) => d.dateType === 'fee_without_fine');
    expect(withoutFine?.date.toISOString().slice(0, 10)).toBe('2026-10-20');

    const withFine = result.importantDates.find((d) => d.dateType === 'fee_with_fine');
    expect(withFine?.date.toISOString().slice(0, 10)).toBe('2026-10-25');
  });
});