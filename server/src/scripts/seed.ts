import 'dotenv/config';
import bcrypt from 'bcrypt';
import dbConnect from '../config/database';
import { User } from '../models/User';
import { Category } from '../models/Category';
import { TrainingSample } from '../models/TrainingSample';

const MAILBOX_EMAIL = 'circularclassifier@gmail.com';

async function seedTrainingSamples() {
  const existing = await TrainingSample.countDocuments({ senderEmail: MAILBOX_EMAIL });
  if (existing > 0) {
    console.log(`Training samples already exist for ${MAILBOX_EMAIL} (${existing})`);
    return;
  }

  const samples = [
    {
      categoryName: 'Examination',
      subject: 'NOV 2026 EXAM - Phase I & II FEE DEMAND FOR ALL UG PG PTBE PHD (Regular & Private)',
      text: 'Fee demand for Phase I and Phase II of the NOV 2026 examinations. Last date for payment without fine and with late fine. All UG, PG, PTBE and PhD students are requested to pay examination fees before the deadline. Controller of Examinations, circular reference number, date sheet will be released later.',
    },
    {
      categoryName: 'Examination',
      subject: 'TIME TABLE FOR NOV 2026 EXAMINATIONS - FINAL SCHEDULE',
      text: 'Final timetable and exam schedule for NOV 2026 examinations. Date sheet published. Hall tickets will be issued. Examination starts as per the published schedule for regular and private candidates.',
    },
    {
      categoryName: 'Academic',
      subject: 'Academic Calendar 2026-2027 - Commencement of Classes for all departments',
      text: 'Academic calendar for the year 2026-2027 is published. Commencement of classes for all departments begins next month. Semester registration and course enrollment for new students.',
    },
    {
      categoryName: 'Administrative',
      subject: 'Office Order - Clarification on examination fee refund policy',
      text: 'Office order regarding the refund policy for examination fees. All rules and policy clarifications are issued by the office of the registrar. This circular supersedes the earlier memorandum on fee policy.',
    },
    {
      categoryName: 'Holiday',
      subject: 'Holiday Notification - College closed for Pongal festival',
      text: 'The institution will remain closed for the Pongal festival break. Staff and students are informed that classes resume after the vacation as per the academic calendar.',
    },
    {
      categoryName: 'Placement',
      subject: 'Placement Drive - Campus recruitment by leading companies',
      text: 'Campus placement drive and recruitment interviews scheduled. Resume submission deadline announced. Shortlisted candidates will be informed by the placement cell before the interview date.',
    },
    {
      categoryName: 'Events',
      subject: 'Inter-departmental Technical Symposium - Registrations Open',
      text: 'Annual inter-departmental technical symposium and workshop. Seminar and conference sessions planned. Competition registrations are now open for all students.',
    },
  ];

  for (const sample of samples) {
    await TrainingSample.create({
      senderEmail: MAILBOX_EMAIL,
      categoryName: sample.categoryName,
      subject: sample.subject,
      text: sample.text,
    });
  }

  console.log(`Created ${samples.length} training samples from ${MAILBOX_EMAIL}`);
}

async function seedCategories() {
  // Create default categories
  const categories = [
    {
      name: 'Examination',
      description: 'Circulars related to exams, schedules, results',
      keywords: ['exam', 'examination', 'midterm', 'final', 'schedule', 'timetable', 'result', 'hall ticket'],
      color: '#EF4444',
    },
    {
      name: 'Academic',
      description: 'Academic-related circulars',
      keywords: ['syllabus', 'curriculum', 'course', 'admission', 'enrollment', 'scholarship', 'fee', 'semester'],
      color: '#3B82F6',
    },
    {
      name: 'Holiday',
      description: 'Holiday and vacation notices',
      keywords: ['holiday', 'vacation', 'leave', 'closed', 'break', 'festival'],
      color: '#10B981',
    },
    {
      name: 'Administrative',
      description: 'General administrative notices',
      keywords: ['notice', 'circular', 'memo', 'order', 'notification', 'meeting', 'policy', 'rules'],
      color: '#8B5CF6',
    },
    {
      name: 'Events',
      description: 'Events, workshops, seminars',
      keywords: ['event', 'workshop', 'seminar', 'conference', 'guest lecture', 'competition', 'award'],
      color: '#F59E0B',
    },
    {
      name: 'Scholarship',
      description: 'Scholarships, fellowships, and financial aid',
      keywords: ['scholarship', 'fellowship', 'stipend', 'grant', 'financial aid', 'concession', 'endowment', 'merit', 'nsp', 'reliance foundation'],
      color: '#10B981',
    },
    {
      name: 'Placement',
      description: 'Placement and career-related circulars',
      keywords: ['placement', 'campus', 'interview', 'resume', 'company', 'job', 'hiring', 'recruitment', 'soft skill', 'dress code', 'aptitude', 'pre-placement'],
      color: '#06B6D4',
    },
  ];

  for (const category of categories) {
    const existing = await Category.findOne({ name: category.name });
    if (!existing) {
      await Category.create(category);
      console.log(`Created category: ${category.name}`);
    } else {
      existing.keywords = category.keywords;
      existing.description = category.description;
      existing.color = category.color;
      await existing.save();
    }
  }

  // Only these two accounts are supported: the HOD (admin) and one student.
  const accounts = [
    {
      email: 'circularclassifier@gmail.com',
      password: 'admin',
      fullName: 'HOD',
      role: 'ADMIN' as const,
      department: 'Administration',
    },
    {
      email: 'caswin@gmail.com',
      password: 'student',
      fullName: 'aswin',
      role: 'STUDENT' as const,
      department: 'Student',
    },
  ];

  const allowedEmails = accounts.map((account) => account.email);

  // Remove every account that is not one of the two supported logins.
  const removed = await User.deleteMany({ email: { $nin: allowedEmails } });
  if (removed.deletedCount) {
    console.log(`Removed ${removed.deletedCount} unsupported account(s)`);
  }

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    await User.findOneAndUpdate(
      { email: account.email },
      {
        email: account.email,
        passwordHash,
        fullName: account.fullName,
        role: account.role,
        department: account.department,
        isActive: true,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    console.log(`Verified ${account.role} user: ${account.email}`);
  }
}

async function main() {
  console.log('🌱 Seeding MongoDB database...');
  await dbConnect();
  await seedCategories();
  await seedTrainingSamples();
  console.log('✅ Seed completed successfully');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
