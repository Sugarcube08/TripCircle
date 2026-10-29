# TripCircle

**Effortless group travel expenses, transparent financial records, and mathematically verified settlements.**

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Release: v1.0.0](https://img.shields.io/badge/Release-v1.0.0-blue.svg)](https://github.com/Sugarcube08/TripCircle/releases)
[![Platform: Android](https://img.shields.io/badge/Platform-Android-green.svg)](https://github.com/Sugarcube08/TripCircle/releases/latest)

---

## What is TripCircle?

**TripCircle** is a mobile-first collaborative expense management and debt settlement application designed specifically for group trips, vacations, weekend getaways, and shared adventures.

Instead of messy spreadsheets, lost receipts, or complicated mental math, TripCircle gives everyone on the trip a single, shared, real-time financial ledger. Anyone can record expenses on the fly, companion shares are split instantly, debts are mathematically simplified into the fewest possible transfers, and payments are verified directly between the payer and receiver.

---

## Why TripCircle? (The Problem It Solves)

Traveling with friends and family is amazing—until the trip ends and everyone tries to figure out who owes whom:

- **The Split Confusion:** One person booked the villa, someone else paid for fuel, two people bought groceries, and three people went on an excursion. Trying to calculate individual net balances in a notebook or WhatsApp group chat quickly descends into chaos.
- **The "I Already Paid" Dispute:** In traditional apps, anyone can click "Mark as Paid" even if they never sent the money. One person thinks the debt is cleared, while the other never received the funds.
- **Floating-Point Rounding Defects:** Dividing ₹1,000 evenly across 3 friends results in ₹333.3333... Standard apps accumulate rounding errors that leave balances unbalanced by cents or paise.
- **Awkward Micro-Balances:** When final settlements are calculated, someone inevitably owes someone else ₹0.32 or ₹0.50—amounts that cannot be transferred via UPI or physical cash.
- **Spotty Travel Network:** Remote hill stations, beaches, and hiking trails rarely have reliable 5G connectivity. Travelers need to check their balances and view trip details even when completely offline.

---

## Why TripCircle is Necessary: Core Financial Invariants

TripCircle was engineered from the ground up to guarantee absolute financial correctness and dispute-free settlements:

1. **Exact Integer Paise Precision ($1\text{ INR} = 100\text{ paise}$):**
   Every amount, allocation, share, and payment is stored and calculated as an exact integer number of paise. Floating-point math is strictly forbidden. There are zero rounding discrepancies.
2. **Zero-Sum Ledger Invariant:**
   At all times, the exact mathematical sum of all member net balances across every trip strictly equals zero ($\sum \text{balances} = 0$). Money is never created or lost.
3. **Receiver-Confirmed Settlement Payments:**
   When a member pays off a debt, they record the transfer (via UPI, Cash, or Net Banking). However, group balances update **only after the receiving member explicitly confirms receipt**. If funds were not received, the receiver can dispute the payment with an explanation, keeping balances clean and truthful.
4. **Deterministic Greedy Debt Simplification:**
   Instead of everyone paying everyone else in dozens of confusing bilateral transactions, TripCircle's settlement engine computes the globally optimal, minimum-transfer settlement plan. A 6-person trip with 30 expenses can be completely settled in just 3 or 4 simple transfers.
5. **Automatic Sub-Rupee Debt Waivers ($< \text{₹}1.00$):**
   Once major transfers are settled, any leftover residual fractional amounts below ₹1.00 (e.g. ₹0.32) are automatically waived as accepted settlement discounts. No more awkward discussions over tiny coin balances.
6. **Immutable Audit Trail:**
   Financial history is never erased. Cancelled payments, disputes, expense revisions, and settlement waivers are permanently recorded for complete transparency.

---

## How to Use TripCircle

You don't need to configure databases or host your own servers to use TripCircle. The public production application connects automatically to the official high-availability cloud infrastructure.

### 1. Download the App
Download the latest Android release APK directly to your device:

👉 **[Download TripCircle Latest Release APK](https://github.com/Sugarcube08/TripCircle/releases/latest)**

*Open the downloaded `.apk` file on your Android phone and follow the on-screen prompt to install.*

### 2. Create Your Account
- Launch TripCircle and sign up with your email address.
- Verify your account using the 6-digit verification code sent to your inbox.
- During registration, upload your UPI QR code or set your payment details so friends can pay you back instantly in one tap.

### 3. Create or Join a Trip
- **Create a Trip:** Tap **+ New Trip**, enter the trip name (e.g. *Goa Beach Retreat 2026*), destination, and dates.
- **Invite Friends:** Invite registered friends via email, or add offline travelers (*dummy members*) who don't have the app yet so their share can still be tracked.
- **Accept Invitations:** Received an invitation? Open the **Activity & Alerts** tab or tap **Invitations** on your Home screen to accept.

### 4. Record Shared Expenses
- Tap **Add Expense** whenever you pay for something.
- Enter the amount, description, and category (Stay, Food, Travel, Activities, etc.).
- Choose how to split:
  - **Equal Split:** Automatically divided evenly among all or selected members.
  - **Exact Amounts:** Specify exact paise for each person.
  - **Percentages:** Allocate custom percentages.
- Attach a photo of the receipt for your records. The expense immediately posts to the group ledger!

### 5. Review Balances & Settle Up
- The **Trip Dashboard** shows your exact net position: whether you are owed money (in green) or owe money (in red).
- Switch to the **Settlement Dashboard** to see the recommended transfers.
- When you pay a friend, tap **Record Payment**, choose the method (UPI or Cash), and submit.
- The recipient receives an instant in-app alert to **Confirm Received** or **Dispute**.
- Once confirmed, balances update immediately and residual sub-rupee amounts are automatically reconciled.

### 6. Export Auditable Financial Statements
- Tap **Export Reports** in your trip settings.
- Generate an official **PDF Financial Statement** complete with chronological ledgers, member balance tables, and payment statuses.
- Export a full **Excel (.xlsx)** workbook containing 5 dedicated sheets for comprehensive record-keeping.

---

## Activity & Alerts: Context-Aware Deep Linking

TripCircle features an **Activity & Alerts** notification center with real-time unread badges:
- **Tapping an expense notification** jumps directly into that exact expense's detail card.
- **Tapping a payment request** navigates directly to the payment record with permitted Confirm and Dispute actions.
- **Tapping a trip invite** opens the invitation response screen.
- Notifications are automatically marked as read upon inspection, and an unread badge indicator on the bottom tab keeps you informed of pending actions.

---

## Automatic Startup Version Verification

The mobile app includes an integrated, non-blocking startup version checker:
- On every app launch, TripCircle verifies its build version against the authoritative release manifest.
- **Optional Updates:** Displays what's new with release notes and a one-tap upgrade button, while letting you continue using the app.
- **Mandatory Updates:** If a critical financial calculation or security update is released, the app clearly notifies you to update before proceeding.
- Includes offline fallback: remote version checks never prevent normal offline access.

---

## Self-Hosting (Advanced Developers)

For developers and private organizations who wish to deploy their own isolated backend infrastructure, TripCircle supports full containerized self-hosting.

See the dedicated guide: **[`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md)** for details on running the Next.js API, MySQL database, Cloudflare R2 object storage, and background worker.

---

## Releases & Changelog

See **[`CHANGELOG.md`](CHANGELOG.md)** for the complete history of features, improvements, and releases.

- **Current Release:** `v1.0.0`
- **Release Manifest:** `version.json`

---

## License

TripCircle is open-source software licensed under the **[MIT License](LICENSE)**.
