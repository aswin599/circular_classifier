import type { Circular } from '../types';

const REF_NO_RE = /\bref(?:erence)?\.?\s*n?[o0]?\.?\s*(?:[\/\s:-]+)?([^\n\r]*)/i;
const TCE_RE = /\btce\s*\/\s*([^\/\r\n]+)/i;
const OFFICE_CODE_RE = /\bno\.\s*([a-z][a-z0-9]{0,20})\s*\/\s*/i;
const OFFICE_OF_THE_RE = /\boffice\s+of\s+(?:the\s+)?([a-z][a-z]+(?:\s+[a-z][a-z]+)*\s*(?:\([a-z][a-z0-9\s,.\/-]*\))?)/i;
const DEAN_STUDENT_RE = /\bdean\s+(?:of\s+)?\(\s*student(?:s)?(?:\s+affairs)?\s*\)/i;
const CDC_RE = /\b(career\s+development\s+(?:centre|center|cell)|cdc)\b/i;

const OFFICE_NAME_MAP: Record<string, string> = {
  'DEAN (STUDENT AFFAIRS)': 'Dean (Student)',
  'DEAN (STUDENTS AFFAIRS)': 'Dean (Student)',
  'CAREER DEVELOPMENT CENTRE': 'CDC',
  'CAREER DEVELOPMENT CENTER': 'CDC',
  'CAREER DEVELOPMENT CELL': 'CDC',
};

// Corrections for office names mis-decoded during OCR. "Dean-ITI" is a common
// misread of "Dean-III" (the Roman numeral), so it is corrected at display time
// for any circular that was stored with the mis-decoded value.
const SENDER_NAME_CORRECTIONS: Record<string, string> = {
  'DEAN-ITI': 'Dean-III',
};

function cleanValue(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/[.,:;]+$/, '').trim();
}

function normalizeOffice(value: string): string | null {
  const key = cleanValue(value).toUpperCase();
  if (!key) return null;
  return OFFICE_NAME_MAP[key] ?? key;
}

/**
 * Extracts the issuing office/sender name from the circular's Ref.No field.
 * Detection priority:
 *   1. "TCE/..." code inside the Ref.No (e.g. TCE/Dean/2026 -> Dean).
 *   2. "No.<CODE>/..." reference code (e.g. No.COE/NOV.26/... -> COE).
 *   3. Letterhead "OFFICE OF (THE) <NAME>" -> the office name.
 *
 * Ref.No/TCE/Dean/2026              -> Dean
 * TCE/ABC/2026                      -> ABC
 * No.COE/NOV.26/...                 -> COE
 * OFFICE OF THE DEAN (STUDENT AFFAIRS) -> Dean (Student)
 * CAREER DEVELOPMENT CENTRE         -> CDC
 *
 * Returns null when none of the patterns match, so the caller renders NULL
 * instead of the email sender.
 */
export function extractRefSender(circular: Circular): string | null {
  const source = [
    circular.subject,
    circular.shortTitle,
    circular.bodyText,
    circular.extractedText,
    ...(circular.summaryBullets || []),
  ]
    .filter(Boolean)
    .join('\n')
    .replace(/\u00a0/g, ' ');

  // Find the Ref.No field value; if no label is present, search the whole text.
  const refNoMatch = REF_NO_RE.exec(source);
  const refField = refNoMatch ? refNoMatch[1] : source;

  // 1. TCE/ code, preferentially inside the Ref.No field.
  const tceMatch = TCE_RE.exec(refField);
  if (tceMatch) {
    const value = cleanValue(tceMatch[1]);
    if (value) return value;
  }

  // 2. No.<CODE>/ reference code, in the Ref.No field first, then the full text.
  for (const area of [refField, source]) {
    const codeMatch = OFFICE_CODE_RE.exec(area);
    if (codeMatch && !/^tce$/i.test(codeMatch[1])) {
      const value = cleanValue(codeMatch[1]);
      if (value) return value;
    }
  }

  // 3. Letterhead "OFFICE OF (THE) <NAME>" across the full text.
  const officeMatch = OFFICE_OF_THE_RE.exec(source);
  if (officeMatch) {
    const value = normalizeOffice(officeMatch[1]);
    if (value) return value;
  }

  // 4. Standalone office mentions found on scanned letterheads.
  if (DEAN_STUDENT_RE.test(source)) return 'Dean (Student)';
  const cdcMatch = CDC_RE.exec(source);
  if (cdcMatch) {
    const value = normalizeOffice(cdcMatch[1]);
    if (value) return value;
  }

  return null;
}

export interface SenderDisplay {
  primary: string;
  secondary?: string;
}

/**
 * Required display/storage value for a circular's issuing office: just the
 * office code parsed from the Ref.No (e.g. "Alumni-Pragati"). Safe to call on
 * already-formatted values (legacy "Ref: TCE/..." rows, client fallbacks) —
 * an existing "Ref"/"Ref No"/"Ref." marker and "TCE/" prefix are stripped so
 * the result is always the bare office name, never a prefixed "Ref: TCE/...".
 */
export function formatRefSender(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const value = String(raw).trim();
  const withoutRefMarker = value.replace(
    /^(?:ref(?:erence)?\.?\s*(?:no\.?|number)?\s*[:=\u2022-]?\s*)/i,
    ''
  );
  const core = withoutRefMarker
    .trim()
    .replace(/^tce\s*/i, '')
    .replace(/^[\/\s]+/, '')
    .trim();
  if (!core) return null;
  return SENDER_NAME_CORRECTIONS[core.toUpperCase()] ?? core;
}

/**
 * Fallback label derived from the sender email address, used only when no
 * Ref.No / office pattern is found in the circular text. Prettifies the local
 * part (e.g. headiqac@tce.edu -> IQAC, caswin848@gmail.com -> CASWIN848).
 */
export function senderNameFromEmail(senderEmail: string): string | null {
  const local = (senderEmail || '').split('@')[0].trim();
  if (!local) return null;

  let core = local
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  core = core.replace(/^head([a-z]\w*)$/i, '$1');

  const label = core.toUpperCase();
  return label || null;
}

export function getSenderDisplay(circular: Circular): SenderDisplay {
  const refSender = circular.senderName || extractRefSender(circular);
  const emailSender = senderNameFromEmail(circular.senderEmail);

  return {
    primary: formatRefSender(refSender ?? emailSender) ?? 'NULL',
  };
}