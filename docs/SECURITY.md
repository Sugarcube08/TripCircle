# tripCircle — Security & Privacy Architecture

## 1. Authentication & Session Security

- **Password Hashing:** Passwords are hashed using standard bcrypt with salt rounds $\ge 10$. Plaintext passwords are never stored or logged.
- **Access Tokens:** Short-lived JWTs (15 minutes expiry) containing minimal non-sensitive identity claims (`userId`, `email`).
- **Refresh Token Rotation:** Refresh tokens (7 days expiry) are hashed via SHA-256 and stored in the database. Every refresh operation revokes the previous token and issues a new pair.
- **Session Revocation:** On password reset or logout, sessions are explicitly invalidated in the database.
- **Client Storage:** Tokens in the mobile client are stored via `expo-secure-store` (iOS Keychain / Android Keystore) rather than plain unencrypted storage.

---

## 2. Authorization & Data Isolation

- **Resource-Level Authorization:** Authorization is verified on every request at the data layer, not merely route middleware.
  - Only active trip members can view trip details or submit expenses.
  - Only the designated receiver can confirm or dispute a payment.
  - Only the original submitter or trip creator can edit an expense.
  - Only the trip creator can close or reopen a trip.
  - Cross-trip data leakage is prevented via strict composite index queries (`tripId`, `userId`).

---

## 3. Concurrency & Financial Integrity

- **Optimistic Concurrency Control (OCC):** Expenses carry an integer `version` field. Concurrent edits check `expectedVersion === currentVersion`, preventing lost updates with structured `409 Conflict` errors.
- **Idempotency Keys:** Payment submissions support client-generated `idempotencyKey` strings. Retried requests due to timeouts return the original payment without double-debiting.
- **Database Transactions:** All balance-affecting operations (expense creation/editing, payment confirmation, discount acceptance) run inside atomic `prisma.$transaction()` boundaries.

---

## 4. File Upload & Media Protection (Cloudflare R2)

- **Private Bucket Architecture:** The Cloudflare R2 bucket (`tripcircle-assets`) is strictly private. Public bucket browsing and anonymous access are disabled.
- **Short-Lived Presigned URLs:**
  - Presigned upload URLs expire in 5 minutes (300 seconds).
  - Presigned download URLs expire in 15 minutes (900 seconds).
  - Presigned URLs are bearer tokens; the complete signed URLs are never written to application logs.
- **Resource-Level Authorization on Downloads:** A user cannot obtain a download URL by knowing the object key. Every download request verifies that the requesting user is an active member of the trip (for receipts/covers) or shares a trip with the user (for payment QR codes).
- **MIME-Type & Extension Whitelist:** Strict whitelist: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, and `application/pdf`. Unrecognized extensions default to `.bin`.
- **Size Limits:** Enforced at 10 MB per file, validated prior to issuing upload URLs and re-verified on the storage driver before persisting database metadata.
- **Opaque File Names & Key Hierarchy:**
  - Avatars: `users/{userId}/avatars/{uuid}.webp`
  - Payment QR: `users/{userId}/payment-qr/{uuid}.png`
  - Expense receipts: `trips/{tripId}/expenses/{expenseId}/{uuid}.jpg`
  - Payment receipts: `trips/{tripId}/payments/{paymentId}/{uuid}.jpg`
  - Trip covers: `trips/{tripId}/covers/{uuid}.webp`
  - All identifiers are sanitized against path traversal (`../` stripped).

---

## 5. Email & SMTP Security (Gmail)

- **Dedicated App Passwords:** Standard Google account passwords are prohibited. Gmail SMTP requires 2-Step Verification and a 16-character Google Account App Password.
- **Mandatory TLS:** Port 587 operates over STARTTLS. In production, TLS certificate verification is strictly enforced (`rejectUnauthorized: true`).
- **No Sensitive Credential Logging:** OTP values, password recovery tokens, SMTP passwords, and database connection strings are masked and never emitted to console logs or API responses in production.
- **Atomic Outbox Processing:** Emails are never dispatched directly in an uncommitted database transaction. Outbox events are persisted atomically with business records, preventing orphaned state or partial failures.

---

## 6. Mobile Client Secrets Isolation

- **Zero Server Secrets in Mobile Binaries:** The React Native / Expo application contains only the public API URL (`EXPO_PUBLIC_API_URL`).
- Database credentials, Cloudflare R2 access keys, SMTP secrets, and JWT private signing secrets exist exclusively on the server.
- The mobile application uploads files directly to R2 using temporary presigned PUT URLs, and requests short-lived authorized GET URLs from the API when displaying receipts.

---

## 7. Privacy & Information Disclosure

- **Password Reset Protection:** The password recovery endpoint returns identical generic success responses whether an email is registered or not, preventing email enumeration.
- **Sensitive Credentials:** Database passwords, JWT secrets, SMTP credentials, and encryption keys are strictly read from environment variables and never checked into source control.
