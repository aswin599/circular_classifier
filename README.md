# Circular Management System

A production-grade MERN stack application for managing institutional circulars. The system connects to an email account, fetches emails tagged as "circulars", extracts text from PDF/image attachments via OCR, classifies them using keyword matching, and provides a searchable, filterable interface.

## ✨ Features

- **Email Integration** - Fetches circular emails from Gmail (via Google OAuth) or IMAP, filters by label/tag
- **Google Login** - Sign in with Google with Gmail read access
- **Expiry Detection** - Automatically detects expiry/last dates (e.g. "valid until", "deadline", "last date") from email body and extracted attachment text; shows days remaining on every circular
- **Text Extraction** - Extracts text from PDF, DOCX, and image attachments (OCR)
- **Automatic Classification** - Keyword-based classification into configurable categories
- **Priority Detection** - Automatically identifies urgent/high priority circulars
- **Full-Text Search** - Search by subject, content, sender, or tags
- **Advanced Filtering** - Filter by category, priority, date range, and tags
- **Role-Based Access** - Separate admin and student roles
- **Attachment Management** - View and download original PDFs/images
- **Background Processing** - Bull queue for async email fetching and text extraction
- **Dark Mode** - Full dark mode support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (for background job queues)
- An email account with IMAP access (Gmail, Outlook, etc.)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Root directory
cp .env.example server/.env
```

Edit `server/.env` and set your database URL, email credentials, and JWT secrets.

**For Gmail (OAuth login):**
1. Go to https://console.cloud.google.com/apis/credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
4. Copy the Client ID and Client Secret into `server/.env`:
   ```
   GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="...."
   ```
5. Sign in on the login page with **"Sign in with Google"** — this requests read access to Gmail so the app can import circular emails and their attachments.

**For Gmail (IMAP fallback):**
- Enable 2-Factor Authentication
- Generate an App Password at https://myaccount.google.com/apppasswords
- Use the app password in `EMAIL_PASSWORD`

### 3. Set Up the Database

```bash
# From the root directory
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed default categories and admin user
```

The seed creates:
- Admin user: `admin@circulars.edu` / `Admin@12345` (change this!)
- 6 default categories with keywords

### 4. Start the Application

```bash
# Start both server and client concurrently
npm run dev

# Or start them separately
npm run dev:server   # API on http://localhost:5000
npm run dev:client   # UI on http://localhost:5173
```

## 🗂️ Project Structure

```
circular-management-system/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   ├── contexts/           # Auth context
│   │   ├── hooks/              # React Query hooks
│   │   ├── lib/                # API client
│   │   ├── pages/              # Route pages
│   │   └── types/              # TypeScript types
│   └── vite.config.ts
├── server/                     # Express backend
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── seed.ts             # Seed data
│   └── src/
│       ├── config/             # Config files
│       ├── jobs/               # Bull queue processors
│       ├── middleware/         # Auth, validation, errors
│       ├── modules/            # Feature modules
│       ├── services/           # Business services
│       └── utils/              # Helpers
└── shared/                     # Shared types
```

## 🔧 Configuration

### Email Settings

The system connects to any IMAP server. Configure these in `server/.env`:

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_HOST` | IMAP server | `imap.gmail.com` |
| `EMAIL_PORT` | IMAP port | `993` |
| `EMAIL_USER` | Email address | `circulars@school.edu` |
| `EMAIL_PASSWORD` | App password | `xxxx xxxx xxxx xxxx` |
| `EMAIL_LABEL` | Label/folder to search | `circulars` |

### Triggering Email Fetch

1. Sign in with Google (recommended — Grants Gmail read access)
2. Go to the Dashboard
3. Click **"Sync Gmail"** — the app reads your inbox, downloads circular attachments (PDF/DOCX/images), extracts their text, and stores them as circulars.
4. Or (admin, IMAP): Click **"Fetch Emails"** to use the configured IMAP account.

### Manual Import

For testing without a real email account, use the API:

