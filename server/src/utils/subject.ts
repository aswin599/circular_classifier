const PLACEHOLDER = /^\(?\s*(no\s*subject|untitled|circular|)\s*\)?$/i;
const FILE_EXT = /\.(pdf|docx?|txt|png|jpe?g|tiff?|gif|bmp)$/i;

/**
 * Turns raw email subjects into clean, human-readable circular titles.
 * - Strips Fwd:/Re:/FW: style prefixes
 * - Strips leading "Circular", "Circular: " / "Circular - " labels
 * - Strips trailing " - Circular" / ": Circular" labels
 * - Strips file extensions (circulars whose subject is really a filename)
 * - Falls back to the attachment filename, then "Untitled Circular"
 */
export function cleanCircularSubject(
  subject: string | null | undefined,
  fallbackFilename?: string | null
): string {
  let s = (subject || '').trim();

  s = s.replace(/^(fwd|fw|re|aw|answ|antw|sv|vs)\s*:\s*/gi, '').trim();

  s = s.replace(/^circular\s*[-:–—]\s*/i, '').trim();
  s = s.replace(/^circular\s+(?=[a-z0-9])/i, (m) => (m ? ' ' : m)).trim();
  s = s.replace(/^[\[\(]?\s*circular\s*[\]\)]?\s*[-:–—]\s*/i, '').trim();

  s = s.replace(FILE_EXT, '').trim();

  if (s && !PLACEHOLDER.test(s)) {
    s = s.replace(/\s*[-:–—]?\s*circular$/i, '').trim();
    s = s.replace(/[-:–—\s]+$/, '').trim();
    s = s.replace(/\s{2,}/g, ' ');
  }

  if (!s || PLACEHOLDER.test(s)) {
    s = (fallbackFilename || '').trim().replace(FILE_EXT, '').trim();
  }

  if (!s || PLACEHOLDER.test(s)) {
    s = 'Untitled Circular';
  }

  return s.replace(/\s{2,}/g, ' ');
}