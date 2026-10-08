import { logger } from '../utils/logger';

export interface EmailLike {
  subject: string;
  bodyText?: string | null;
  senderEmail?: string;
  senderName?: string | null;
  attachments?: {
    filename: string;
    fileType?: string;
  }[];
}

export interface CircularCheckResult {
  isCircular: boolean;
  score: number;
  reason: string;
  matchedIndicators: string[];
}

// Strong positive subject indicators (give high confidence)
const STRONG_SUBJECT_KEYWORDS = [
  'circular',
  'notice',
  'notification',
  'office order',
  'memorandum',
  'memo',
  'academic calendar',
  'timetable',
  'time table',
  'exam schedule',
  'examination schedule',
  'date sheet',
  'hall ticket',
  'fee payment',
  'admission notice',
  'placement drive',
  'holiday announcement',
  'commencement of classes',
  'convocation',
];

// Moderate positive subject keywords
const MODERATE_SUBJECT_KEYWORDS = [
  'schedule',
  'deadline',
  'last date',
  'important announcement',
  'urgent attention',
  'all students',
  'all faculty',
  'all staff',
  'department notice',
  'semester registration',
  'scholarship',
  'examination',
  'symposium',
  'workshop',
  'internship drive',
];

// Body indicators typical in academic/institutional circulars
const BODY_CIRCULAR_PATTERNS = [
  /\b(?:it\s+is\s+hereby\s+(?:notified|informed))\b/i,
  /\b(?:all\s+students\s+(?:are\s+hereby\s+)?(?:informed|notified|requested|advised))\b/i,
  /\b(?:by\s+order\s+(?:of\s+the)?)\b/i,
  /\b(?:office\s+of\s+the\s+(?:registrar|dean|principal|director|controller\s+of\s+examinations|provost))\b/i,
  /\b(?:controller\s+of\s+examinations)\b/i,
  /\b(?:academic\s+year\s+\d{4}[-/]\d{2,4})\b/i,
  /\b(?:last\s+date\s+for\s+(?:submission|registration|payment|fee))\b/i,
  /\b(?:without\s+late\s+fine|with\s+late\s+fine)\b/i,
  /\b(?:copy\s+to\s*:\s*(?:principal|dean|hod|director))\b/i,
  /\b(?:ref(?:erence)?\s*(?:no\.?|number)\s*[:=]\s*[a-z0-9\/-]+)\b/i,
];

/**
 * Search terms used to pre-filter emails at the fetch layer (Gmail query /
 * IMAP SEARCH) so only circular-related messages are downloaded. The
 * `isCircularEmail` scoring remains the authoritative check after fetch.
 */
export const CIRCULAR_SEARCH_TERMS: readonly string[] = [
  ...STRONG_SUBJECT_KEYWORDS,
  ...MODERATE_SUBJECT_KEYWORDS,
  'hereby notified',
  'hereby informed',
  'by order of',
  'office of the registrar',
  'office of the dean',
  'office of the principal',
  'controller of examinations',
  'academic year',
  'last date for submission',
  'last date for registration',
  'last date for payment',
  'without late fine',
  'with late fine',
  'copy to',
];

// Strict non-circular subjects (spam, marketing, otp, social, invoices)
const EXCLUSION_SUBJECT_PATTERNS = [
  /\b(?:your\s+otp|verification\s+code|one\s*time\s*password)\b/i,
  /\b(?:order\s+confirmation|shipping\s+update|package\s+delivered|track\s+your\s+order)\b/i,
  /\b(?:receipt\s+for\s+your\s+payment|invoice\s+#|billing\s+statement)\b/i,
  /\b(?:security\s+alert|sign-in\s+attempt|password\s+reset)\b/i,
  /\b(?:newsletter|weekly\s+digest|promotional|special\s+discount|sale\s+ends?)\b/i,
  /\b(?:uber|swiggy|zomato|amazon\.in|flipkart|netflix|spotify)\b/i,
  /\b(?:linkedin\s+notification|tagged\s+you|new\s+connection|friend\s+request)\b/i,
  /\b(?:you\s+have\s+(?:\d+\s+)?(?:new\s+)?(?:notifications?|messages?|alerts?))\b/i,
];

/**
 * Validates whether a fetched email qualifies as an official institutional circular.
 */
export function isCircularEmail(email: EmailLike): CircularCheckResult {
  const subject = (email.subject || '').trim().toLowerCase();
  const body = (email.bodyText || '').slice(0, 3000).toLowerCase();
  const matchedIndicators: string[] = [];

  // Check hard exclusions first
  for (const pattern of EXCLUSION_SUBJECT_PATTERNS) {
    if (pattern.test(subject)) {
      return {
        isCircular: false,
        score: 0,
        reason: `Subject matched non-circular exclusion pattern: ${pattern.source}`,
        matchedIndicators: [],
      };
    }
  }

  let score = 0;

  // 1. Strong subject keywords
  for (const kw of STRONG_SUBJECT_KEYWORDS) {
    if (subject.includes(kw)) {
      score += 45;
      matchedIndicators.push(`subject:${kw}`);
    }
  }

  // 2. Moderate subject keywords
  for (const kw of MODERATE_SUBJECT_KEYWORDS) {
    if (subject.includes(kw) && !matchedIndicators.some((m) => m.includes(kw))) {
      score += 25;
      matchedIndicators.push(`subject:${kw}`);
    }
  }

  // 3. Body circular patterns
  for (const pattern of BODY_CIRCULAR_PATTERNS) {
    if (pattern.test(body)) {
      score += 30;
      matchedIndicators.push(`body:${pattern.source.slice(0, 30)}`);
    }
  }

  // 4. Attachments (PDF / DOCX circulars)
  const attachments = email.attachments || [];
  const docAttachments = attachments.filter((a) => {
    const ext = (a.fileType || a.filename.split('.').pop() || '').toLowerCase();
    return ['pdf', 'docx', 'doc'].includes(ext);
  });

  if (docAttachments.length > 0) {
    score += 20;
    matchedIndicators.push(`attachment:${docAttachments.length}_docs`);

    // Extra points if attachment filename has circular hints
    for (const doc of docAttachments) {
      const lowerName = doc.filename.toLowerCase();
      if (
        lowerName.includes('circular') ||
        lowerName.includes('notice') ||
        lowerName.includes('order') ||
        lowerName.includes('schedule') ||
        lowerName.includes('timetable')
      ) {
        score += 25;
        matchedIndicators.push(`attachment_name:${doc.filename}`);
        break;
      }
    }
  }

  // 5. Reference number in subject (e.g. "Ref: XYZ/2026/12")
  if (/(?:ref\s*(?:no\.?|:)|cir(?:cular)?\s*no\.?)\s*[a-z0-9\/-]+/i.test(subject)) {
    score += 30;
    matchedIndicators.push('subject:reference_code');
  }

  // If score is 35 or above, consider it a genuine circular
  const isCircular = score >= 35;
  const reason = isCircular
    ? `Accepted as circular (score: ${score}) with indicators: ${matchedIndicators.join(', ')}`
    : `Rejected non-circular email (score: ${score} below threshold of 35)`;

  logger.debug(`Circular filter evaluation for "${email.subject}": score=${score}, isCircular=${isCircular}`);

  return {
    isCircular,
    score,
    reason,
    matchedIndicators,
  };
}
