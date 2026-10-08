import { Category } from '../models/Category';
import { TrainingSample } from '../models/TrainingSample';
import { logger } from '../utils/logger';

export interface ClassificationResult {
  categoryId: string | null;
  categoryName: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  priorityOrder: number;
  confidence: number;
  matchedKeywords: string[];
}

export type AudienceRole = 'ADMIN' | 'STUDENT' | 'ALL';

export interface RoleClassificationResult {
  targetRole: AudienceRole;
  matchedKeywords: string[];
}

// Default classification rules - these should ideally be stored in the DB
// via the categories table, but we keep a fallback for unassigned categories.
const DEFAULT_KEYWORDS: Record<string, string[]> = {
  examination: ['exam', 'examination', 'midterm', 'final', 'schedule', 'timetable', 'result', 'admit', 'hall ticket', 'fee demand', 'arrear', 'revaluation'],
  scholarship: ['scholarship', 'fellowship', 'stipend', 'grant', 'financial aid', 'concession', 'endowment', 'merit', 'nsp', 'reliance foundation'],
  academic: ['syllabus', 'curriculum', 'course', 'admission', 'enrollment', 'semester', 'academic calendar', 'learning', 'research', 'collaboration', 'pedagogy', 'attendance', 'credits', 'pragati', 'student centered'],
  placement: ['placement', 'campus', 'interview', 'resume', 'company', 'job', 'hiring', 'recruitment', 'soft skill', 'dress code', 'aptitude', 'pre-placement', 'drive'],
  events: ['event', 'workshop', 'seminar', 'conference', 'session', 'guest lecture', 'competition', 'award', 'symposium', 'hackathon', 'celebration', 'women\'s day', 'interaction session', 'tech day'],
  administrative: ['notice', 'circular', 'memo', 'order', 'notification', 'meeting', 'policy', 'rules', 'seniority', 'promotion', 'appraisal', 'address', 'hostel', 'staff', 'faculty', 'office of', 'annual performance'],
  holiday: ['holiday', 'vacation', 'leave', 'closed', 'break', 'festival', 'pongal', 'diwali', 'christmas'],
};

const PRIORITY_KEYWORDS: Record<string, { word: string; priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'; order: number }[]> = {
  HIGH: [
    { word: 'exam', priority: 'HIGH', order: 3 },
    { word: 'examination', priority: 'HIGH', order: 3 },
    { word: 'pre-placement talk', priority: 'HIGH', order: 3 },
    { word: 'interview', priority: 'HIGH', order: 3 },
    { word: 'urgent', priority: 'HIGH', order: 3 },
    { word: 'immediate', priority: 'HIGH', order: 3 },
    { word: 'as soon as possible', priority: 'HIGH', order: 3 },
    { word: 'asap', priority: 'HIGH', order: 3 },
    { word: 'mandatory', priority: 'HIGH', order: 3 },
    { word: 'compulsory', priority: 'HIGH', order: 3 },
    { word: 'deadline', priority: 'HIGH', order: 3 },
    { word: 'last date', priority: 'HIGH', order: 3 },
    { word: 'final date', priority: 'HIGH', order: 3 },
    { word: 'emergency', priority: 'HIGH', order: 3 },
    { word: 'fee demand', priority: 'HIGH', order: 3 },
  ],
  MEDIUM: [
    { word: 'inter college event', priority: 'NORMAL', order: 2 },
    { word: 'hackathon', priority: 'NORMAL', order: 2 },
    { word: 'workshop', priority: 'NORMAL', order: 2 },
    { word: 'seminar', priority: 'NORMAL', order: 2 },
    { word: 'symposium', priority: 'NORMAL', order: 2 },
    { word: 'conference', priority: 'NORMAL', order: 2 },
    { word: 'scholarship', priority: 'NORMAL', order: 2 },
    { word: 'placement drive', priority: 'NORMAL', order: 2 },
    { word: 'fee payment', priority: 'NORMAL', order: 2 },
    { word: 'registration', priority: 'NORMAL', order: 2 },
    { word: 'pragati', priority: 'NORMAL', order: 2 },
    { word: 'soft skill', priority: 'NORMAL', order: 2 },
    { word: 'submission', priority: 'NORMAL', order: 2 },
    { word: 'important', priority: 'NORMAL', order: 2 },
  ],
  LOW: [
    { word: 'general notice', priority: 'LOW', order: 1 },
    { word: 'holiday', priority: 'LOW', order: 1 },
    { word: 'vacation', priority: 'LOW', order: 1 },
    { word: 'closed', priority: 'LOW', order: 1 },
    { word: 'break', priority: 'LOW', order: 1 },
    { word: 'festival', priority: 'LOW', order: 1 },
    { word: 'club', priority: 'LOW', order: 1 },
    { word: 'sports day', priority: 'LOW', order: 1 },
    { word: 'newsletter', priority: 'LOW', order: 1 },
    { word: 'routine', priority: 'LOW', order: 1 },
    { word: 'seniority list', priority: 'LOW', order: 1 },
    { word: 'address details', priority: 'LOW', order: 1 },
    { word: 'interaction session', priority: 'LOW', order: 1 },
  ],
};