```bash
curl -X POST http://localhost:5000/api/processor/import \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": {
      "messageId": "test-1",
      "subject": "Final Exam Schedule",
      "senderEmail": "office@school.edu",
      "senderName": "Exam Office",
      "receivedDate": "2024-01-15T10:00:00Z",
      "bodyText": "The final exams will be held...",
      "attachments": []
    }
  }'
```

## 🔐 Authentication

### Default Admin Credentials

```
Email: admin@circulars.edu
Password: Admin@12345
```

**⚠️ Important: Change these credentials after first login!** Register a new account and promote them to admin through the admin panel, or update directly in the database.

### Role-Based Access

| Feature | Student | Admin |
|---------|---------|-------|
| View circulars | ✅ | ✅ |
| Search & filter | ✅ | ✅ |
| Download attachments | ✅ | ✅ |
| Trigger email fetch | ❌ | ✅ |
| Edit/delete circulars | ❌ | ✅ |
| Manage categories | ❌ | ✅ |
| Manage users | ❌ | ✅ |

## 📡 API Endpoints

### Authentication
```
POST   /api/auth/register          - Register new user
POST   /api/auth/login             - Login
POST   /api/auth/refresh           - Refresh access token
GET    /api/auth/me                - Get current user
POST   /api/auth/logout            - Logout

GET    /api/auth/google            - Redirect to Google sign-in (OAuth)
GET    /api/auth/google/callback   - OAuth callback (issues JWT, redirects to client)
GET    /api/auth/google/status     - Whether Google login is configured
GET    /api/auth/google/connection - Current user's Gmail connection status
POST   /api/auth/google/fetch      - Import circulars from connected Gmail (with attachments)
POST   /api/auth/google/refresh-token - Refresh the stored Gmail access token
POST   /api/auth/google/disconnect - Disconnect Gmail access
```

### Circulars
```
GET    /api/circulars              - List circulars (paginated, filterable)
GET    /api/circulars/:id          - Get single circular
POST   /api/circulars              - Create circular (admin)
PUT    /api/circulars/:id          - Update circular (admin)
DELETE /api/circulars/:id          - Delete circular (admin)
GET    /api/circulars/:id/view/:attachmentId    - View attachment inline
GET    /api/circulars/:id/download/:attachmentId - Download attachment
```

### Search
```
GET    /api/search                 - Full-text search + filters
GET    /api/search/suggestions     - Get filter suggestions
```

### Categories
```
GET    /api/categories             - List all categories
GET    /api/categories/:id         - Get category
POST   /api/categories             - Create category (admin)
PUT    /api/categories/:id         - Update category (admin)
DELETE /api/categories/:id         - Delete category (admin)
```

### Admin
```
GET    /api/admin/overview         - Dashboard statistics
GET    /api/users                  - List users (admin)
PATCH  /api/users/:id/role         - Change user role (admin)
PATCH  /api/users/:id/status       - Activate/deactivate user (admin)
```

### Processor
```
POST   /api/processor/fetch        - Trigger email fetch job (admin)
POST   /api/processor/import       - Manually import email data
POST   /api/processor/reclassify-all - Reclassify all circulars
```

## 🔄 Background Jobs

The system uses Bull queue with Redis for background processing:

1. **Email Fetch Queue** - Connects to IMAP, fetches emails with the configured label
2. **Text Extraction Queue** - Extracts text from PDFs and runs OCR on images
3. **Classification Queue** - Classifies circulars based on extracted keywords

Redis must be running for background processing to work.

## 📊 Classification System

The classifier uses keyword matching to assign categories and priorities:

- **Categories** are configurable through the admin panel
- Each category has an array of keywords
- Text from subject + body + extracted content is matched against keywords
- Priority is determined by secondary keywords (urgent, important, etc.)

## 🛠️ Production Considerations

- All JWT secrets must be changed
- Default admin credentials must be changed
- CORS is restricted to `CLIENT_URL`
- Rate limiting is applied to API endpoints
- File upload size limits are enforced
- Structured logging via Winston
- Graceful shutdown handling

## 🧪 Testing

```bash
# Server tests
cd server && npm test

# Client type checking
cd client && npm run typecheck
```

## 📝 License

MIT
