# tripCircle — Independent Deployment Guide

The API server and mobile application are built, configured, and released completely independently.

---

## 1. Local Development Infrastructure

The root repository contains a `docker-compose.yml` that provisions MySQL 8.0 and the API service:

```bash
# 1. Start MySQL 8.0 container
pnpm docker:up

# 2. Install workspace dependencies
pnpm install

# 3. Apply database migrations
pnpm db:migrate

# 4. Seed demo users, trip, expenses, and payments
pnpm db:seed

# 5. Start API server on http://localhost:3000
pnpm dev:api

# 6. Start Mobile App on Expo
pnpm dev:mobile
```

---

## 2. API Server Production Deployment

### Docker Deployment
The API provides a multi-stage standalone Dockerfile (`apps/api/Dockerfile`):

```bash
# Build the production Docker image
docker build -t tripcircle-api:1.0.0 -f apps/api/Dockerfile .

# Run the container
docker run -d \
  --name tripcircle-api \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="mysql://tripcircle:tripcircle_pass@mysql-host:3306/tripcircle" \
  -e JWT_ACCESS_SECRET="production-256bit-access-secret" \
  -e JWT_REFRESH_SECRET="production-256bit-refresh-secret" \
  -e STORAGE_DRIVER=local \
  -e LOCAL_UPLOAD_DIR=/app/uploads \
  tripcircle-api:1.0.0
```

### Bare Metal / Cloud Hosting (Vercel, Railway, Render, AWS ECS)
1. Set the root directory to `apps/api`.
2. Configure environment variables (see `.env.example`).
3. Build command:
   ```bash
   pnpm --filter @tripcircle/contracts build && pnpm --filter @tripcircle/api build
   ```
4. Start command:
   ```bash
   node apps/api/server.js   # (Standalone output) or next start -p 3000
   ```

---

## 3. Mobile Application Deployment

The mobile application is completely decoupled from the API source. It communicates over standard HTTPS REST endpoints configured via `EXPO_PUBLIC_API_URL`.

### Configuration
Set the production API URL in `apps/mobile/.env`:
```env
EXPO_PUBLIC_API_URL="https://api.yourdomain.com/api/v1"
```

### Android APK / AAB Build (via EAS Build)
```bash
cd apps/mobile

# Install EAS CLI
npm install -g eas-cli

# Log in to Expo
eas login

# Configure project
eas build:configure

# Build Android Release APK or Android App Bundle (AAB for Google Play Store)
eas build --platform android --profile production
```

### iOS IPA Build (for Apple App Store)
```bash
cd apps/mobile
eas build --platform ios --profile production
```
