// Zero-dependency mock of the Circular Management API (port 5000).
// Serves canned JSON so the real React client can run for screenshot capture.
const http = require('http');
const { URL } = require('url');

const CATS = [
  { id: 1, name: 'Examinations', description: 'Exam schedules, hall tickets, results', keywords: ['exam', 'hall ticket', 'result', 'schedule'], color: '#ef4444', createdAt: '2026-08-01T09:00:00Z', _count: { circulars: 4 } },
  { id: 2, name: 'Academic', description: 'Classes, curriculum, academic calendar', keywords: ['class', 'semester', 'academic', 'timetable'], color: '#3b82f6', createdAt: '2026-08-01T09:00:00Z', _count: { circulars: 3 } },
  { id: 3, name: 'Placements', description: 'Placement drives and recruitment', keywords: ['placement', 'recruitment', 'drive', 'company'], color: '#10b981', createdAt: '2026-08-01T09:00:00Z', _count: { circulars: 2 } },
  { id: 4, name: 'Holidays', description: 'Holidays and calendar updates', keywords: ['holiday', 'vacation', 'closed'], color: '#f59e0b', createdAt: '2026-08-01T09:00:00Z', _count: { circulars: 2 } },
  { id: 5, name: 'Events', description: 'Workshops, seminars, fests', keywords: ['workshop', 'seminar', 'fest', 'event'], color: '#8b5cf6', createdAt: '2026-08-01T09:00:00Z', _count: { circulars: 2 } },
  { id: 6, name: 'Administration', description: 'Fees, hostel, general administration', keywords: ['fee', 'hostel', 'administration', 'principal'], color: '#64748b', createdAt: '2026-08-01T09:00:00Z', _count: { circulars: 1 } },
];

const C = (o) => Object.assign({
  emailMessageId: undefined, shortTitle: undefined, summaryBullets: undefined,
  bodyText: '', extractedText: '', priorityOrder: { URGENT: 4, HIGH: 3, NORMAL: 2, LOW: 1 }[o.priority],
  processingStatus: 'COMPLETED', isProcessed: true, isDuplicate: false,
  targetRole: 'ALL', expirySource: 'keyword_match', expiryConfidence: 92,
  importantDates: [], attachments: [], images: [],
  createdAt: o.receivedDate, updatedAt: o.receivedDate,
  createdBy: { userId: 'u1', fullName: 'System', email: 'system@tce.edu', role: 'SYSTEM' },
}, o);

