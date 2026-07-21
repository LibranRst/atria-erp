# Implementation Plan - Remake Seed Data for Interactive Testing

Re-create the database seed data (`db/seed.ts`) to establish a clear, structured, and easy-to-understand sandbox dataset. This will allow the user to test the entire operational lifecycle (PM expense submission, Owner large-claim approval, Finance client payment recording, and ledger disbursement reconciliation).

## User Review Required

> [!IMPORTANT]
>
> - **Unified Active Project**: Focus on a single active project `Menteng Villa - Kitchen & Living Room Fit-Out` to make tracing numbers straightforward.
> - **Actionable State**:
>   - **DP 30% (Rp 240M)**: Paid and reconciled.
>   - **Progress 2 (Termin 50% - Rp 320M)**: Seeded as `UNPAID` (to test Client Payment recording).
>   - **PM Claim 1 (Rp 1.0M - Melamik)**: Seeded as `APPROVED` but unpaid (to test Finance cash disbursement).
>   - **PM Claim 2 (Rp 6.0M - Accessories)**: Seeded as `SUBMITTED` (to test Owner high-value approval threshold).
>   - **Vendor Bill (Rp 20M)**: Seeded as `APPROVED` but unpaid (to test Vendor Payment reconciliation).

## Proposed Changes

### Seed Database Changes

#### [MODIFY] [seed.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/db/seed.ts)

- Replace all seeds with clean, grouped dataset representing "PT Dekoria Desain Estetika".
- Keep static user logins:
  - `ronald@dekoria.com` (Owner)
  - `lisa@dekoria.com` (Finance Admin)
  - `budi@dekoria.com` (Project Manager)
- Clear unnecessary secondary test data to keep the interface clutter-free.

## Verification Plan

### Seeding Execution

- Execute database reset and seed:
  ```bash
  bun db:seed
  ```
- Confirm the seed runs and finishes with zero SQL constraint violations.
