/**
 * Helpers to generate a concise short title (maximum 4 words)
 * and a structured 3-pointer AI summary for circulars.
 */

export function generateShortTitle(subject: string, _bodyText?: string): string {
  if (!subject) return 'General Circular';

  const cleaned = subject
    // Remove email and circular noise prefixes/suffixes
    .replace(/^(re|fwd|fw|notice|circular|office order|notification|announcement)\s*[:\-–]\s*/gi, '')
    .replace(/^[\d\s\-_–#./\\]+/, '') // leading numbers like "0025"
    .replace(/[-–]\s*(reg|circular|regarding|details|notice)\.?\s*$/gi, '')
    .replace(/\s*\(Phase\s+[I|V|X\d\s,&+]+\)/gi, '')
    .replace(/\s*FOR\s+ALL\s+UG\s+PG.*$/gi, '')
    .replace(/\s*@\s*\d+.*$/gi, '') // timestamps
    .replace(/\s*on\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}.*$/gi, '') // inline dates
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[-–_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Keyword-targeted short title recognizers for known circular patterns
  const lower = cleaned.toLowerCase();
  if (lower.includes('exam') && lower.includes('fee')) {
    return 'Exam Fee Demand';
  }
  if (lower.includes('dress code') || (lower.includes('placement') && lower.includes('dress'))) {
    return 'Placement Dress Code';
  }
  if (lower.includes('hackathon')) {
    return 'Tech Day Hackathon';
  }
  if (lower.includes('reliance') && lower.includes('scholarship')) {
    return 'Reliance Foundation Scholarships';
  }
  if (lower.includes('women') && lower.includes('day')) {
    return "Women's Day Celebration";
  }
  if (lower.includes('soft skill') || lower.includes('pragati')) {
    return 'Pragati Skill Program';
  }
  if (lower.includes('seniority list') || lower.includes('promotion')) {
    return 'Promotion Seniority List';
  }
  if (lower.includes('student centered learning') || lower.includes('faculty interaction')) {
    return 'Faculty Learning Session';
  }
  if (lower.includes('residential address') || lower.includes('hostel')) {
    return 'Hostel Address Submission';
  }
  if (lower.includes('annual performance') || lower.includes('appraisal')) {
    return 'Annual Performance Appraisal';
  }
  if (lower.includes('research collaboration') || lower.includes('australia')) {
    return 'Australia Research Collaboration';
  }
  if (lower.includes('timetable') || lower.includes('time table')) {
    return 'Exam Time Table';
  }
  if (lower.includes('pongal') || lower.includes('holiday')) {
    return 'Holiday Notification';
  }

  // Fallback: take first 4 words of cleaned title
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0 && !/^(reg|for|the|and|of|on|in|at|to|a|an)$/i.test(w));
  if (words.length === 0) return 'Campus Circular';
  const shortWords = words.slice(0, 4);

  return shortWords
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function generate3PointerSummary(
  subject: string,
  bodyText?: string,
  extractedText?: string
): string[] {
  const fullContent = [subject, bodyText || '', extractedText || ''].join(' ').replace(/\s+/g, ' ');
  const lower = fullContent.toLowerCase();

  // Point 1: Core purpose / subject
  let point1 = `Announces ${subject.replace(/[-–]\s*reg\.?$/i, '').trim()}.`;
  if (lower.includes('exam') && lower.includes('fee')) {
    point1 = 'Mandatory fee demand notification for upcoming semester examinations.';
  } else if (lower.includes('dress code') || lower.includes('placement')) {
    point1 = 'Official dress code and conduct guidelines for placement interviews and drives.';
  } else if (lower.includes('scholarship')) {
    point1 = 'Application call for scholarship opportunities and student financial aid.';
  } else if (lower.includes('hackathon') || lower.includes('symposium') || lower.includes('event')) {
    point1 = 'Call for student participation and project submissions for upcoming academic event/hackathon.';
  } else if (lower.includes('holiday') || lower.includes('vacation')) {
    point1 = 'Notification of institutional closure and scheduled holiday schedule.';
  } else if (lower.includes('seniority') || lower.includes('appraisal') || lower.includes('administrative')) {
    point1 = 'Administrative circular requiring submission of departmental documentation and records.';
  }

  // Point 2: Audience & Required Action
  let point2 = 'Review official notification for detailed guidelines and criteria.';
  if (lower.includes('ug') || lower.includes('pg') || lower.includes('students')) {
    if (lower.includes('fee')) {
      point2 = 'Applicable to regular and private students across UG, PG and PhD programs to clear dues.';
    } else if (lower.includes('placement') || lower.includes('interview')) {
      point2 = 'Registered placement candidates must adhere strictly to formal attire and carry valid credentials.';
    } else if (lower.includes('hostel') || lower.includes('address')) {
      point2 = 'All students residing outside college hostels must submit verified current address details.';
    } else {
      point2 = 'Relevant students must review instructions and prepare required submissions.';
    }
  } else if (lower.includes('faculty') || lower.includes('staff')) {
    point2 = 'Designated faculty and staff members are requested to attend or submit appraisal forms.';
  }

  // Point 3: What the circular is really about — content-focused only, no
  // deadline, no issuer, and no priority.
  let point3 = 'Outlines the guidelines, eligibility and steps to follow in this notice.';
  if (lower.includes('exam') && lower.includes('fee')) {
    point3 = 'Applicable students must clear the fee before the examination to avoid penalties.';
  } else if (lower.includes('dress code') || (lower.includes('placement') && lower.includes('dress'))) {
    point3 = 'Covers the formal dress code and conduct expected at placement events.';
  } else if (lower.includes('scholarship')) {
    point3 = 'Explains the eligibility criteria and the documents required to apply.';
  } else if (lower.includes('hackathon')) {
    point3 = 'Participants submit industry problem statements to compete in the hackathon.';
  } else if (lower.includes('symposium')) {
    point3 = 'Details the competition categories, registration and submission process.';
  } else if (lower.includes('event') || lower.includes('celebration')) {
    point3 = 'Covers the event schedule, venue and participation guidelines.';
  } else if (lower.includes('holiday') || lower.includes('vacation')) {
    point3 = 'Institution remains closed on the notified dates; classes resume as scheduled.';
  } else if (lower.includes('timetable') || lower.includes('time table')) {
    point3 = 'Contains the final schedule to be followed for the examinations.';
  } else if (lower.includes('hostel') || lower.includes('residential')) {
    point3 = 'Students must submit their verified current residential address details.';
  } else if (lower.includes('appraisal') || lower.includes('performance')) {
    point3 = 'Concerns the submission of annual performance documentation.';
  } else if (lower.includes('seniority')) {
    point3 = 'Concerns the approved seniority list and related documentation.';
  } else if (lower.includes('research') && lower.includes('collaboration')) {
    point3 = 'Explains the research collaboration opportunity and how to participate.';
  }

  return [point1, point2, point3];
}
