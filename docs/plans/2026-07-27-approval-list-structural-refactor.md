# Approval List Structural Refactor

## Goal

Separate approval queue orchestration from reusable queue-row and detail-sheet presentation while preserving all approval, emergency override, inventory-opening, and budget-risk behavior.

## Structure

- Keep `approval-list.tsx` responsible for filters, pagination, decision state, and server-action orchestration.
- Move queue rows, detail sheet/content, budget impact review, and decision footer into `approval-list-presentation.tsx`.
- Preserve the public `ApprovalDetailContent` and `ApprovalItem` exports through the original module for existing consumers and tests.

## UI Contract

- Preserve summary, search/filter, grouped queue, empty states, detail hierarchy, budget impact, receipt preview, and approve/reject sheets.
- Preserve all pending, validation, emergency override, rejection-reason, and success/error behavior.
- Motion: retain existing sticky-control, sheet, and tap-feedback motion; no new list or page animation.

## Validation

- Prettier and ESLint for both modules.
- Strict TypeScript compilation.
- Approval list tests.
- `git diff --check`.
