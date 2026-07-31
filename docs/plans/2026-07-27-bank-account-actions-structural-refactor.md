# Bank Account Actions Structural Refactor

## Goal

Separate account lifecycle mutations from cash movement mutations while preserving the existing public action import path.

## Structure

- Keep `bank-accounts.ts` as a compatibility export hub.
- Move authentication, error mapping, payload conversion, money formatting, and revalidation into `bank-account-action-utils.ts`.
- Move create/update/archive actions into `bank-account-management.ts`.
- Move manual cash movement and account transfer into `bank-account-movements.ts`.

## Safety Contract

- Preserve server-side permission checks.
- Preserve transactional balance changes and audit rows.
- Preserve insufficient-funds and account-status error mapping.
- Preserve explicit money movement and route revalidation.

## Validation

- Prettier and ESLint for affected finance action modules.
- Strict TypeScript compilation.
- Bank-account and finance action tests.
- `git diff --check`.
