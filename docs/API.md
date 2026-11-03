# TripCircle — REST API Reference (v1)

Base URL: `/api/v1`  
Authentication: HTTP Bearer Token (`Authorization: Bearer <jwt-access-token>`)

---

## 1. Authentication Endpoints

### `POST /auth/register`
Register a new user account.
- **Body:** `{ name, email, password, phone?, avatarUrl?, paymentQrUrl? }`
- **Response:** `201 Created` with userId and message. Dispatches OTP to email.

### `POST /auth/verify-otp`
Verify email or password recovery OTP.
- **Body:** `{ email, otp, purpose: 'EMAIL_VERIFY' | 'PASSWORD_RESET' }`
- **Response:** `200 OK` with `{ accessToken, refreshToken, user }`.

### `POST /auth/resend-otp`
Resend OTP with 60-second cooldown protection.
- **Body:** `{ email, purpose }`

### `POST /auth/login`
Authenticate with email and password.
- **Body:** `{ email, password }`
- **Response:** `200 OK` with `{ accessToken, refreshToken, user }`.

### `POST /auth/refresh`
Rotate refresh token and issue new access token.
- **Body:** `{ refreshToken }`
- **Response:** `200 OK` with `{ accessToken, refreshToken }`.

### `POST /auth/logout`
Revoke refresh token and invalidate current session.
- **Body:** `{ refreshToken }`

### `POST /auth/forgot-password`
Dispatch password recovery OTP.
- **Body:** `{ email }`

### `POST /auth/reset-password`
Reset password using verified recovery OTP.
- **Body:** `{ email, otp, newPassword }`

---

## 2. User & Profile Endpoints

### `GET /users/me`
Retrieve currently logged-in user profile with completed trip count.

### `PUT /users/profile`
Update user name, phone, avatar, or payment QR code.

### `POST /users/change-password`
Change account password given old password and new password.

### `GET /users/search?q=<query>`
Search registered users by normalized email or name for trip invitations.

---

## 3. Trip Management Endpoints

### `GET /trips`
Retrieve user's trips list with individual trip net balances and aggregate net position.

### `POST /trips`
Create a new trip.
- **Body:** `{ name, destination?, startDate, endDate?, currency?, coverImageUrl?, initialInvitedUserIds? }`

### `GET /trips/:id`
Retrieve trip dashboard details, members list with individual net balances, and total expenses.

### `PUT /trips/:id`
Update trip name, cover image, dates, or destination (Creator only).

### `POST /trips/:id/close`
Close the trip (Creator only). Blocks new expenses while preserving balance records.

### `POST /trips/:id/reopen`
Reopen a closed trip (Creator only).

### `POST /trips/:id/leave`
Leave a trip as an ordinary member. Retains existing obligations and payment rights.

### `GET /trips/:id/members`
List all members in the trip.

### `POST /trips/:id/members`
Invite a registered user to the trip by email or user ID.

---

## 4. Invitations Endpoints

### `GET /invitations`
Retrieve all pending trip invitations for the current user.

### `POST /invitations/:id/respond`
Accept or decline an invitation.
- **Body:** `{ action: 'ACCEPT' | 'DECLINE' }`

---

## 5. Expense Management Endpoints

### `GET /trips/:id/expenses`
List all active expenses for the trip with category, payer, and allocations.

### `POST /trips/:id/expenses`
Add a new expense. Affects balances immediately without approval.
- **Body:** `{ payerMemberId, amountPaise, categoryId, description, splitMethod, allocations, location?, note?, receiptUrl? }`

### `GET /trips/:id/expenses/:expenseId`
Get expense details and chronological revision history snapshots.

### `PUT /trips/:id/expenses/:expenseId`
Edit an expense.
- **Body:** `{ payerMemberId, amountPaise, categoryId, description, splitMethod, allocations, expectedVersion, changeReason? }`
- **Response:** `200 OK` on success, or `409 Conflict` if version mismatch.

### `GET /categories`
List available expense categories.

---

## 6. Payment Endpoints

### `GET /trips/:id/payments`
List all payment transfers in the trip.

### `POST /trips/:id/payments`
Record a new payment transfer. Created in `PENDING` status.
- **Body:** `{ payerMemberId, receiverMemberId, amountPaise, paymentMethod, note?, receiptUrl?, idempotencyKey? }`

### `POST /trips/:id/payments/:paymentId/confirm`
Confirm payment receipt (Receiver only). Updates balances and records ledger entries.

### `POST /trips/:id/payments/:paymentId/dispute`
Dispute an unreceived or incorrect payment (Receiver only).
- **Body:** `{ reason: string }`

### `DELETE /trips/:id/payments/:paymentId`
Cancel a pending payment (Payer only).

---

## 7. Settlement & Reports Endpoints

### `GET /trips/:id/settlement`
Get authoritative settlement plan, member net balances, simplified transfers, and settled status.

### `POST /trips/:id/settlement/discounts`
Propose an explicit settlement discount waiver.
- **Body:** `{ toMemberId, originalDebtPaise, paidAmountPaise, waivedPaise, reason, paymentId? }`

### `POST /trips/:id/settlement/discounts/:discountId/respond`
Accept or reject a settlement discount waiver (Creditor only).
- **Body:** `{ action: 'ACCEPT' | 'REJECT' }`

### `GET /trips/:id/reports/export` & `POST /trips/:id/reports/export`
Generate and download individual or complete trip financial reports.
- **Query / Body:** `{ reportType: 'TRIP_LEDGER' | 'INDIVIDUAL', format: 'PDF' | 'XLSX', memberId? }`

---

## 8. Sync & Files & System Endpoints

### `POST /sync`
Incremental sync endpoint returning updated trips, expenses, payments, and notifications.
- **Body:** `{ lastSyncTimestamp?, tripIds? }`

### `POST /files/upload`
Upload receipt image or profile avatar (`multipart/form-data`).

### `GET /files/:fileId`
Retrieve uploaded file with appropriate caching and content headers.

### `GET /health`
System health and MySQL database connectivity check.

### `GET /docs`
OpenAPI 3.0 specification in JSON format.
