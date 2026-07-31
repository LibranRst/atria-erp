# Administration Server Actions Structural Refactor

## Goal

Separate bootstrap, administration reads, staff mutations, and vendor mutations while preserving the existing public action entrypoint.

## Structure

- Keep `administration.ts` as the compatibility export surface.
- Move first-owner bootstrap and seed defaults into `administration-bootstrap.ts`.
- Move overview and production-readiness reads into `administration-queries.ts`.
- Move staff creation, updates, and temporary-password changes into `administration-staff.ts`.
- Move vendor save and activation mutations into `administration-vendors.ts`.
- Share actor/value helpers and administration read-model types through focused modules.

## Safety

- Preserve server-side permissions, role boundaries, credential hashing, validation, transactions, audit logs, and revalidation.
- No schema or UI behavior changes.

## Validation

- Prettier and ESLint for all administration action modules.
- Strict TypeScript compilation.
- Administration validation/access tests.
- `git diff --check`.
