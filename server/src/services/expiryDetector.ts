import { logger } from '../utils/logger';

export type ImportantDateType =
  | 'last_date'
  | 'fee_without_fine'
  | 'fee_with_fine'
  | 'submission_deadline'
  | 'exam_date'
  | 'commencement'
  | 'expiry'
  | 'event_date'
  | 'general';

export interface DetectedDateItem {
  title: string;
  date: Date;
  dateType: ImportantDateType;
  rawText: string;
  confidence: number;
}

export interface ExpiryDetectionResult {
  expireDate: Date | null;
  expirySource: string | null;
  expiryConfidence: number | null;
  matchedPhrase: string | null;
  lastDateWithoutFine?: Date | null;
  lastDateWithFine?: Date | null;
  importantDates: DetectedDateItem[];
}

// Month name mapping for text dates
const MONTHS: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

export interface FoundDate {
  date: Date;
  index: number;
  length: number;
  raw: string;
}

export function parseDateCandidates(raw: string): Date | null {
  // Strip leading "the", trailing punctuation, and stray commas/semicolons/parens.
  // IMPORTANT: do NOT strip dots that sit between digits, otherwise dot-separated
  // dates like "09.10.2026" are mangled into "09102026" and never parse.
  let trimmed = raw.trim().replace(/^the\s+/i, '');
  trimmed = trimmed.replace(/[;\\)]+/g, '').replace(/,/g, ' ').trim();
  // Remove periods only when they are NOT part of a numeric date (e.g. "Jan. 15th")
  trimmed = trimmed.replace(/\.(?=\D|$)/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = trimmed.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    const year = parseInt(dmy[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    if (day > 12) {
      const d = new Date(year, month - 1, day, 12, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
    const d1 = new Date(year, month - 1, day, 12, 0, 0);
    const d2 = new Date(year, day - 1, month, 12, 0, 0);
    if (!isNaN(d1.getTime()) && d1.getFullYear() === year && d1.getMonth() === month - 1) {
      return d1;
    }
    if (!isNaN(d2.getTime()) && d2.getFullYear() === year && d2.getMonth() === day - 1) {
      return d2;
    }
    return null;
  }

  // 2. YYYY-MM-DD
  const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const d = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  // 3. D Month YYYY and "Dth/1st/2nd/3rd Month YYYY" (e.g. "15th January 2026")
  const dMonY = trimmed.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]{3,9})\s+(\d{4})$/);
  if (dMonY) {
    const month = MONTHS[dMonY[2].toLowerCase()];
    if (month !== undefined) {
      const d = new Date(parseInt(dMonY[3], 10), month, parseInt(dMonY[1], 10), 12, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // 4. Month D, YYYY and Month Dth, YYYY (e.g. "January 15, 2026", "January 15th, 2026")
  const monDY = trimmed.match(/^([a-zA-Z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})$/);
  if (monDY) {
    const month = MONTHS[monDY[1].toLowerCase()];
    if (month !== undefined) {
      const d = new Date(parseInt(monDY[3], 10), month, parseInt(monDY[2], 10), 12, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // 5. Month YYYY (e.g. "January 2026") as a last-date month shorthand
  const monY = trimmed.match(/^([a-zA-Z]{3,9})\s+(\d{4})$/);
  if (monY) {
    const month = MONTHS[monY[1].toLowerCase()];
    if (month !== undefined) {
      const lastDay = new Date(parseInt(monY[2], 10), month + 1, 0, 12, 0, 0);
      return isNaN(lastDay.getTime()) ? null : lastDay;
    }
  }

  // 6. DD/MM (current year implied)
  const dmyShort = trimmed.match(/^(\d{1,2})[\/\.\-](\d{1,2})$/);
  if (dmyShort) {
    const day = parseInt(dmyShort[1], 10);
    const month = parseInt(dmyShort[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const year = new Date().getFullYear();
    const d = new Date(year, month - 1, day, 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function findAllDates(text: string): FoundDate[] {
  const results: FoundDate[] = [];
  const lower = text.toLowerCase();

  // Skip matches that are clearly clock times (e.g. "10.00 a.m.", "4.30 p.m.", "09.10 hours")
  const isTimeLike = (m: RegExpExecArray): boolean => {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 8).toLowerCase();
    return /^\s*(?:[ap]m|a\.?m\.?|p\.?m\.?|hours|hrs?)[.\s,]/.test(after);
  };

  // Numeric dates
  const numericRe = /(\b\d{1,2}[/\.\-]\d{1,2}[/\.\-]\d{4}\b|\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/\.\-]\d{1,2}\b)/g;
  let match: RegExpExecArray | null;
  while ((match = numericRe.exec(text)) !== null) {
    if (isTimeLike(match)) continue;
    const date = parseDateCandidates(match[0]);
    if (date) {
      results.push({ date, index: match.index, length: match[0].length, raw: match[0] });
    }
  }

  // "D Month YYYY"
  const monRe = /(?:\b\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]{3,9},\s*\d{4}\b|\b\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]{3,9}\s+\d{4}\b|\b[a-zA-Z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b)/g;
  while ((match = monRe.exec(text)) !== null) {
    const m = match;
    if (/@/.test(text.slice(Math.max(0, m.index - 2), m.index + m[0].length))) {
      continue;
    }
    const date = parseDateCandidates(m[0]);
    if (date && !results.some((r) => Math.abs(r.index - m.index) < 3)) {
      results.push({ date, index: m.index, length: m[0].length, raw: m[0] });
    }
  }

  // "Month YYYY" (avoid re-parsing already matched)
  const monYRe = /\b[a-zA-Z]{3,9}\s+\d{4}\b/g;
  while ((match = monYRe.exec(lower)) !== null) {
    const m = match;
    if (results.some((r) => r.index === m.index)) continue;
    if (/@/.test(text.slice(Math.max(0, m.index - 2), m.index + m[0].length))) continue;
    const date = parseDateCandidates(m[0]);
    if (date) {
      results.push({ date, index: m.index, length: m[0].length, raw: m[0] });
    }
  }

  return results.sort((a, b) => a.index - b.index);
}

export function detectFeePaymentDates(text: string): {
  lastDateWithoutFine: Date | null;
  lastDateWithFine: Date | null;
} {
  let lastDateWithoutFine: Date | null = null;
  let lastDateWithFine: Date | null = null;

  if (!text) return { lastDateWithoutFine, lastDateWithFine };

  // Detect "without fine" date
  const withoutFineMatch = text.match(
    /(?:last\s+date\s+(?:for\s+fee\s+payment\s+)?without\s+(?:late\s+)?fine)[^\d]*(\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]{3,9}(?:,)?\s+\d{4}|\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4})/i
  );
  if (withoutFineMatch) {
    lastDateWithoutFine = parseDateCandidates(withoutFineMatch[1]);
  }

  // Detect "with fine" date
  const withFineMatch = text.match(
    /(?:last\s+date\s+(?:for\s+fee\s+payment\s+)?with\s+(?:late\s+)?fine)[^\d]*(\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]{3,9}(?:,)?\s+\d{4}|\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{4})/i
  );
  if (withFineMatch) {
    lastDateWithFine = parseDateCandidates(withFineMatch[1]);
  }

  return { lastDateWithoutFine, lastDateWithFine };
}

// Patterns for detecting multiple important dates with contextual title
const DATE_PATTERN_DEFINITIONS: {
  regex: RegExp;
  title: string;
  type: ImportantDateType;
  confidence: number;
}[] = [
  // Fee payment with fine
  {
    regex: /(?:last\s+date\s+(?:for\s+(?:fee\s+payment|payment\s+of\s+fee|examination\s+fee)\s+)?with\s+(?:late\s+)?fine(?:\s+of\s+rs\.?\s*\d+)?)/gi,
    title: 'Last Date for Fee Payment (With Fine)',
    type: 'fee_with_fine',
    confidence: 98,
  },
  // Fee payment without fine
  {
    regex: /(?:last\s+date\s+(?:for\s+(?:fee\s+payment|payment\s+of\s+fee|examination\s+fee)\s+)?without\s+(?:late\s+)?fine)/gi,
    title: 'Last Date for Fee Payment (Without Fine)',
    type: 'fee_without_fine',
    confidence: 98,
  },
  // Online registration / application last date
  {
    regex: /(?:last\s+date\s+(?:for|of)\s+(?:online\s+)?(?:submission\s+of\s+)?(?:applications?|registration|admissions?|enrolment|filling\s+up\s+of\s+forms?))/gi,
    title: 'Last Date for Online Application / Registration',
    type: 'last_date',
    confidence: 95,
  },
  // Hard copy / document submission
  {
    regex: /(?:last\s+date\s+(?:for|of)\s+(?:submission\s+of\s+)?(?:hard\s+cop(?:y|ies)|documents?|certificates?|thesis|synopsis|reports?))/gi,
    title: 'Last Date for Hard Copy / Document Submission',
    type: 'submission_deadline',
    confidence: 94,
  },
  // Exam dates
  {
    regex: /(?:date\s+of\s+(?:commencement\s+of\s+)?(?:the\s+)?(?:written\s+|practical\s+|theory\s+)?(?:examinations?|exams?|entrance\s+test)|examinations?\s+commences?\s+(?:from|on)|exams?\s+start\s+(?:from|on))/gi,
    title: 'Date of Examination',
    type: 'exam_date',
    confidence: 94,
  },
  // Class commencement / semester start
  {
    regex: /(?:commencement\s+of\s+(?:classes|academic\s+session|semester|instruction)|classes\s+(?:re)?commence\s+(?:from|on)|reopening\s+of\s+(?:college|institution|classes))/gi,
    title: 'Commencement of Classes',
    type: 'commencement',
    confidence: 92,
  },
  // Hall ticket / admit card
  {
    regex: /(?:download(?:ing)?\s+of\s+(?:hall\s+ticket|admit\s+card)s?|issue\s+of\s+(?:hall\s+ticket|admit\s+card)s?)/gi,
    title: 'Hall Ticket / Admit Card Release',
    type: 'event_date',
    confidence: 90,
  },
  // Valid until / validity
  {
    regex: /(?:valid\s+until|valid\s+till|valid\s+upto|valid\s+up\s+to|validity\s+until|validity\s+upto|validity\s+date)/gi,
    title: 'Valid Until',
    type: 'expiry',
    confidence: 95,
  },
  // Expires on / expiration
  {
    regex: /(?:expires?\s+on|expiry\s+date|expiration\s+date)/gi,
    title: 'Expiry Date',
    type: 'expiry',
    confidence: 95,
  },
  // Submission deadline / closing date
  {
    regex: /(?:submission\s+deadline|closing\s+date|closing\s+day|submission\s+date)/gi,
    title: 'Submission Deadline',
    type: 'submission_deadline',
    confidence: 92,
  },
  // General deadline
  {
    regex: /(?:deadline\s*(?::|is|for|to)?|due\s+date\s*(?::|is|for|to)?)/gi,
    title: 'Deadline',
    type: 'submission_deadline',
    confidence: 90,
  },
  // General last date / last day
  {
    regex: /(?:last\s+date\s*(?::|is|for|to)?|last\s+day\s*(?::|is|for|to)?|final\s+date\s*(?::|is|for|to)?)/gi,
    title: 'Last Date',
    type: 'last_date',
    confidence: 88,
  },
  // On or before
  {
    regex: /(?:on\s+or\s+before)/gi,
    title: 'On or Before',
    type: 'last_date',
    confidence: 85,
  },
];

/**
 * Detect all important expiry, deadline, fee payment, and examination dates
 * present in the circular text.
 */
export function detectMultipleDates(text: string | null | undefined): DetectedDateItem[] {
  if (!text || !text.trim()) {
    return [];
  }

  const allFoundDates = findAllDates(text);
  if (allFoundDates.length === 0) {
    return [];
  }

  const detected: DetectedDateItem[] = [];
  const claimedDateTimestamps = new Set<string>();

  // 1. Fee payment specific dates
  const feeDates = detectFeePaymentDates(text);
  if (feeDates.lastDateWithoutFine) {
    const key = `fee_without_fine-${feeDates.lastDateWithoutFine.getTime()}`;
    if (!claimedDateTimestamps.has(key)) {
      claimedDateTimestamps.add(key);
      detected.push({
        title: 'Last Date for Fee Payment (Without Fine)',
        date: feeDates.lastDateWithoutFine,
        dateType: 'fee_without_fine',
        rawText: 'Last date for fee payment without fine',
        confidence: 98,
      });
    }
  }
  if (feeDates.lastDateWithFine) {
    const key = `fee_with_fine-${feeDates.lastDateWithFine.getTime()}`;
    if (!claimedDateTimestamps.has(key)) {
      claimedDateTimestamps.add(key);
      detected.push({
        title: 'Last Date for Fee Payment (With Fine)',
        date: feeDates.lastDateWithFine,
        dateType: 'fee_with_fine',
        rawText: 'Last date for fee payment with fine',
        confidence: 98,
      });
    }
  }

  // 2. Scan defined date patterns in the text
  for (const def of DATE_PATTERN_DEFINITIONS) {
    const re = new RegExp(def.regex.source, def.regex.flags.replace('g', '') + 'g');
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
      const phraseStart = match.index;
      const phraseEnd = match.index + match[0].length;

      // Look for a date within 120 characters following the phrase
      const followingDates = allFoundDates.filter(
        (d) => d.index >= phraseEnd - 2 && d.index <= phraseEnd + 120
      );

      // Or a date right before within 40 characters (e.g. "15-10-2026 is the last date")
      const precedingDates = allFoundDates.filter(
        (d) => d.index + d.length >= phraseStart - 40 && d.index + d.length <= phraseStart + 2
      );

      const candidate = followingDates[0] || precedingDates[precedingDates.length - 1];

      if (candidate) {
        const key = `${def.type}-${candidate.date.getTime()}`;
        if (!claimedDateTimestamps.has(key)) {
          claimedDateTimestamps.add(key);

          const snippetStart = Math.max(0, Math.min(phraseStart, candidate.index) - 10);
          const snippetEnd = Math.min(
            text.length,
            Math.max(phraseEnd, candidate.index + candidate.length) + 10
          );
          const snippet = text.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ').trim();

          detected.push({
            title: def.title,
            date: candidate.date,
            dateType: def.type,
            rawText: snippet,
            confidence: def.confidence,
          });
        }
      }
    }
  }

  // 3. Tabular milestone lines (e.g. "1. Last Date of Submission : 25-10-2026")
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 5 || trimmed.length > 180) continue;

    // Line has a colon separating a title and date
    const colonMatch = trimmed.match(/^([a-zA-Z0-9\s\(\)\/._-]{3,50})\s*[:=-]\s*(.+)$/);
    if (colonMatch) {
      const potentialTitle = colonMatch[1].replace(/^\d+[\.\)]\s*/, '').trim();
      const afterColon = colonMatch[2];
      const datesInLine = findAllDates(afterColon);

      if (datesInLine.length > 0) {
        const candidateDate = datesInLine[0].date;
        const key = `table-${candidateDate.getTime()}`;

        if (!claimedDateTimestamps.has(key)) {
          // Check if title has date-relevant meaning
          const lowerTitle = potentialTitle.toLowerCase();
          const isDateRelevant =
            lowerTitle.includes('date') ||
            lowerTitle.includes('deadline') ||
            lowerTitle.includes('submission') ||
            lowerTitle.includes('exam') ||
            lowerTitle.includes('registration') ||
            lowerTitle.includes('application') ||
            lowerTitle.includes('commencement') ||
            lowerTitle.includes('start') ||
            lowerTitle.includes('end') ||
            lowerTitle.includes('close') ||
            lowerTitle.includes('schedule');

          if (isDateRelevant) {
            claimedDateTimestamps.add(key);
            let dateType: ImportantDateType = 'general';
            if (lowerTitle.includes('without fine')) dateType = 'fee_without_fine';
            else if (lowerTitle.includes('with fine')) dateType = 'fee_with_fine';
            else if (lowerTitle.includes('exam')) dateType = 'exam_date';
            else if (lowerTitle.includes('deadline') || lowerTitle.includes('submission'))
              dateType = 'submission_deadline';
            else if (lowerTitle.includes('last date')) dateType = 'last_date';

            detected.push({
              title: potentialTitle,
              date: candidateDate,
              dateType,
              rawText: trimmed,
              confidence: 85,
            });
          }
        }
      }
    }
  }

  // Deduplicate dates on the same calendar day
  const typeRank: Record<ImportantDateType, number> = {
    fee_with_fine: 10,
    fee_without_fine: 9,
    exam_date: 8,
    submission_deadline: 7,
    last_date: 6,
    commencement: 5,
    event_date: 4,
    expiry: 3,
    general: 1,
  };

  const byDay = new Map<string, DetectedDateItem[]>();
  for (const item of detected) {
    const dayKey = item.date.toISOString().slice(0, 10);
    const existing = byDay.get(dayKey) || [];
    existing.push(item);
    byDay.set(dayKey, existing);
  }

  const deduplicated: DetectedDateItem[] = [];
  for (const items of byDay.values()) {
    items.sort((a, b) => {
      const rankA = typeRank[a.dateType] || 0;
      const rankB = typeRank[b.dateType] || 0;
      if (rankA !== rankB) return rankB - rankA;
      return b.confidence - a.confidence;
    });
    deduplicated.push(items[0]);
  }

  // Sort chronologically by date
  return deduplicated.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Detect the primary expiry / last date of a circular from combined text,
 * while also returning all multiple important dates found.
 */
export function detectExpiry(text: string | null | undefined): ExpiryDetectionResult {
  const none: ExpiryDetectionResult = {
    expireDate: null,
    expirySource: null,
    expiryConfidence: null,
    matchedPhrase: null,
    lastDateWithoutFine: null,
    lastDateWithFine: null,
    importantDates: [],
  };

  if (!text || !text.trim()) {
    return none;
  }

  const feeDates = detectFeePaymentDates(text);
  const multipleDates = detectMultipleDates(text);
  const allFoundDates = findAllDates(text);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let primaryExpireDate: Date | null = null;
  let primarySource: string | null = null;
  let primaryConfidence: number | null = null;
  let primaryPhrase: string | null = null;

  // Priority 1: Pick from detected important dates that are in the future or closest
  const futureImportant = multipleDates.filter(
    (d) => d.date.getTime() >= startOfToday.getTime()
  );

  if (futureImportant.length > 0) {
    // If there's a fee with fine, or validity, or the latest cutoff deadline
    const feeWithFineItem = futureImportant.find((d) => d.dateType === 'fee_with_fine');
    const feeWithoutFineItem = futureImportant.find((d) => d.dateType === 'fee_without_fine');
    const expiryItem = futureImportant.find((d) => d.dateType === 'expiry');
    const lastDateItem = futureImportant.find((d) => d.dateType === 'last_date' || d.dateType === 'submission_deadline');

    const chosen = feeWithFineItem || feeWithoutFineItem || expiryItem || lastDateItem || futureImportant[0];
    primaryExpireDate = chosen.date;
    primarySource = chosen.rawText;
    primaryConfidence = chosen.confidence;
    primaryPhrase = chosen.title;
  } else if (feeDates.lastDateWithFine || feeDates.lastDateWithoutFine) {
    primaryExpireDate = feeDates.lastDateWithFine || feeDates.lastDateWithoutFine;
    primarySource = feeDates.lastDateWithFine
      ? 'Last date for fee payment with fine'
      : 'Last date for fee payment without fine';
    primaryConfidence = 98;
    primaryPhrase = 'fee-payment-deadline';
  }

  // Priority 2: Direct expiry phrases (valid until, expires on, last date, etc.)
  if (!primaryExpireDate) {
    for (const def of DATE_PATTERN_DEFINITIONS) {
      const re = new RegExp(def.regex.source, def.regex.flags.replace('g', '') + 'g');
      let match: RegExpExecArray | null;

      while ((match = re.exec(text)) !== null) {
        const phraseEnd = match.index + match[0].length;
        const candidates = allFoundDates.filter(
          (d) => d.index >= phraseEnd - 2 && d.index <= phraseEnd + 100
        );

        if (candidates.length > 0) {
          const best = candidates[0];
          if (best.date.getTime() < startOfToday.getTime()) {
            continue;
          }

          const start = Math.max(0, phraseEnd - 20);
          const end = Math.min(text.length, best.index + best.length + 1);
          primaryExpireDate = best.date;
          primarySource = text.slice(start, end).replace(/\s+/g, ' ').trim();
          primaryConfidence = def.confidence;
          primaryPhrase = def.title;
          break;
        }
      }
      if (primaryExpireDate) break;
    }
  }

  // Priority 3: Fallback - any deadline / date / schedule mention with a future date
  if (!primaryExpireDate) {
    const fallbackRe = /(last\s+date|deadline|valid\s+until|validity|expiry|date\s+of|due\s+date|schedule|cutoff|closing)/gi;
    let fallbackMatch: RegExpExecArray | null;

    while ((fallbackMatch = fallbackRe.exec(text)) !== null) {
      const start = fallbackMatch.index;
      const window = text.slice(start, Math.min(text.length, start + 200));
      const windowDates = findAllDates(window);
      const futureDates = windowDates.filter((d) => d.date.getTime() >= startOfToday.getTime());

      if (futureDates.length > 0) {
        const best = futureDates[0];
        primaryExpireDate = best.date;
        primarySource = window.replace(/\s+/g, ' ').trim().slice(0, 120);
        primaryConfidence = 70;
        primaryPhrase = 'deadline-related';
        break;
      }
    }
  }

  // Priority 4: Ultimate fallback for documents with any future date mentioned
  if (!primaryExpireDate && allFoundDates.length > 0) {
    const futureDates = allFoundDates.filter((d) => d.date.getTime() >= startOfToday.getTime());
    if (futureDates.length > 0) {
      const best = futureDates[0];
      primaryExpireDate = best.date;
      const start = Math.max(0, best.index - 30);
      const end = Math.min(text.length, best.index + best.length + 30);
      primarySource = text.slice(start, end).replace(/\s+/g, ' ').trim();
      primaryConfidence = 60;
      primaryPhrase = 'scheduled-date';
    }
  }

  let finalMatchedPhrase = primaryPhrase;
  if (primaryPhrase && /last\s+date/i.test(primaryPhrase)) {
    finalMatchedPhrase = 'last date';
  }

  return {
    expireDate: primaryExpireDate,
    expirySource: primarySource,
    expiryConfidence: primaryConfidence,
    matchedPhrase: finalMatchedPhrase,
    lastDateWithoutFine: feeDates.lastDateWithoutFine,
    lastDateWithFine: feeDates.lastDateWithFine,
    importantDates: multipleDates,
  };
}