# Activity Detail Server Action Structural Refactor

## Goal

Turn the activity-detail server action into a small authenticated dispatcher while grouping canonical record resolvers by domain.

## Structure

- Keep `activity-detail.ts` responsible for input validation, session/RBAC checks, dispatch, and action responses.
- Move inventory, goods receipt, transfer, stock count, and opening resolvers into `activity-detail-inventory-resolvers.ts`.
- Move project cost, vendor, cash, invoice, and payment resolvers into `activity-detail-finance-resolvers.ts`.
- Move RAB revision, change order, and approval-decision resolvers into `activity-detail-project-resolvers.ts`.
- Move shared audit, project-scoping, status, fact, and total helpers into `activity-detail-resolver-utils.ts`.

## Safety

- Preserve canonical database reads, permission mapping, project scoping, client-safe RAB output, and existing response copy.
- No mutation, schema, or UI behavior changes.

## Validation

- Prettier and ESLint for all action modules.
- Strict TypeScript compilation.
- Activity-detail provider tests.
- `git diff --check`.