const CIRCULARS = [
  C({ id: 'c1', subject: 'End-Semester Examination Schedule - November 2026', shortTitle: 'End-Sem Exam Schedule',
      senderEmail: 'exams@tce.edu', senderName: 'Examination Cell', receivedDate: '2026-10-05T09:15:00Z',
      categoryId: 1, priority: 'URGENT', tags: ['exam', 'schedule', 'november'], expireDate: '2026-10-20',
      bodyText: 'The end-semester examinations for the academic year 2026-2027 will commence from 02.11.2026. The detailed branch-wise schedule is attached. Students must download the hall ticket from the student portal ten days before the examination.',
      summaryBullets: ['Exams commence 02.11.2026', 'Hall tickets available from 23.10.2026', 'Branch-wise schedule attached'],
      importantDates: [{ title: 'Hall ticket availability', date: '2026-10-23', dateType: 'last_date' },
                       { title: 'Examination begins', date: '2026-11-02', dateType: 'event' }],
      attachments: [{ id: 'a1', circularId: 'c1', filename: 'end-sem-schedule-nov-2026.pdf', fileType: 'application/pdf', fileSize: 184320, filePath: 'mock/a1', extractedText: 'End Semester Examination Schedule November 2026...', ocrConfidence: 0.98, isProcessed: true, createdAt: '2026-10-05T09:16:00Z' }] }),
  C({ id: 'c2', subject: 'Campus Placement Drive - Zoho Corporation on 14.10.2026', shortTitle: 'Zoho Placement Drive',
      senderEmail: 'placement@tce.edu', senderName: 'Placement Cell', receivedDate: '2026-10-04T11:00:00Z',
      categoryId: 3, priority: 'HIGH', tags: ['placement', 'zoho', 'drive'], expireDate: '2026-10-11',
      bodyText: 'Zoho Corporation will conduct a campus recruitment drive for final-year B.E./B.Tech and M.C.A. students on 14.10.2026. Minimum aggregate of 70% is required. Register through the placement portal before 11.10.2026.',
      summaryBullets: ['Drive on 14.10.2026', 'Register before 11.10.2026', 'Minimum 70% aggregate'] }),
  C({ id: 'c3', subject: 'Reopening of Classes after Deepavali Vacation', shortTitle: 'Classes Resume',
      senderEmail: 'academics@tce.edu', senderName: 'Dean Academics', receivedDate: '2026-10-03T08:30:00Z',
      categoryId: 2, priority: 'NORMAL', tags: ['holiday', 'classes'],
      bodyText: 'The college will remain closed for Deepavali from 18.10.2026 to 21.10.2026. Classes will resume as usual on 22.10.2026 as per the revised timetable published on the student portal.' }),
  C({ id: 'c4', subject: 'Semester Fee Payment - Last Date with Late Fee', shortTitle: 'Semester Fee Deadline',
      senderEmail: 'accounts@tce.edu', senderName: 'Accounts Office', receivedDate: '2026-10-02T14:45:00Z',
      categoryId: 6, priority: 'URGENT', tags: ['fee', 'deadline', 'payment'], expireDate: '2026-10-06',
      bodyText: 'Students are instructed to pay the semester tuition fee before 10.10.2026. A late fee of Rs. 500 will be charged from 11.10.2026 onwards. Payment can be made online through the student portal.',
      summaryBullets: ['Pay before 10.10.2026', 'Late fee Rs. 500 from 11.10.2026'] }),
  C({ id: 'c5', subject: 'National Conference on Applied Computing - Call for Papers', shortTitle: 'NCAC Call for Papers',
      senderEmail: 'research@tce.edu', senderName: 'Research Cell', receivedDate: '2026-10-01T10:20:00Z',
      categoryId: 5, priority: 'NORMAL', tags: ['conference', 'call-for-papers', 'research'], expireDate: '2026-11-05',
      bodyText: 'The Department of Computer Applications is organising a National Conference on Applied Computing (NCAC 2026) on 28.11.2026. Authors are invited to submit original research papers before 05.11.2026.' }),
  C({ id: 'c6', subject: 'Provisional Results - IV Semester M.C.A. (Supplementary)', shortTitle: 'IV Sem MCA Results',
      senderEmail: 'exams@tce.edu', senderName: 'Examination Cell', receivedDate: '2026-09-29T16:00:00Z',
      categoryId: 1, priority: 'HIGH', tags: ['result', 'mca', 'supplementary'],
      bodyText: 'The provisional results of IV Semester M.C.A. supplementary examinations are published. Students may access their results through the student portal. Revaluation applications are accepted until 10.10.2026.' }),
  C({ id: 'c7', subject: 'Workshop on Full Stack Web Development with MERN', shortTitle: 'MERN Workshop',
      senderEmail: 'training@tce.edu', senderName: 'Training Cell', receivedDate: '2026-09-28T09:00:00Z',
      categoryId: 5, priority: 'NORMAL', tags: ['workshop', 'mern', 'training'], expireDate: '2026-10-15',
      bodyText: 'A two-day hands-on workshop on Full Stack Web Development with the MERN stack will be conducted on 17.10.2026 and 18.10.2026 in Lab 4. Registration is limited to 60 students.' }),
  C({ id: 'c8', subject: 'Library Account Renewal and Digital Access', shortTitle: 'Library Renewal',
      senderEmail: 'library@tce.edu', senderName: 'Central Library', receivedDate: '2026-09-27T12:10:00Z',
      categoryId: 2, priority: 'LOW', tags: ['library', 'renewal'],
      bodyText: 'All library accounts must be renewed before 30.10.2026 to retain uninterrupted digital journal access. Students with overdue books must clear dues before renewal.' }),
  C({ id: 'c9', subject: 'Internship Opportunity - Indian Space Research Organisation', shortTitle: 'ISRO Internship',
      senderEmail: 'research@tce.edu', senderName: 'Research Cell', receivedDate: '2026-09-26T15:30:00Z',
      categoryId: 3, priority: 'HIGH', tags: ['internship', 'isro', 'summer'], expireDate: '2026-10-18',
      bodyText: 'Applications are invited for summer internships at ISRO centres for B.E./B.Tech and M.C.A. students. Interested students may apply through the research cell before 18.10.2026.' }),
  C({ id: 'c10', subject: 'Hostel Room Allotment for the Academic Year 2026-2027', shortTitle: 'Hostel Allotment',
      senderEmail: 'hostel@tce.edu', senderName: 'Hostel Office', receivedDate: '2026-09-25T10:00:00Z',
      categoryId: 6, priority: 'NORMAL', tags: ['hostel', 'allotment'],
      bodyText: 'Room allotment for the academic year 2026-2027 will be published on 12.10.2026. Students reporting after 20.10.2026 will be allotted rooms strictly on availability.' }),
  C({ id: 'c11', subject: 'Holiday Notice - Gandhi Jayanti and Id-ul-Azha', shortTitle: 'Holiday Notice',
      senderEmail: 'admin@tce.edu', senderName: 'Registrar Office', receivedDate: '2026-09-24T08:00:00Z',
      categoryId: 4, priority: 'LOW', tags: ['holiday'],
      bodyText: 'The college will remain closed on 02.10.2026 on account of Gandhi Jayanti and on 06.10.2026 on account of Id-ul-Azha. Normal working will resume the following day.' }),
  C({ id: 'c12', subject: 'Anti-Ragging Committee Meeting - Action Plan 2026', shortTitle: 'Anti-Ragging Meeting',
      senderEmail: 'admin@tce.edu', senderName: 'Registrar Office', receivedDate: '2026-09-23T13:00:00Z',
      categoryId: 6, priority: 'NORMAL', tags: ['anti-ragging', 'committee'],
      bodyText: 'The Anti-Ragging Committee meeting will be held on 10.10.2026 at 10:30 AM in the Conference Hall. All committee members are requested to attend without fail.' }),
  C({ id: 'c13', subject: 'Partial Revaluation Results - VI Semester B.E. Examinations', shortTitle: 'Revaluation Results',
      senderEmail: 'exams@tce.edu', senderName: 'Examination Cell', receivedDate: '2026-09-22T17:00:00Z',
      categoryId: 1, priority: 'NORMAL', tags: ['result', 'revaluation'],
      bodyText: 'Provisional revaluation results of VI Semester B.E. examinations are published. The consolidated mark statement can be collected from the examination office on working days.' }),
  C({ id: 'c14', subject: 'Annual Tech Symposium - TECHNEX 2026 Registration Open', shortTitle: 'TECHNEX 2026',
      senderEmail: 'events@tce.edu', senderName: 'Student Activities', receivedDate: '2026-09-21T11:45:00Z',
      categoryId: 5, priority: 'NORMAL', tags: ['symposium', 'technex', 'events'], expireDate: '2026-10-25',
      bodyText: 'Registration for TECHNEX 2026, the annual technical symposium, is open. Twelve events across programming, robotics and paper presentation categories are offered. Register before 25.10.2026.' }),
];

