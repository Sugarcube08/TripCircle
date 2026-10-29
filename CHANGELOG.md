# Changelog

All notable changes to the TripCircle platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-30

### Initial Production Release

TripCircle v1.0.0 is the foundational release of the collaborative trip expense tracking and group settlement platform.

#### Added
- **Exact Double-Entry Integer Paise Financial Engine:**
  - All monetary values stored and calculated in integer paise ($1\text{ INR} = 100\text{ paise}$).
  - Mathematical zero-sum balance invariant across every trip ($\sum \text{net balances} = 0$).
  - Instant expense posting without bureaucratic approval bottlenecks.
  - Granular split methods: Equal, Percentage, Exact Paise, and Proportional Share splits.
- **Receiver-Confirmed Settlement Workflow:**
  - Payer reports debt settlement via UPI, Cash, or Net Banking.
  - Recipient must explicitly confirm or dispute payment before balances update.
  - Disputed payments preserve dispute reasoning without corrupting group balances.
  - Payer can cancel unconfirmed pending payments with full audit history preserved.
- **Context-Aware Activity & Alerts Deep Linking:**
  - Centralized typed `ActivityRouter` resolving notifications directly to exact records (Expenses, Payments, Invitations, Settlements, and Member profiles).
  - Unread activity badge counter with real-time reactive tab icon pill indicators.
  - Single-tap "Read All" and per-item optimistic read status synchronization.
- **Automatic Startup Version Checking & Release Manifest Generator:**
  - Non-blocking startup bootstrap checking `version.json` against installed build numbers.
  - Automatic differentiation between optional updates (dismissible modal) and mandatory upgrades (blocking screen).
  - CLI script (`scripts/generate-version-manifest.mjs`) extracting authoritative metadata directly from `apps/mobile/app.json`.
- **Sub-Rupee (< ₹1.00) Debt Waiver Automation:**
  - Automatic settlement discount application for residual balances under 100 paise upon confirmation of major transfers.
  - Dual ledger accounting ensuring zero-sum balance reconciliation without awkward physical cash exchange.
- **Multi-Account Storage Isolation:**
  - Per-user persistent cache files preventing cross-account trip leakage during account switching.
  - Automatic memory and file purge on logout or unauthenticated session expiration.
- **Auditable Statements & Native Export:**
  - Professional 8-section PDF Financial Statements with ASCII-safe ISO 4217 INR currency formatting.
  - 5-sheet XLSX Excel workbooks covering summaries, chronological expenses, payments, settlement transfers, and waivers.
  - Native mobile sharing and download integration via `expo-file-system` and `expo-sharing`.
- **Branded Transactional Email System:**
  - Responsive dark-mode email templates matching the Obsidian & Mint theme.
  - Durable MySQL-backed transactional outbox worker for reliable OTP delivery and event notifications.
