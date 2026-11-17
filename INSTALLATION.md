# 🥛 DairyTrack – Installation & Production Deployment Guide

This guide covers setting up and running **DairyTrack** locally for development, packaging in Docker containers, migrating to Supabase PostgreSQL, and deploying to cloud production platforms (Frontend on **Vercel**, Backend on **Render** / **Railway**).

---

## 📋 System Prerequisites

Ensure you have the following installed on your host machine:

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v9.x` or higher
- **Git**: Latest version
- **Docker & Docker Compose** (Optional, for containerized deployments)
- **Supabase Account**: Free tier or Pro for PostgreSQL cloud hosting

---

## 🛠️ 1. Local Development Setup

### Step 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/your-org/dairytrack.git
cd dairytrack
npm install
```

### Step 2: Configure Environment Variables
Duplicate the environment template:
```bash
cp .env.example .env
```
Edit `.env` with your preferred settings:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key_here
```

### Step 3: Build Backend & Frontend
```bash
# Build TypeScript server and Vite React client
npm run build:all
```

### Step 4: Run Application
```bash
# Start unified full-stack server on http://localhost:3000
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

Default local accounts:
- **Admin**: `admin@dairytrack.com` / `admin123`
- **Manager**: `manager@dairytrack.com` / `manager123`
- **Cashier**: `shopkeeper@dairytrack.com` / `staff123`

---

## 🐳 2. Docker Container Deployment

DairyTrack features a production-optimized multi-stage Docker build:

### Build Image
```bash
docker build -t dairytrack:latest .
```

### Run Container
```bash
docker run -d \
  --name dairytrack-prod \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=change_this_to_a_production_random_secret \
  -v dairytrack-data:/app/backups \
  dairytrack:latest
```

Verify container health:
```bash
curl http://localhost:3000/api/health
```

---

## 🗄️ 3. Supabase PostgreSQL Setup & Migration

### Step 1: Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create a new project.
2. Choose your closest region (e.g. `ap-south-1` for India / Mumbai).
3. Note your Database Password, Project URL, and API Keys.

### Step 2: Run Database Migrations
You can apply migrations using any of the following methods:

#### Option A: Automated Migration Runner
Configure your credentials in `.env`:
```env
DATABASE_URL=postgresql://postgres.your-project-id:your-db-password@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsIn...
```
Execute the runner:
```bash
npm run migrate
```

#### Option B: Supabase CLI
```bash
# Login to Supabase CLI
npx supabase login

# Link your remote project
npx supabase link --project-ref your-project-id

# Push migrations
npx supabase db push
```

#### Option C: Supabase SQL Editor
1. In the Supabase dashboard, open the **SQL Editor**.
2. Copy and paste the contents of `supabase/migrations/20261117000001_initial_schema.sql` and click **Run**.
3. Copy and paste the contents of `supabase/migrations/20261117000002_seed_data.sql` and click **Run**.

---

## 🌐 4. Frontend Deployment on Vercel

The frontend is built with React 19, Vite, and Tailwind CSS.

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Deploy to Vercel
```bash
vercel
```

### Step 3: Configure Project Settings in Vercel Dashboard
- **Framework Preset**: `Vite`
- **Root Directory**: `./`
- **Build Command**: `npm run build:vite`
- **Output Directory**: `dist/client`

### Step 4: Environment Variables on Vercel
Add the following in Vercel Project Settings -> Environment Variables:
- `VITE_API_URL`: Your backend API URL (e.g., `https://dairytrack-api.onrender.com/api`)
- `VITE_SUPABASE_URL`: `https://your-project-id.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJI...`

The included `vercel.json` automatically manages Single Page Application (SPA) routing fallbacks and asset caching.

---

## 🚀 5. Backend Deployment on Render / Railway

### Deploying on Render

1. Log in to [Render](https://render.com) and create a **New Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Environment**: `Node`
   - **Region**: Oregon or Frankfurt
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build:all`
   - **Start Command**: `node server/index.js`
   - **Health Check Path**: `/api/health`
4. Add the Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
   - `CLIENT_ORIGIN`: `https://dairytrack.vercel.app`
   - `DATABASE_URL`: `postgresql://postgres:pass@...`
   - `SUPABASE_URL`: `https://your-project-id.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: `eyJhbGci...`
   - `JWT_SECRET`: Generate a random 64-character string

*(Alternatively, connect using the included `render.yaml` blueprint).*

---

### Deploying on Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```
2. Link and deploy:
```bash
railway login
railway init
railway up
```
Railway reads the bundled `railway.json` and automatically sets up Nixpacks builds and health checks.

---

## 🔒 6. Production Security & Verification Checklist

Before going live with customer transactions:

1. [x] **Change all default passwords**: Update passwords for `admin`, `manager`, and `cashier` immediately.
2. [x] **Secure Secrets**: Ensure `.env` is never committed to version control.
3. [x] **Enable SSL/HTTPS**: Both Vercel and Render automatically provision free Let's Encrypt certificates.
4. [x] **Verify CORS**: Set `CLIENT_ORIGIN` to only allow your official production frontend domain.
5. [x] **Test Database Backups**: Run `POST /api/system/backup` to verify physical encrypted backup files and SHA-256 integrity checksums.
6. [x] **Run Full QA Verification**:
   ```bash
   npm run test:qa
   ```
   All 38 test suites must report 100% green before opening for billing.
