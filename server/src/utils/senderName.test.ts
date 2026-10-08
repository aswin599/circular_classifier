import { describe, it, expect } from 'vitest';
import { extractSenderNameFromRef, formatRefSenderName } from './senderName';

describe('formatRefSenderName', () => {
  it('returns the bare office name (no "Ref: TCE/" prefix)', () => {
    expect(formatRefSenderName('Dean')).toBe('Dean');
    expect(formatRefSenderName('IQAC')).toBe('IQAC');
    expect(formatRefSenderName('Principal')).toBe('Principal');
    expect(formatRefSenderName('Dean (Students)')).toBe('Dean (Students)');
    expect(formatRefSenderName('CONTROLLER OF EXAMINATIONS')).toBe('CONTROLLER OF EXAMINATIONS');
  });

  it('normalizes already-formatted "Ref: TCE/..." values to the bare name', () => {
    expect(formatRefSenderName('Ref: TCE/Dean')).toBe('Dean');
    expect(formatRefSenderName('Ref. TCE/IQAC')).toBe('IQAC');
    expect(formatRefSenderName('ref: tce/coe')).toBe('coe');
    expect(formatRefSenderName('Reference No: TCE/Principal/2026')).toBe('Principal/2026');
  });

  it('strips a bare TCE/ prefix', () => {
    expect(formatRefSenderName('TCE/Dean')).toBe('Dean');
    expect(formatRefSenderName('TCE / IQAC')).toBe('IQAC');
  });

  it('returns null for empty/missing input', () => {
    expect(formatRefSenderName(null)).toBeNull();
    expect(formatRefSenderName(undefined)).toBeNull();
    expect(formatRefSenderName('')).toBeNull();
    expect(formatRefSenderName('   ')).toBeNull();
  });

  it('works end-to-end with the ref extractor used at ingest time', () => {
    expect(formatRefSenderName(extractSenderNameFromRef('Ref.No/TCE/Dean/2026'))).toBe('Dean');
    expect(formatRefSenderName(extractSenderNameFromRef('TCE/ABC/2026'))).toBe('ABC');
  });
});

