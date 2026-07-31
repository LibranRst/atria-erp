# Warehouse Server Actions Structural Refactor

## Goal

Separate warehouse mutations by operational aggregate while preserving transaction, stock movement, audit log, permission, and validation behavior.

## Structure

- Keep inventory-location creation in `warehouse.ts`.
- Move stock transfers into `warehouse-transfer.ts`.
- Move stock-count draft, submit, approve, and reject actions into `warehouse-stock-count.ts`.
- Move goods-receipt reversal request and decisions into `warehouse-receipt-reversal.ts`.
- Move emergency adjustment into `warehouse-adjustment.ts`.
- Share authenticated actor lookup, failure mapping, and revalidation through `warehouse-action-utils.ts`.
- Update material-control consumers to import each action from its authoritative module.

## Safety

- Preserve Zod validation, server-side permission checks, Drizzle transactions, stock movements, and audit logs.
- No raw SQL, schema, or user-facing behavior changes.

## Validation

- Prettier and ESLint for all warehouse action modules.
- Strict TypeScript compilation.
- Warehouse validation and stock valuation tests.
- `git diff --check`.
