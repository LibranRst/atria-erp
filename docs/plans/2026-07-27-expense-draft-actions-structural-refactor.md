# Expense Draft Actions Structural Refactor

## Goal

Separate draft storage lifecycle from transactional expense submission while preserving the existing action import path.

## Structure

- Keep `expense-drafts.ts` as a compatibility export hub.
- Move list, read, save, and discard operations into `expense-draft-storage.ts`.
- Move transactional/idempotent submission into `expense-draft-submit.ts`.
- Move shared constants, attachment cleanup, and result helpers into `expense-draft-action-utils.ts`.
- Move response contracts into `expense-draft-types.ts`.

## Safety Contract

- Preserve server-side authorization and project scoping.
- Preserve optimistic revision conflict handling.
- Preserve transactional project-cost creation, audit rows, and idempotent submission.
- Preserve attachment cleanup and route revalidation.

## Validation

- Prettier and ESLint for affected action modules.
- Strict TypeScript compilation.
- Expense draft and field-request finance tests.
- `git diff --check`.
