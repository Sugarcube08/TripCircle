# TripCircle — Independent Deployment & Production Infrastructure Guide

**Product:** TripCircle  
**Infrastructure Target:** Cloudflare R2 + Gmail SMTP + Remote MySQL Database  

The API server and mobile application are built, configured, and released completely independently.

---

## 1. Cloudflare R2 Object Storage Setup

TripCircle uses Cloudflare R2 via its S3-compatible API for receipts, avatars, trip covers, and payment QR codes.

### Step 1: Create a Private Bucket
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com) and navigate to **R2 Object Storage**.
2. Click **Create bucket**.
3. Set bucket name: `tripcircle-assets` (or your chosen name).
4. **Access policy:** Keep the bucket **Private** (do NOT enable public bucket read). All sensitive financial receipts and QR codes must require authenticated presigned download URLs.

### Step 2: Generate Restricted API Credentials
1. In Cloudflare R2, click **Manage R2 API Tokens**.
2. Click **Create API Token**.
3. Permissions: **Object Read & Write**.
4. Specify bucket: Apply only to `tripcircle-assets`.
5. TTL: Set according to your security rotation policy.
6. Copy the resulting credentials:
   - `Account ID`
   - `Access Key ID`
   - `Secret Access Key`
   - Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

### Step 3: Server Environment Variables
Add to your API environment:
```dotenv
STORAGE_DRIVER=r2
R2_ACCOUNT_ID="<your-cloudflare-account-id>"
R2_ACCESS_KEY_ID="<your-access-key-id>"
R2_SECRET_ACCESS_KEY="<your-secret-access-key>"
R2_BUCKET_NAME="tripcircle-assets"
R2_REGION="auto"
```

---

## 2. Gmail SMTP Email Delivery Setup

TripCircle sends email verification OTPs, password recovery codes, and trip invitations through Gmail SMTP.

### Step 1: Prepare Gmail Account
1. Choose or create the Google/Gmail account for sending application emails (e.g. `notifications@yourdomain.com` or `tripcircle.app@gmail.com`).
2. Go to **Google Account Settings** -> **Security**.
3. Under *How you sign in to Google*, ensure **2-Step Verification** is turned **ON**.

### Step 2: Generate an App Password
1. In Google Account Security, search for or select **App passwords**.
2. Under App name, type `TripCircle API`.
3. Click **Create**.
4. Google will generate a 16-character passcode (e.g. `abcd efgh ijkl mnop`).
5. **Never use your personal Google account password.** Store this 16-character App Password as `SMTP_PASSWORD`.

### Step 3: Server Environment Variables
```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-16-char-app-password"
SMTP_FROM_NAME="TripCircle"
SMTP_FROM_EMAIL="your-email@gmail.com"
```
*Note:* Port 587 uses STARTTLS. TripCircle automatically enforces TLS certificate validation in production (`rejectUnauthorized: true`).

---

## 3. Remote MySQL Database Configuration

TripCircle requires MySQL 8.0 or compatible managed MySQL (e.g. AWS RDS MySQL, DigitalOcean Managed MySQL, PlanetScale, Google Cloud SQL, Railway, Aiven).

### Step 1: Provisioning & Connection String
Format:
```dotenv
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE_NAME?sslaccept=strict"
DATABASE_CONNECTION_LIMIT=10
```

#### Special Character Encoding
If your database password contains characters such as `@`, `:`, `/`, `?`, `#`, or `%`, ensure they are URL-encoded:
- `@` -> `%40`
- `:` -> `%3A`
- `/` -> `%2F`
- `#` -> `%23`

#### SSL/TLS Requirements
- AWS RDS / DigitalOcean / Aiven: Append `?sslaccept=strict` or `?sslmode=REQUIRED`.
- PlanetScale: Append `?ssl={"rejectUnauthorized":true}`.

### Step 2: Production Migrations
**Never run `prisma db push` or destructive resets in production.**
Apply migrations strictly using Prisma Migrate Deploy:
```bash
# In CI/CD or deployment container release phase:
pnpm --filter @tripcircle/api db:migrate
# Underlying command: npx prisma migrate deploy
```

---

## 4. Background Processing & Durable Outbox

TripCircle records transactional events (`EMAIL_VERIFY_REQUESTED`, `PAYMENT_CREATED`, `DISCOUNT_PROPOSED`, etc.) atomically into the MySQL `OutboxEvent` table.

### Option A: Long-running Daemon (VPS, Docker, ECS, Railway)
Run the dedicated worker alongside the API container:
```bash
cd apps/api
node scripts/run-worker.mjs
```
Environment variables:
- `WORKER_POLL_INTERVAL_MS=5000` (default 5 seconds)
- `WORKER_BATCH_SIZE=25` (default 25 events per cycle)

### Option B: Scheduled Cron Trigger (Serverless / Edge / Render)
Trigger the API outbox runner endpoint via external cron (e.g. every minute):
```bash
curl -X POST https://api.yourdomain.com/api/v1/jobs/outbox \
  -H "Authorization: Bearer <CRON_SECRET>"
```

---

## 5. Non-Docker & Serverless Deployment (Vercel, Render, Railway, Bare VPS)

The API is a standard Next.js 14 application that can be built and deployed individually without Docker.

### 5.1 Vercel Deployment (Recommended for Serverless)

