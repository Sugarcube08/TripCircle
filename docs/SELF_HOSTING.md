# TripCircle Self-Hosting & Private Deployment Guide

This guide describes how to run and deploy your own private instance of the TripCircle API, database, and background services.

---

## 1. Prerequisites

- Node.js $\ge 20$
- pnpm $\ge 10$
- Docker & Docker Compose
- S3-compatible object storage (e.g., Cloudflare R2, AWS S3, MinIO)
- SMTP provider for transactional emails (e.g., Gmail App Passwords, SendGrid, Amazon SES)

---

## 2. Infrastructure Setup via Docker Compose

Start the local MySQL 8.0 instance:

```bash
docker compose up -d
```

---

## 3. Environment Configuration

Copy the example environment configuration in `apps/api/.env.example` to `apps/api/.env`:

```bash
cp apps/api/.env.example apps/api/.env
```

Ensure the following variables are configured:

```env
# Database
DATABASE_URL="mysql://tripcircle:tripcircle_secret@localhost:3306/tripcircle"

# Authentication
JWT_ACCESS_SECRET="your-256-bit-access-secret"
JWT_REFRESH_SECRET="your-256-bit-refresh-secret"

# Object Storage (Cloudflare R2 or S3)
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key"
R2_SECRET_ACCESS_KEY="your-r2-secret-key"
R2_BUCKET_NAME="tripcircle"
R2_PUBLIC_URL="https://your-custom-domain.com"

# Email Delivery (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="notifications@yourdomain.com"
SMTP_PASS="your-app-password"
SMTP_FROM="TripCircle <notifications@yourdomain.com>"
```

---

## 4. Database Migrations & Seeding

```bash
# Push database schema
pnpm db:migrate

# Optional: seed 5 test accounts & demo trip
pnpm db:seed
```

---

## 5. Building & Running the API Server

```bash
# Build contracts and Next.js standalone server
pnpm build

# Start the production Next.js API server
pnpm --filter @tripcircle/api start
```

---

## 6. Configuring the Mobile App for Your Private Server

In `apps/mobile/.env`, set:

```env
EXPO_PUBLIC_API_URL="https://your-api-domain.com/api/v1"
EXPO_PUBLIC_UPDATE_METADATA_URL="https://your-api-domain.com/version.json"
```

Then build or run the mobile application:

```bash
pnpm dev:mobile
```
