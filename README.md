# TripCircle

**Effortless group travel expenses, transparent financial records, and mathematically verified settlements.**

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Release: v1.0.0](https://img.shields.io/badge/Release-v1.0.0-blue.svg)](https://github.com/Sugarcube08/TripCircle/releases)
[![Platform: Android](https://img.shields.io/badge/Platform-Android-green.svg)](https://github.com/Sugarcube08/TripCircle/releases/latest)
[![Visual Guide](https://img.shields.io/badge/Documentation-Visual_Tour-10B981.svg)](docs/VISUAL_GUIDE.md)

---

## Visual Showcase

<table>
  <tr>
    <th width="33%" align="center">Trips Directory</th>
    <th width="33%" align="center">Trip Financial Dashboard</th>
    <th width="33%" align="center">Complete Financial Ledger</th>
  </tr>
  <tr>
    <td align="center">
      <img src="screenshots/Home.jpg" width="280" alt="Trips Directory" /><br />
      <em>Central hub showing active trips and your overall net creditor/debtor balance.</em>
    </td>
    <td align="center">
      <img src="screenshots/Trip_View.jpg" width="280" alt="Trip Financial Dashboard" /><br />
      <em>Instant trip balance, creditor status, quick actions, and member roster.</em>
    </td>
    <td align="center">
      <img src="screenshots/Trip_Ledger.jpg" width="280" alt="Complete Financial Ledger" /><br />
      <em>Chronological timeline of all 16 expenses and verified UPI settlements.</em>
    </td>
  </tr>
</table>

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

## Core Financial Invariants

TripCircle was engineered from the ground up to guarantee absolute financial correctness and dispute-free settlements:

1. **Exact Integer Paise Precision ($1\text{ INR} = 100\text{ paise}$):**
   Every amount, allocation, share, and payment is stored and calculated as an exact integer number of paise. Floating-point math is strictly forbidden. There are zero rounding discrepancies.
2. **Zero-Sum Ledger Invariant:**
   At all times, the exact mathematical sum of all member net balances across every trip strictly equals zero ($\sum \text{balances} \equiv 0$). Money is never created or lost.
3. **Receiver-Confirmed Settlement Payments:**
   When a member pays off a debt, they record the transfer (via UPI, Cash, or Net Banking). However, group balances update **only after the receiving member explicitly confirms receipt**. If funds were not received, the receiver can dispute the payment with an explanation, keeping balances clean and truthful.
4. **Deterministic Greedy Debt Simplification:**
   Instead of everyone paying everyone else in dozens of confusing bilateral transactions, TripCircle's settlement engine computes the globally optimal, minimum-transfer settlement plan. A 6-person trip with 30 expenses can be completely settled in just 3 or 4 simple transfers.
5. **Automatic Sub-Rupee Debt Waivers ($< \text{₹}1.00$):**
   Once major transfers are settled, any leftover residual fractional amounts below ₹1.00 (e.g. ₹0.32) are automatically waived as accepted settlement discounts. No more awkward discussions over tiny coin balances.
6. **Immutable Audit Trail:**
   Financial history is never erased. Cancelled payments, disputes, expense revisions, and settlement waivers are permanently recorded for complete transparency.

---

## Detailed Application Walkthrough

*(For full anatomical breakdown of all screens, visit the [Visual Guide](docs/VISUAL_GUIDE.md).)*

### 1. Trips Directory & Group Dashboard

<table>
  <tr>
    <th width="50%" align="center">Trips Directory (Home)</th>
    <th width="50%" align="center">Trip Financial Overview</th>
  </tr>
  <tr>
    <td align="center">
      <img src="screenshots/Home.jpg" width="300" alt="Trips Directory" />
    </td>
    <td align="center">
      <img src="screenshots/Trip_View.jpg" width="300" alt="Trip Overview" />
    </td>
  </tr>
</table>

- **Trips Directory (`Home.jpg`)**:
  - Filter between `All (1)`, `Active (1)`, and `Closed (0)` trips.
  - Review key trip metrics at a glance: *Devcon Trip* in *Mumbai* with *3 members* and *10 recorded expenses*.
  - Immediate balance badge: *"YOU ARE OWED ₹150.00"*, so you always know your standing before tapping into a trip.
  - Quick `+ Create Trip` action in the header to spin up a new group in seconds.
- **Trip Dashboard (`Trip_View.jpg`)**:
  - Highlights your exact group standing with directional status badges (`↓ Net Creditor: ₹150.00` in emerald green).
  - Clear three-metric breakdown: **YOU ARE OWED ₹150.00**, **YOU OWE ₹0.00**, and **TOTAL SPENT ₹0.00**.
  - One-tap quick actions: `+ Add Expense` and `Record Payment`.
  - Direct access to the simplified **Settlement Plan** and official **Export Report** generators.
  - Interactive member carousel with direct **Manage** controls.

---

### 2. Frictionless Expense Logging & Exact Splitting

<table>
  <tr>
    <th width="50%" align="center">Add Expense: Amount & Category</th>
    <th width="50%" align="center">Add Expense: Split Allocation</th>
  </tr>
  <tr>
    <td align="center">
      <img src="screenshots/Expense_Form_1.jpg" width="300" alt="Expense Amount & Category" />
    </td>
    <td align="center">
      <img src="screenshots/Expense_Form_2.jpg" width="300" alt="Expense Split Allocation" />
    </td>
  </tr>
</table>

- **Fast Data Entry (`Expense_Form_1.jpg`)**:
  - Quick-increment chips (`+100`, `+250`, `+500`, `+1000`) for rapid cash and dining additions.
  - Category selector with visual icons: *Accommodation*, *Activities & Entertainment*, *Food & Dining*, *Fuel*, *Transport*, and *Groceries*.
  - Optional description field (*"e.g. Seafood Dinner, Taxi to airport, Groceries"*).
  - Tap-to-select payer with checkmark confirmation (*Harsh Raikwar, Alice Sharma, Bob Verma*).
- **Paise-Perfect Splitting (`Expense_Form_2.jpg`)**:
  - Toggle between `Equal Split` and `Unequal Split`.
  - Remainder paise are deterministically distributed across members so the sum of shares strictly matches the total amount.
  - Real-time share calculations per traveler.
  - Optional metadata: location tag (*"e.g. Candolim Beach"*), notes, and receipt photo attachment uploaded securely to Cloudflare R2 / S3 storage.

---

### 3. Verified Payments & Recipient Confirmation

<table>
  <tr>
    <th width="50%" align="center">Record Settlement Payment</th>
    <th width="50%" align="center">Confirmed Payment Audit Trail</th>
  </tr>
  <tr>
    <td align="center">
      <img src="screenshots/Payment_Reporting_Form.jpg" width="300" alt="Record Payment" />
    </td>
    <td align="center">
      <img src="screenshots/Payment_Detail.jpg" width="300" alt="Payment Details" />
    </td>
  </tr>
</table>

- **Payment Reporting (`Payment_Reporting_Form.jpg`)**:
  - Payer selects the recipient from trip members, displaying their registered phone number (*Alice Sharma: +919876543210*).
  - Select payment rail: `UPI` (instant app transfers), `CASH` (in-person physical handover), or `OTHER` (wire / net banking).
  - Include reference codes or notes (*"e.g. UPI Ref #123456, GPay, Cash handed over at dinner"*).
  - Quick amount increment buttons (`+500`, `+1000`, `+2000`, `+5000`).
- **Two-Step Verification & Audit Trail (`Payment_Detail.jpg`)**:
  - Balances do not update until the receiving member inspects and confirms the transfer.
  - Visual directional flow card: *Harsh Raikwar $\to$ Alice Sharma (`₹150.00`)*.
  - Dual status badges: `Confirmed` and `UPI`.
  - Timestamped audit log:
    - **Recorded At:** *30 Oct, 1:23 am*
    - **Confirmed At:** *30 Oct, 1:24 am*

---

### 4. Bilateral Member Balances & Personal Profile

<table>
  <tr>
    <th width="50%" align="center">Member Balance & Direct Settlement</th>
    <th width="50%" align="center">User Profile & Account Hub</th>
  </tr>
  <tr>
    <td align="center">
      <img src="screenshots/Individual_Trip_Balance_Profile.jpg" width="300" alt="Member Balance Profile" />
    </td>
    <td align="center">
      <img src="screenshots/Profile.jpg" width="300" alt="User Profile" />
    </td>
  </tr>
</table>

- **Individual Member Detail (`Individual_Trip_Balance_Profile.jpg`)**:
  - Tapping any member (such as *Alice Sharma*) displays their overall trip net balance (`-₹195.34`, *"Owes money to the group"*).
  - **Direct Settlement Card**: Isolates the exact bilateral relationship between you and that person (*"Alice Sharma owes you ₹150.00"*).
  - Comprehensive financial stats breakdown:
    - **Total Expenses Paid:** `₹1,220.00`
    - **Total Expense Share:** `₹1,289.66`
    - **Confirmed Payments Made:** `₹224.00`
- **User Profile Hub (`Profile.jpg`)**:
  - User avatar with camera upload badge, display name (*Harsh Raikwar*), and registered email.
  - High-level metrics across all trips: `1 Active Trip`, `0 Completed Trips`, and `₹203.32 Net Unsettled`.
  - **Edit Profile & Payment QR**: Configure your personal UPI VPA and upload a QR code so friends can pay you back instantly.
  - **Check for Updates**: In-app version check verifying client release manifests.

---

## How to Get Started

You do not need to configure databases or host your own servers to use TripCircle. The public mobile application connects automatically to the official high-availability cloud infrastructure.

### 1. Download the Android App
Download the latest Android release APK directly to your phone:

👉 **[Download TripCircle Latest Release APK](https://github.com/Sugarcube08/TripCircle/releases/latest)**

*Open the downloaded `.apk` file on your Android device and follow the on-screen prompt to install.*

### 2. Sign Up & Configure Your Payment QR
- Launch TripCircle and register with your email address.
- Verify your account using the 6-digit verification code sent to your inbox.
- Set up your UPI ID or upload a UPI QR code in your profile so friends can pay you back in one tap.

### 3. Create or Join a Trip
- Tap **+ Create Trip**, enter destination and dates, and invite friends via email.
- You can also add offline companions (*dummy members*) who don't have the app yet, so their financial shares are still tracked. When they sign up later, you can link their real account in one tap.

### 4. Log Expenses & Settle Up
- Log shared expenses as they happen.
- When the trip concludes, visit the **Settlement Plan** to see the minimum transfers needed.
- Send payment via UPI or Cash, and log the payment. Once the receiver confirms, balances are settled and leftover sub-rupee fractions are automatically waived!

### 5. Export Auditable Financial Statements
- Tap **Export Report** on your Trip Dashboard.
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
- On every app launch, TripCircle verifies its build version against the authoritative release manifest (`version.json`).
- **Optional Updates:** Displays what's new with release notes and a one-tap upgrade button, while letting you continue using the app.
- **Mandatory Updates:** If a critical financial calculation or security update is released, the app clearly notifies you to update before proceeding.
- Includes offline fallback: remote version checks never prevent normal offline access.

---

## Documentation & Developer Resources

- **[Application Visual Guide](docs/VISUAL_GUIDE.md)**: Deep-dive anatomical breakdown of all screens, UI components, and interaction patterns.
- **[Self-Hosting Guide](docs/SELF_HOSTING.md)**: Containerized deployment of the Next.js API, MySQL, and Cloudflare R2 storage.
- **[Product Specification](docs/PRODUCT_SPEC.md)**: Product principles, functional modules, and business rules.
- **[Financial Model](docs/FINANCIAL_MODEL.md)**: Mathematical proofs, integer paise accounting, and greedy debt simplification algorithms.
- **[Changelog](CHANGELOG.md)**: Release history and version updates.

---

## License

TripCircle is open-source software licensed under the **[MIT License](LICENSE)**.