const USERS = [
  { id: 'u1', email: 'admin@tce.edu', fullName: 'Dr. Priya Menon', role: 'ADMIN', department: 'Computer Applications', isActive: true, createdAt: '2026-08-01T09:00:00Z' },
  { id: 'u2', email: 'thiru@example.edu', fullName: 'Thirunavarasuru S', role: 'STUDENT', department: 'Computer Applications', isActive: true, createdAt: '2026-08-10T09:00:00Z' },
  { id: 'u3', email: 'aswin@example.edu', fullName: 'Aswin C', role: 'STUDENT', department: 'Computer Applications', isActive: true, createdAt: '2026-08-10T09:05:00Z' },
  { id: 'u4', email: 'staff@tce.edu', fullName: 'Prof. R. Karthik', role: 'STUDENT', department: 'Computer Applications', isActive: false, createdAt: '2026-08-12T09:00:00Z' },
];

const ADMIN_USER = USERS[0];

function paginate(items, u) {
  const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10));
  const limit = Math.max(1, parseInt(u.searchParams.get('limit') || '10', 10));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    pagination: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
  };
}

function filterCirculars(u) {
  const p = u.searchParams;
  let items = CIRCULARS.slice();
  const q = (p.get('q') || '').toLowerCase();
  if (q) items = items.filter(c => (c.subject + ' ' + c.bodyText + ' ' + (c.senderName || '') + ' ' + c.tags.join(' ')).toLowerCase().includes(q));
  if (p.get('categoryId')) items = items.filter(c => String(c.categoryId) === p.get('categoryId'));
  if (p.get('priority')) items = items.filter(c => c.priority === p.get('priority'));
  if (p.get('tag')) items = items.filter(c => c.tags.includes(p.get('tag')));
  if (p.get('senderName')) items = items.filter(c => (c.senderName || '') === p.get('senderName'));
  if (p.get('startDate')) items = items.filter(c => c.receivedDate >= p.get('startDate'));
  if (p.get('endDate')) items = items.filter(c => c.receivedDate <= p.get('endDate') + 'T23:59:59Z');
  if (p.get('endingToday') === 'true') items = items.filter(c => c.expireDate && c.expireDate <= '2026-10-06');
  items.sort((a, b) => (b.priorityOrder - a.priorityOrder) || (b.receivedDate < a.receivedDate ? -1 : 1));
  return items;
}

