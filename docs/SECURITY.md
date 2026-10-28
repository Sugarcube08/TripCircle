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

## 4. File Upload & Media Protection

- **MIME-Type Whitelist:** Only `image/jpeg`, `image/png`, `image/webp`, and `application/pdf` are accepted.
- **Size Limits:** Hard-capped at 10 MB per file.
- **Opaque File Names:** Files are stored under random UUIDs to prevent directory traversal or predictable file enumeration attacks.
- **Sanitized Paths:** File serving uses `path.basename` sanitization against path traversal exploits.

---

## 5. Privacy & Information Disclosure

- **Password Reset Protection:** The password recovery endpoint returns identical generic success responses whether an email is registered or not, preventing email enumeration.
- **Sensitive Credentials:** Database passwords, JWT secrets, SMTP credentials, and encryption keys are strictly read from environment variables and never checked into source control.