const STOP_WORDS = new Set([
  'and', 'the', 'for', 'with', 'from', 'this', 'that', 'your', 'have', 'has',
  'will', 'shall', 'been', 'were', 'are', 'was', 'all', 'any', 'can', 'not',
  'but', 'its', 'our', 'their', 'off', 'out', 'per', 'int', 'new', 'circular',
]);

// Audience keywords used to classify a circular as aimed at students,
// at admin/staff, or at everyone (ALL).
const ROLE_KEYWORDS: Record<'STUDENT' | 'ADMIN', string[]> = {
  STUDENT: [
    'student', 'students', 'ug ', 'pg ', 'ptbe', 'phd', 'b.tech', 'b.e', 'm.e',
    'exam', 'examination', 'fee', 'scholarship', 'placement', 'interview',
    'timetable', 'date sheet', 'hall ticket', 'class', 'classes', 'admission',
    'enrollment', 'enrolment', 'hostel', 'holiday', 'festival', 'symposium',
    'hackathon', 'dress code', 'registration', 'result', 'attendance', 'library',
    'sports', 'cultural', 'competition', "women's day", 'soft skill', 'pragati',
    'course', 'syllabus', 'internship', 'career', 'semester', 'arrear',
    'revaluation', 're-evaluation', 'tuition', 'merit', 'nss', 'yrc', 'startup club',
  ],
  ADMIN: [
    'faculty', 'staff', 'teaching', 'non-teaching', 'non teaching', 'seniority',
    'promotion', 'aicte', 'nba', 'naac', 'ncte', 'affiliation', 'leave rules',
    'leave', 'appraisal', 'dean', 'head of department', 'hod', 'office order',
    'recruitment', 'payslip', 'salary', 'assistant professor', 'professor',
    'research collaboration', 'grants', 'audit', 'antiragging', "women's cell",
    'iqac', 'vice principal', 'principal', 'confidential', 'memorandum',
    'staff council', 'departmental meeting', 'budget', 'institutional',
    'accreditation', 'autonomous', 'regulations', 'workload', 'time table for staff',
  ],
};

export class Classifier {
  private trainedKeywords: Record<string, string[]> = {};

  private async loadCategoriesFromDB(): Promise<Record<string, string[]>> {
    const categories = await Category.find().select('name keywords');
    const result: Record<string, string[]> = {};
    for (const category of categories) {
      if (category.keywords.length > 0) {
        result[category.name.toLowerCase()] = category.keywords;
      }
    }
    return result;
  }

  /**
   * "Trains" the model from labelled samples (e.g. circulars received from
   * circularclassifier@gmail.com). Extracts informative keywords per category
   * and merges them into the runtime keyword map used during classification.
   */
  async trainFromSamples(limit = 200): Promise<{ trained: number; categories: string[] }> {
    const samples = await TrainingSample.find({}).sort({ createdAt: -1 }).limit(limit);
    const trainedKeywords: Record<string, string[]> = {};

    for (const sample of samples) {
      const categoryKey = sample.categoryName.toLowerCase();
      if (!trainedKeywords[categoryKey]) {
        trainedKeywords[categoryKey] = [];
      }

      const corpus = `${sample.subject} ${sample.text || ''}`.toLowerCase();
      const tokens = corpus.match(/[a-z][a-z0-9]{2,}/g) || [];
      const meaningful = tokens.filter((t) => t.length >= 4 && !STOP_WORDS.has(t));
      trainedKeywords[categoryKey].push(...meaningful);
    }

    this.trainedKeywords = Object.fromEntries(
      Object.entries(trainedKeywords).map(([cat, keywords]) => [
        cat,
        [...new Set(keywords)].slice(0, 30),
      ])
    );

    logger.info(
      `Classifier trained on ${samples.length} samples across categories: ${Object.keys(this.trainedKeywords).join(', ') || 'none'}`
    );

    return { trained: samples.length, categories: Object.keys(this.trainedKeywords) };
  }