describe('extractSenderNameFromRef', () => {
  it('extracts the code immediately after TCE/ from Ref.No', () => {
    expect(extractSenderNameFromRef('Ref.No/TCE/Dean/2026')).toBe('Dean');
    expect(extractSenderNameFromRef('TCE/ABC/2026')).toBe('ABC');
    expect(extractSenderNameFromRef('TCE/Principal/2026')).toBe('Principal');
    expect(extractSenderNameFromRef('TCE/ExamCell/2026')).toBe('ExamCell');
  });

  it('handles REF.NO and similar label variations', () => {
    expect(extractSenderNameFromRef('REF.NO: TCE/IQAC/2026-27/4')).toBe('IQAC');
    expect(extractSenderNameFromRef('Ref. No : TCE/Dean/2026')).toBe('Dean');
    expect(extractSenderNameFromRef('Reference No: TCE/Principal/2026')).toBe('Principal');
    expect(extractSenderNameFromRef('ref.no/TCE/examcell/2026')).toBe('examcell');
  });

  it('trims surrounding whitespace inside the code', () => {
    expect(extractSenderNameFromRef('Ref.No/TCE/ Dean /2026')).toBe('Dean');
    expect(extractSenderNameFromRef('Ref.No: TCE / ExamCell / 2026')).toBe('ExamCell');
  });

  it('extracts from a body that also has a TCE/ value', () => {
    const body = [
      'Dear Students,',
      'Ref.No/TCE/Principal/2026',
      'This is to inform you about the revised holiday list.',
    ].join('\n');
    expect(extractSenderNameFromRef(body)).toBe('Principal');
  });

  it('extracts when TCE/ appears with no trailing slash', () => {
    expect(extractSenderNameFromRef('Ref.No/TCE/Dean')).toBe('Dean');
  });

  it('extracts the office code from a No.<CODE>/ reference', () => {
    expect(extractSenderNameFromRef('No.COE/NOV.26/ R&A Exam. Fee/0025')).toBe('COE');
    expect(extractSenderNameFromRef('Ref.No: No.COE/NOV.26/ R&A Exam. Fee/0025')).toBe('COE');
  });

  it('extracts the office name from the letterhead', () => {
    expect(extractSenderNameFromRef('OFFICE OF THE CONTROLLER OF EXAMINATIONS')).toBe('CONTROLLER OF EXAMINATIONS');
    expect(extractSenderNameFromRef('OFFICE OF THE EXAM CELL')).toBe('EXAM CELL');
  });

  it('maps the DEAN (STUDENT AFFAIRS) letterhead to Dean (Student)', () => {
    expect(extractSenderNameFromRef('OFFICE OF THE DEAN (STUDENT AFFAIRS)')).toBe('Dean (Student)');
    expect(extractSenderNameFromRef('OFFICE OF THE DEAN (STUDENTS AFFAIRS)')).toBe('Dean (Student)');
    expect(extractSenderNameFromRef('DEAN (STUDENT AFFAIRS)')).toBe('Dean (Student)');
  });

  it('maps the Career Development Cell to CDC', () => {
    expect(extractSenderNameFromRef('OFFICE OF THE CAREER DEVELOPMENT CENTRE')).toBe('CDC');
    expect(extractSenderNameFromRef('OFFICE OF THE CAREER DEVELOPMENT CENTER')).toBe('CDC');
    expect(extractSenderNameFromRef('OFFICE OF THE CAREER DEVELOPMENT CELL')).toBe('CDC');
    expect(extractSenderNameFromRef('CAREER DEVELOPMENT CELL')).toBe('CDC');
  });

  it('prefers the reference code over the letterhead', () => {
    const text = [
      'THIAGARAJAR COLLEGE OF ENGINEERING, MADURAI',
      'OFFICE OF THE CONTROLLER OF EXAMINATIONS',
      'No.COE/NOV.26/ R&A Exam. Fee/0025',
    ].join('\n');
    expect(extractSenderNameFromRef(text)).toBe('COE');
  });

  it('returns null when no TCE/ pattern exists (no email fallback)', () => {
    expect(extractSenderNameFromRef('Ref.No/2026/042')).toBeNull();
    expect(extractSenderNameFromRef('No reference number here')).toBeNull();
    expect(extractSenderNameFromRef('')).toBeNull();
    expect(extractSenderNameFromRef('   ')).toBeNull();
  });

  it('falls back to a standalone known signature line', () => {
    const text = [
      'THIAGARAJAR COLLEGE OF ENGINEERING , MADURAI - 625015',
      'B/Promotion/2026/ Date: 03.09.2026',
      'CIRCULAR',
      'As per the internal circular (Ref No. ) dated 28.08.2026, ...',
      'PRINCIPAL',
      'To',
      "All HOD's - Circulation among the concerned staff.",
    ].join('\n');
    expect(extractSenderNameFromRef(text)).toBe('PRINCIPAL');
  });

  it('falls back to a tail all-caps signature line anchored before a To/CC footer', () => {
    const text = [
      'College letterhead with no ref code at all.',
      'Some body content here.',
      'DEAN',
      'To',
      'All HODs.',
    ].join('\n');
    expect(extractSenderNameFromRef(text)).toBe('DEAN');
  });

  it('does not treat headings/noise like CIRCULAR as a signature', () => {
    const text = [
      'THIAGARAJAR COLLEGE OF ENGINEERING',
      'CIRCULAR',
      'This is a circular.',
      'To, The Principal',
    ].join('\n');
    expect(extractSenderNameFromRef(text)).toBeNull();
  });

  it('does not let the plain word "reference" hijack the ref field (order-independent)', () => {
    const text = [
      'Forwarded message body',
      'The Appraisal Format and Evaluation Guidelines are enclosed herewith for your reference.',
      '',
      'Ref.No: TCE/IQAC/2026-27/4 Date: 25-Aug-2026',
      'This is the actual circular text...',
      'PRINCIPAL',
      'To',
      'All staff members.',
    ].join('\n');
    expect(extractSenderNameFromRef(text)).toBe('IQAC');
    expect(
      extractSenderNameFromRef('Guidelines are enclosed herewith for your reference.\n\nThe Appraisal format.')
    ).toBeNull();
  });

  it('handles "for your reference.\\n\\nThe..." before an uppercase sentence safely', () => {
    const text = [
      'For your reference.',
      '',
      'The Appraisal Format and Evaluation Guidelines are enclosed herewith.',
      'Ref.No: TCE/IQAC/2026-27/4',
      'CIRCULAR',
    ].join('\n');
    expect(extractSenderNameFromRef(text)).toBe('IQAC');
  });

  it('finds a known office phrase glued into a tail line by OCR (no To/CC override)', () => {
    const text = [
      'THIAGARAJAR COLLEGE OF ENGINEERING , MADURAI - 625015',
      'B/Promotion/2026/ Date: 03.09.2026',
      'N. SUBRAMANIAN, Artisan Grade-IIN. AMBILI, Office AssistantPRINCIPALTo',
      "All HOD's - Circulation among the concerned staff.",
      'CC to: Registrar & Deans.',
    ].join('\n');
    expect(extractSenderNameFromRef(text)).toBe('PRINCIPAL');
  });
});