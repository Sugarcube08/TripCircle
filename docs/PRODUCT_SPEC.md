# tripCircle — Product Specification (V1)

## 1. Product Overview

**tripCircle** is a collaborative trip expense management, transparent financial ledger, and simplified group settlement platform. It provides friends travelling together with a shared financial ledger where every rupee and paisa is tracked without ambiguity or manual reconstruction.

### Five Fundamental Questions Answered
1. **What happened financially during the trip?** Complete, immutable chronological log of every expense, payment, revision, and discount.
2. **Who paid for each expense?** Designated trip member credited for the full amount paid.
3. **Who was responsible for each expense, and how much?** Exact integer paise split allocated across beneficiaries (equal or unequal).
4. **Which payments have actually been confirmed?** Two-step receiver confirmation model: money only affects balances once verified by the receiver.
5. **What payments remain necessary to settle everyone's balances?** Deterministic greedy debt-simplification algorithm generating consolidated payment recommendations.

---

## 2. Core Product Principles

- **One shared record:** All authorized trip members see the identical authoritative financial history.
- **No expense approvals:** Submitted expenses immediately affect the ledger without pending approval states.
- **Receiver-confirmed payments:** Direct transfers between members affect balances only after the recipient confirms receipt. Disputed payments do not modify balances.
- **Exact accounting:** All financial storage and calculations retain integer paise precision (100 paise = ₹1.00). Binary floating-point representation is strictly prohibited.
- **Transparent corrections:** Editing an expense updates the current balance immediately while preserving historical revisions.
- **No silent financial adjustments:** Settlement discounts and rounding adjustments must be explicit, auditable, and accepted by the creditor.
- **Offline access:** Previously synchronized information is locally cached and viewable without connectivity, with clear stale-data indicators.
- **Online transaction submission:** Creating or modifying financial records requires active connectivity to ensure server-authoritative consistency.
- **Independent deployment:** Next.js API server and React Native Expo mobile application are independently deployable.

---

## 3. Functional Modules

### Authentication & Accounts
- Email/password registration and login.
- Cryptographically secure 6-digit OTP verification via SMTP with rate limits and attempt tracking.
- Session management with short-lived JWT access tokens (15m) and secure refresh token rotation (7d).
- Password recovery via expiring OTP codes.
- User profile: Name, email, phone, avatar, completed-trip count, and optional UPI payment QR code.

### Trip Management & Membership
- Trip creation: Name, destination, start/end dates, cover image, currency (`INR`).
- User discovery by registered email or name.
- Invitations with explicit Accept/Decline state machine.
- Creator privileges: close trip, reopen trip, invite members.
- Member permissions: leave trip while preserving existing obligations and payment rights.

### Expense Management
- Payer selection (default: current user).
- Beneficiary selection (default: all active members; payer can be excluded).
- Expense categories: Food & Dining, Transport, Accommodation, Shopping, Activities & Entertainment, Groceries, Fuel, Tickets & Reservations, Miscellaneous.
- Equal split: divides paise equally and deterministically distributes remainder paise.
- Unequal split: exact paise share per beneficiary; enforces $\sum shares = total$.
- Optimistic concurrency control on edits with immutable revision history snapshots.

### Payments & Settlements
- Add payment: payer, receiver, amount in paise, payment method (UPI, Cash, Other), note, optional receipt.
- Receiver confirmation or dispute with required dispute reason.
- Greedy debtor-creditor matching settlement algorithm.
- Person-to-person bilateral obligations breakdown.
- Explicit settlement discounts (waived coin/fractional balances) with creditor acceptance.

### Synchronization & Offline
- Local SQLite/in-memory cache for trips, expenses, payments, settlement plans, notifications.
- Incremental sync endpoint with timestamps and change tracking.
- Offline banner indicator with last-synchronized timestamp.

### Reports & File Storage
- Individual Member Financial Statement (PDF and XLSX).
- Complete Trip Ledger Report (PDF and XLSX).
- Local disk & S3-compatible object storage with MIME and 10MB size validation.
