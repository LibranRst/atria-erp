# Vendor Bill List Structural Refactor

## Goal

Separate vendor-payment mutation state from list filtering and presentation while preserving finance permissions and recovery behavior.

## Structure

- Keep `vendor-bill-list.tsx` as the composition boundary.
- Move schedule/disbursement recovery and server-action orchestration into `use-vendor-payment-operations.ts`.
- Move summary, filters, pagination, and bill/payment rows into `vendor-bill-list-content.tsx`.
- Keep the existing list types and payment sheets as shared contracts.

## UI Contract

- Preserve the vendor summary, stable-scroll segmented filters, grouped rows, and sheet workflows.
- Preserve Owner/Finance/PM/Purchasing permissions and URL-based bill creation.
- Motion: no new animation; retain the existing sheet behavior.

## Validation

- Prettier and ESLint for affected expense modules.
- Strict TypeScript compilation.
- Relevant expense presentation and finance action tests.
- `git diff --check`.
