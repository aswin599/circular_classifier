# 🚀 Deployment Guide: Circular Management System

This guide explains how to deploy the Circular Management System to production.

---

## 📋 Architecture Overview

The system consists of three parts:
1. **Frontend**: React 18 + Vite SPA (`client/`)
2. **Backend**: Node.js + Express + TypeScript API (`server/`)
3. **Database**: MongoDB (Mongoose)

---

## 🌟 Method 1: All-in-One Cloud Deployment on Render (Recommended & Free)

This is the easiest and most cost-effective method. Render builds both the React frontend and Express backend, and serves them together on a single HTTPS domain with zero CORS issues.

### Step 1: Set Up MongoDB Atlas (Free Cloud Database)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign in/register (free).
2. Create a new **M0 (Free)** cluster.
3. Under **Database Access**, create a database user (e.g., `circular_admin`) and save the password.
4. Under **Network Access**, click **Add IP Address** and choose **Allow Access from Anywhere (`0.0.0.0/0`)**.
5. Click **Connect** > **Drivers** (Node.js) and copy the connection string:
   ```
   mongodb+srv://circular_admin:<password>@cluster0.xxxxx.mongodb.net/circulars_db?retryWrites=true&w=majority
   ```

### Step 2: Push Your Code to GitHub
Ensure all latest files (including the newly generated `Dockerfile`, `render.yaml`, and build configs) are pushed:
```bash
git add .
git commit -m "feat: configure production build and deployment"
git push origin main
```

### Step 3: Deploy on Render
1. Go to [Render.com](https://render.com/) and sign in with GitHub.
2. Click **New +** > **Web Service**.
3. Select your repository: `aswin599/circular_classifier`.
4. Configure the service:
   - **Name**: `circular-management-system` (or your choice)
   - **Region**: Choose the closest region (e.g. Singapore or Frankfurt)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Under **Environment Variables**, add:
   | Key | Value | Notes |
   |---|---|---|
   | `NODE_ENV` | `production` | Enables production mode |
   | `PORT` | `5000` | Render internal port |
   | `DATABASE_URL` | `mongodb+srv://...` | Your MongoDB Atlas connection URI |
   | `JWT_SECRET` | `generate-a-random-32-char-string` | e.g. via `openssl rand -hex 32` |
   | `JWT_REFRESH_SECRET` | `generate-another-random-32-char-string` | |
   | `CLIENT_URL` | `https://<your-render-subdomain>.onrender.com` | Your live Render URL |
   | `STUDENT_TUTOR_EMAIL` | `your-tutor-email@gmail.com` | Tutor mailbox for student view |
   | `EMAIL_HOST` | `imap.gmail.com` | (Optional: for IMAP sync) |
   | `EMAIL_USER` | `your-email@gmail.com` | |
   | `EMAIL_PASSWORD` | `your-gmail-app-password` | 16-character Google App Password |
   | `GOOGLE_CLIENT_ID` | `your-client-id.apps.googleusercontent.com` | (Optional: for Google sign-in) |
   | `GOOGLE_CLIENT_SECRET`| `your-client-secret` | |
   | `GOOGLE_REDIRECT_URI` | `https://<your-render-subdomain>.onrender.com/api/auth/google/callback` | |

6. Click **Create Web Service**. Render will install, build, and launch your live application!

---

## ⚡ Method 2: Split Deployment (Vercel Frontend + Render Backend)

If you prefer hosting the React frontend on Vercel's global CDN:

### Backend (Render / Railway):
1. Create a Web Service pointing to repository root.
2. **Build Command**: `npm install && npm run build --workspace=server`
3. **Start Command**: `npm run start --workspace=server`
4. Set the environment variables as above, setting `CLIENT_URL` to your Vercel URL (e.g. `https://my-app.vercel.app`).

### Frontend (Vercel):
1. Go to [Vercel](https://vercel.com/) > **Add New Project** > Import `aswin599/circular_classifier`.
2. **Root Directory**: `client`
3. **Framework Preset**: `Vite`
4. **Environment Variables**:
   - `VITE_API_URL`: `https://<your-backend-subdomain>.onrender.com`
5. Click **Deploy**.

---

## 🐳 Method 3: Containerized Deployment (Docker / VPS / AWS EC2 / DigitalOcean)

If deploying to an Ubuntu VPS or any server with Docker installed:

1. Clone your repository on the VPS:
   ```bash
   git clone https://github.com/aswin599/circular_classifier.git
   cd circular_classifier
   ```

2. Create a `.env` file in the root with your credentials:
   ```bash
   DATABASE_URL=mongodb://mongodb:27017/circulars_db
   JWT_SECRET=supersecretjwtstring12345
   JWT_REFRESH_SECRET=supersecretrefreshstring12345
   CLIENT_URL=http://your-server-ip:5000
   ```

3. Run with Docker Compose:
   ```bash
   docker compose up -d --build
   ```

4. Both MongoDB and the application will start automatically. You can access it on port `5000`.

---

## 🔑 Google OAuth Production Configuration

If you use **Sign in with Google**:
1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Edit your OAuth 2.0 Client ID.
3. Under **Authorized JavaScript Origins**, add:
   - `https://<your-deployed-domain>` (e.g. `https://circular-app.onrender.com`)
4. Under **Authorized Redirect URIs**, add:
   - `https://<your-deployed-domain>/api/auth/google/callback`
5. Save changes.