  get trainingStats(): { trained: number; categories: string[] } {
    return {
      trained: Object.values(this.trainedKeywords).reduce((sum, k) => sum + k.length, 0),
      categories: Object.keys(this.trainedKeywords),
    };
  }

  async classify(
    text: string,
    subject: string
  ): Promise<ClassificationResult> {
    const combinedText = `${subject} ${text}`.toLowerCase();
    const dbKeywords = await this.loadCategoriesFromDB();
    const mergedKeywords = {
      ...DEFAULT_KEYWORDS,
      ...this.trainedKeywords,
      ...dbKeywords,
    };

    const categoryScores: Record<string, number> = {};
    const matchedByCategory: Record<string, string[]> = {};
    let totalMatches = 0;

    for (const [category, keywords] of Object.entries(mergedKeywords)) {
      const matches = keywords.filter((keyword) => combinedText.includes(keyword.toLowerCase()));
      if (matches.length > 0) {
        categoryScores[category] = matches.length;
        matchedByCategory[category] = matches;
        totalMatches += matches.length;
      }
    }

    // Determine best category
    const ranked = Object.entries(categoryScores).sort((a, b) => b[1] - a[1]);
    const bestCategory = ranked[0]?.[0] ?? null;

    let categoryId: string | null = null;
    let categoryName: string | null = null;

    if (bestCategory) {
      const dbCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${bestCategory}$`, 'i') },
      });

      if (dbCategory) {
        categoryId = dbCategory._id.toString();
        categoryName = dbCategory.name;
      }
    }

    // Determine priority (HIGH: 3, NORMAL/MEDIUM: 2, LOW: 1)
    let priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' = 'NORMAL';
    let priorityOrder = 2;

    // Check High first
    for (const item of PRIORITY_KEYWORDS.HIGH) {
      if (combinedText.includes(item.word)) {
        priority = item.priority;
        priorityOrder = item.order;
        break;
      }
    }

    // If not high, check Low
    if (priorityOrder === 2) {
      for (const item of PRIORITY_KEYWORDS.LOW) {
        if (combinedText.includes(item.word)) {
          priority = item.priority;
          priorityOrder = item.order;
          break;
        }
      }
    }

    // If still normal/medium, verify if medium keywords match
    if (priorityOrder === 2) {
      priority = 'NORMAL';
      priorityOrder = 2;
    }

    const confidence = totalMatches > 0
      ? Math.min(100, (totalMatches / Math.max(Object.keys(mergedKeywords).length, 1)) * 50 + 50)
      : 0;

    const matchedKeywords = bestCategory ? matchedByCategory[bestCategory] ?? [] : [];

    return {
      categoryId,
      categoryName,
      priority,
      priorityOrder,
      confidence,
      matchedKeywords,
    };
  }

  /**
   * Classifies a circular's target audience based on keyword signals:
   * STUDENT / ADMIN / ALL. "ALL" is used when the signals tie or are absent.
   */
  classifyRole(text: string): RoleClassificationResult {
    const combined = (text || '').toLowerCase();
    let studentScore = 0;
    let adminScore = 0;
    const studentMatches: string[] = [];
    const adminMatches: string[] = [];

    for (const kw of ROLE_KEYWORDS.STUDENT) {
      if (combined.includes(kw)) {
        studentScore++;
        studentMatches.push(kw);
      }
    }
    for (const kw of ROLE_KEYWORDS.ADMIN) {
      if (combined.includes(kw)) {
        adminScore++;
        adminMatches.push(kw);
      }
    }

    if (studentScore === 0 && adminScore === 0) {
      return { targetRole: 'ALL', matchedKeywords: [] };
    }
    if (studentScore === adminScore) {
      return { targetRole: 'ALL', matchedKeywords: [...studentMatches, ...adminMatches] };
    }

    const targetRole: AudienceRole = studentScore > adminScore ? 'STUDENT' : 'ADMIN';
    const matchedKeywords = targetRole === 'STUDENT' ? studentMatches : adminMatches;
    return { targetRole, matchedKeywords };
  }
}

export const classifier = new Classifier();
export default classifier;

