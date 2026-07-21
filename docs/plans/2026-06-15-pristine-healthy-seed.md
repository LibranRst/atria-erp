# Implementation Plan - Set Seed Data to Pristine Healthy State & Explanatory Guide

Reset the database seed to a completely healthy, easy-to-read baseline state (with zero overruns and zero active alerts). We will also document the exact step-by-step workflow tests the user can execute to understand how cash, receivables, payables, and costs flow through Atria ERP.

## User Review Required

> [!IMPORTANT]
>
> - **Pristine Healthy State**: All initial spent balances are set to exactly Rp 0 or aligned with actual paid transactions to avoid confusing overrun values.
> - **Clear Starting Cash**: Saldo BCA Operasional starts at a clean Rp 240,000,000 (reflecting only the paid DP 30% of Menteng Villa).
> - **Siti & Sudirman Exist**: Both are retained to keep the automated tests passing, but kept clean and healthy.

## Proposed Changes

### Seed Database Changes

#### [MODIFY] [seed.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/db/seed.ts)

- Update `BCA Operasional` balance to exactly `Rp 240,000,000`.
- Update `Kas Kecil PM Budi` balance to exactly `Rp 15,000,000`.
- For `BCA Operasional`, adjust balance updates accordingly.
- Set `actualSpent` in `projectBudgetItem` to align cleanly with actual paid transactions.
- Keep `budgetOverrun: false` for all cost requests.

## Verification Plan

### Seeding Execution

- Execute database reset and seed:
  ```bash
  bun db:seed
  ```
- Confirm the seed runs and finishes with zero SQL constraint violations.
- Run `bun test` to guarantee test suite compliance.
