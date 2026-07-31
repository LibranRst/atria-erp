# Onboarding Actions Structural Refactor

## Goal

Split the onboarding server-action bulk by query and mutation responsibility while retaining the existing public import path and audit behavior.

## Structure

- Keep `onboarding.ts` as a compatibility export hub.
- Move readiness aggregation into `onboarding-overview.ts`.
- Move onboarding bank-account reads into `onboarding-bank-accounts.ts`.
- Move advance, pause, and complete mutations into `onboarding-progress.ts`.
- Move owner/session and persisted-state helpers into `onboarding-action-utils.ts`.
- Move shared action data contracts into `onboarding-types.ts`.

## Safety Contract

- Preserve server-side session and Owner permission checks.
- Preserve transactional state writes and `audit_log` rows.
- Preserve revalidation paths and all existing response messages.
- Keep Drizzle query APIs; introduce no raw SQL.

## Validation

- Prettier and ESLint for affected action modules.
- Strict TypeScript compilation.
- Onboarding state, readiness, and workspace tests.
- `git diff --check`.
