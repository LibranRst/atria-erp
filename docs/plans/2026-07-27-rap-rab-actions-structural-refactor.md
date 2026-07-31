# RAP/RAB Actions Structural Refactor

## Goal

Separate internal RAP lifecycle actions from client-facing RAB item, generation, bundle, and approval actions.

## Structure

- Keep `rap-rab.ts` as a compatibility export hub.
- Move RAP draft/item/finalization actions into `project-rap-actions.ts`.
- Move RAB item updates into `rab-item-actions.ts`.
- Re-export existing generation, bundle, and approval modules directly from the compatibility hub.

## Safety Contract

- Preserve project scoping and server-side permissions.
- Preserve RAP readiness checks and transactional audit logs.
- Preserve client-safe RAB generation and DRAFT-only editing rules.

## Validation

- Prettier and ESLint for affected project action modules.
- Strict TypeScript compilation.
- RAP/RAB and revision workflow tests.
- `git diff --check`.