const json = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
};

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost:5000');
  const path = u.pathname;
  const method = req.method;
  console.log(method, path);

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  if (path === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    const t = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => clearInterval(t));
    return;
  }

  if (path === '/api/auth/login' && method === 'POST') return json(res, 200, { accessToken: 'mock-access', refreshToken: 'mock-refresh', user: ADMIN_USER });
  if (path === '/api/auth/register' && method === 'POST') return json(res, 200, { accessToken: 'mock-access', refreshToken: 'mock-refresh', user: ADMIN_USER });
  if (path === '/api/auth/logout') return json(res, 200, { success: true });
  if (path === '/api/auth/me') return json(res, 200, { user: ADMIN_USER });
  if (path === '/api/auth/google/status') return json(res, 200, { enabled: false });
  if (path === '/api/auth/google/connection') return json(res, 200, { connected: false });
  if (path === '/api/push/vapid-public-key') return json(res, 200, { publicKey: 'BNq3Zt0yJ0nL0mQwE2fH4kS5vT7xP1aC8dE6gI9jK0lM2oN4pQ6rS8tU0vW2xY4zA0bC2dE4fG6hI8jK0lM=' });

  if (path === '/api/circulars' && method === 'GET') return json(res, 200, paginate(filterCirculars(u), u));
  if (path === '/api/circulars/ending-today-count') return json(res, 200, { count: CIRCULARS.filter(c => c.expireDate && c.expireDate <= '2026-10-06').length });
  if (path === '/api/search' && method === 'GET') return json(res, 200, paginate(filterCirculars(u), u));
  if (path === '/api/search/suggestions') return json(res, 200, { categories: CATS, tags: [...new Set(CIRCULARS.flatMap(c => c.tags))], priorities: ['URGENT', 'HIGH', 'NORMAL', 'LOW'] });
  if (/^\/api\/circulars\/[^/]+\/read$/.test(path)) return json(res, 200, { success: true, isRead: true });
  const mDetail = path.match(/^\/api\/circulars\/([^/]+)$/);
  if (mDetail) {
    const c = CIRCULARS.find(x => x.id === mDetail[1]);
    return c ? json(res, 200, { circular: c }) : json(res, 404, { error: 'Not found' });
  }

  if (path === '/api/categories' && method === 'GET') return json(res, 200, { data: CATS });
  if (path === '/api/admin/overview') return json(res, 200, {
    totalCirculars: CIRCULARS.length,
    totalByCategory: { Examinations: 3, Academic: 2, Placements: 2, Holidays: 1, Events: 3, Administration: 3 },
    totalByPriority: { URGENT: 2, HIGH: 3, NORMAL: 7, LOW: 2 },
    circularsThisWeek: 7, unprocessedCount: 0, totalAttachments: 1,
  });
  if (path === '/api/users') return json(res, 200, { data: USERS });

  return json(res, 404, { error: 'Not found: ' + path });
});

server.listen(5000, () => console.log('mock api on :5000'));