When deploying on Vercel:
1. In the Vercel Dashboard, click **Add New Project** and import the GitHub repository.
2. In the project configuration:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Click Edit and select `apps/api`.
   - **Build Command:** Leave as default (`prisma generate && next build`).
   - **Output Directory:** Leave as default (`.next`).
   - **Install Command:** Leave as default (`pnpm install`).
3. Add your production environment variables (from `apps/api/.env.example`):
   - `DATABASE_URL`: Your remote MySQL connection string (e.g. Aiven, PlanetScale, AWS RDS). Ensure the port is included (e.g. `:15832`) and SSL is enabled.
   - `DATABASE_CONNECTION_LIMIT`: `10`
   - `JWT_ACCESS_SECRET`: High-entropy 32+ character random secret
   - `JWT_REFRESH_SECRET`: High-entropy 32+ character random secret
   - `STORAGE_DRIVER`: `r2`
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
   - `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`
4. Click **Deploy**. Vercel will build and deploy the API as serverless functions.

### 5.2 Render or Railway (Standard Node.js Web Service)
1. **Root Directory:** `apps/api` (or monorepo root).
2. **Build Command:**
   ```bash
   pnpm --filter @tripcircle/contracts build && pnpm --filter @tripcircle/api build
   ```
3. **Start Command:**
   ```bash
   node apps/api/server.js
   ```
   *(Or `pnpm --filter @tripcircle/api start`)*

### 5.3 Bare Linux VPS (Systemd or PM2 without Docker)
1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/your-org/tripcircle.git
   cd tripcircle
   pnpm install
   ```
2. Build the contracts and API:
   ```bash
   pnpm build:api
   ```
3. Run database migrations:
   ```bash
   pnpm db:migrate
   ```
4. Start via PM2 or systemd:
   ```bash
   pm2 start apps/api/server.js --name tripcircle-api
   ```

---

## 6. Docker Deployment (Containers)

### Multi-stage Docker Build
Build the optimized standalone container:
```bash
docker build -t tripcircle-api:1.0.0 -f apps/api/Dockerfile .
```

### Running the Container
```bash
docker run -d \
  --name tripcircle-api \
  -p 3000:3000 \
  --restart always \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e API_BASE_URL="https://api.yourdomain.com" \
  -e APP_PUBLIC_URL="https://tripcircle.app" \
  -e DATABASE_URL="mysql://user:pass@remote-mysql-host:3306/tripcircle?sslaccept=strict" \
  -e DATABASE_CONNECTION_LIMIT=15 \
  -e JWT_ACCESS_SECRET="<generate-64-char-random-secret>" \
  -e JWT_REFRESH_SECRET="<generate-64-char-random-secret>" \
  -e STORAGE_DRIVER=r2 \
  -e R2_ACCOUNT_ID="<cloudflare-account-id>" \
  -e R2_ACCESS_KEY_ID="<r2-access-key-id>" \
  -e R2_SECRET_ACCESS_KEY="<r2-secret-access-key>" \
  -e R2_BUCKET_NAME="tripcircle-assets" \
  -e SMTP_HOST="smtp.gmail.com" \
  -e SMTP_PORT=587 \
  -e SMTP_SECURE=false \
  -e SMTP_USER="notifications@tripcircle.app" \
  -e SMTP_PASSWORD="<gmail-app-password>" \
  -e SMTP_FROM_NAME="TripCircle" \
  -e SMTP_FROM_EMAIL="notifications@tripcircle.app" \
  tripcircle-api:1.0.0
```

---

## 6. Mobile Application Deployment

The mobile application is completely standalone. It compiles into iOS IPA and Android APK/AAB binaries with zero server secrets.

### Production Environment
In `apps/mobile/.env`:
```dotenv
EXPO_PUBLIC_API_URL="https://api.yourdomain.com/api/v1"
```

### Build via Expo Application Services (EAS)
```bash
cd apps/mobile
npm install -g eas-cli
eas login
eas build --platform android --profile production
eas build --platform ios --profile production
```

---

## 7. Health Checks & Verification

### API & Infrastructure Readiness Probe
Test endpoint:
```bash
curl -i https://api.yourdomain.com/api/v1/health
```
Expected response (HTTP 200 OK):
```json
{
  "status": "healthy",
  "service": "TripCircle API",
  "version": "1.0.0",
  "environment": "production",
  "timestamp": "2026-10-28T15:00:00.000Z",
  "database": {
    "status": "connected",
    "latencyMs": 4
  },
  "storage": {
    "driver": "r2",
    "bucket": "tripcircle-assets",
    "configured": true
  },
  "email": {
    "provider": "Gmail SMTP",
    "host": "smtp.gmail.com",
    "port": 587,
    "configured": true
  }
}
```

---

## 8. Backup, Recovery & Rollback Procedures

### Daily Automated MySQL Backups
```bash
mysqldump -h remote-mysql-host -u user -p \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  tripcircle | gzip > "tripcircle_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
```

### Database Recovery
```bash
gunzip < tripcircle_backup_YYYYMMDD_HHMMSS.sql.gz | mysql -h remote-mysql-host -u user -p tripcircle
```

### Migration Rollback
If a migration fails or must be rolled back:
1. Identify the failing migration name from `_prisma_migrations`.
2. Apply the down migration SQL script manually via a secured maintenance session.
3. Mark migration as resolved:
   ```bash
   npx prisma migrate resolve --rolled-back "20261028000000_init"
   ```
