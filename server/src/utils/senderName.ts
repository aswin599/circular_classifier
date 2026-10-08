// Must be followed by a genuine ref separator (":", "/" or a digit) so ordinary
// prose like "for your reference." — even before an uppercase sentence — never
// hijacks the ref field and silently disables the TCE/office rules below.
const REF_NO_RE = /\bref(?:erence)?\.?\s*n?[o0]?\.?\s*(?:[:\/]|\d)\s*([^\n\r]*)/i;
const TCE_RE = /\btce\s*\/\s*([^\/\r\n]+)/i;
const OFFICE_CODE_RE = /\bno\.\s*([a-z][a-z0-9]{0,20})\s*\/\s*/i;
const OFFICE_OF_THE_RE = /\boffice\s+of\s+(?:the\s+)?([a-z][a-z]+(?:\s+[a-z][a-z]+)*\s*(?:\([a-z][a-z0-9\s,.\/-]*\))?)/i;
const DEAN_STUDENT_RE = /\bdean\s+(?:of\s+)?\(\s*student(?:s)?(?:\s+affairs)?\s*\)/i;
const CDC_RE = /\b(career\s+development\s+(?:centre|center|cell)|cdc)\b/i;

// Standalone all-caps office phrases that appear as signatures on circulars
// whose letterhead carries no ref code (e.g. "...\nPRINCIPAL\nTo\nAll HODs").
const KNOWN_SIGNATURE_RE =
  /^(?:THE\s+)?(?:PRINCIPAL|REGISTRAR|CONTROLLER\s+OF\s+EXAMINATIONS|DIRECTOR|PROJECT\s+DIRECTOR|DEAN(?:\s+\(STUDENT(?:S)?\s+AFFAIRS\))?|HEAD(?:\s*-\s*IQAC)?|IQAC|COE|CDC|CFIA|EXAM\s+CELL|CSE)$/;
// Longest-first so "CONTROLLER OF EXAMINATIONS" wins over "EXAMINATIONS".
const KNOWN_SIGNATURE_PHRASES = [
  'CONTROLLER OF EXAMINATIONS',
  'PROJECT DIRECTOR',
  'PRINCIPAL',
  'REGISTRAR',
  'DIRECTOR',
  'DEAN (STUDENT AFFAIRS)',
  'DEAN (STUDENTS AFFAIRS)',
  'DEAN',
  'HEAD - IQAC',
  'EXAM CELL',
  'IQAC',
  'COE',
  'CDC',
  'CFIA',
  'CSE',
];
const ALL_CAPS_LINE_RE = /^[A-Z][A-Z &()\/.,-]{1,45}$/;
const ALL_CAPS_NOISE_RE = /^(?:CIRCULAR|NOTICE|OFFICE\s+ORDER|ANNEXURE|ENCLOSURE|REGISTER|OR)$/;
const FOOTER_ANCHOR_RE = /^(?:to\b|cc[:\s]|copy\s+to\b|circulation)/i;

const OFFICE_NAME_MAP: Record<string, string> = {
  'DEAN (STUDENT AFFAIRS)': 'Dean (Student)',
  'DEAN (STUDENTS AFFAIRS)': 'Dean (Student)',
  'CAREER DEVELOPMENT CENTRE': 'CDC',
  'CAREER DEVELOPMENT CENTER': 'CDC',
  'CAREER DEVELOPMENT CELL': 'CDC',
};

// Corrections for office names mis-decoded during OCR. "Dean-ITI" is a common
// misread of "Dean-III" (the Roman numeral), so it is normalized on ingest.
const SENDER_NAME_CORRECTIONS: Record<string, string> = {
  'DEAN-ITI': 'Dean-III',
};

/**
 * Required sender-name value: the issuing office/code parsed from the
 * circular's Ref.No — e.g. "TCE/Alumni-Pragati/..." -> "Alumni-Pragati".
 * Normalizes away any "Ref No:", "Ref: TCE/" or bare "TCE/" prefix that may
 * be present so the stored/displayed senderName is always just the office
 * name, never a prefixed "Ref: TCE/...".
 */
export function formatRefSenderName(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const value = String(raw).trim();
  // Strip an existing "Ref"/"Ref No"/"Ref." marker so the value is never nested.
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

function cleanValue(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/[.,:;]+$/, '').trim();
}

function normalizeOffice(value: string): string | null {
  const key = cleanValue(value).toUpperCase();
  if (!key) return null;
  return OFFICE_NAME_MAP[key] ?? key;
}

/**
 * Extracts the issuing office/sender name from a circular's Ref.No field.
 * Detection priority:
 *   1. "TCE/..." code inside the Ref.No (e.g. TCE/Dean/2026 -> Dean).
 *   2. "No.<CODE>/..." reference code (e.g. No.COE/NOV.26/... -> COE).
 *   3. Letterhead "OFFICE OF (THE) <NAME> (...)" -> office name
 *      (e.g. OFFICE OF THE DEAN (STUDENT AFFAIRS) -> Dean (Student),
 *      OFFICE OF THE CAREER DEVELOPMENT CENTRE -> CDC).
 *
 * Ref.No/TCE/Dean/2026              -> Dean
 * TCE/ABC/2026                      -> ABC
 * No.COE/NOV.26/...                 -> COE
 * OFFICE OF THE DEAN (STUDENT AFFAIRS) -> Dean (Student)
 * CAREER DEVELOPMENT CENTRE         -> CDC
 *
 * Returns null (never the email sender name) when none of the patterns match.
 */
export function extractSenderNameFromRef(text: string): string | null {
  const source = (text || '').replace(/\u00a0/g, ' ');

  const refMatch = REF_NO_RE.exec(source);
  const refField = refMatch ? refMatch[1] : source;

  // 1. TCE/ code, preferentially inside the Ref.No field.
  const tceInRef = TCE_RE.exec(refField);
  if (tceInRef) {
    const value = cleanValue(tceInRef[1]);
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

  // 5. Signature-block fallback: a standalone all-caps office phrase that is
  //    either a known TCE office, or sits near the end of the document just
  //    before a "To ..." / "CC ..." footer line (typical signed-circular
  //    layout). Never falls back to the email sender.
  const lines = source.split(/\r?\n/).map((l) => l.replace(/[ \t]+/g, ' ').trim());
  let lastContentIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]) {
      lastContentIdx = i;
      break;
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !ALL_CAPS_LINE_RE.test(line) || ALL_CAPS_NOISE_RE.test(line)) continue;
    const nextLine = lines.slice(i + 1, i + 4).find(Boolean) || '';
    const isKnown = KNOWN_SIGNATURE_RE.test(line);
    const inTail = i + 6 >= lastContentIdx;
    const anchored = FOOTER_ANCHOR_RE.test(nextLine);
    if (isKnown || (inTail && anchored)) {
      const value = normalizeOffice(line);
      if (value) return value;
    }
  }

  // 5b. Reverse scan of the document tail for a known office phrase embedded in
  //     an OCR-glued signature line (e.g. "Office AssistantPRINCIPALTo"). Skips
  //     footer lines ("To ...", "CC ...") so their addressees are ignored.
  const tailStart = Math.max(0, lines.length - 6);
  for (let i = lines.length - 1; i >= tailStart; i--) {
    const line = lines[i];
    if (!line || FOOTER_ANCHOR_RE.test(line) || ALL_CAPS_NOISE_RE.test(line)) continue;
    for (const phrase of KNOWN_SIGNATURE_PHRASES) {
      if (line.lastIndexOf(phrase) >= 0) {
        const value = normalizeOffice(phrase);
        if (value) return value;
      }
    }
  }

  return null;
}