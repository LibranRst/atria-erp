# Expense Form Structural Refactor

## Goal

Reduce mixed presentation responsibilities in the expense form while preserving draft recovery, OCR, project budget, stock handling, review, and submission behavior.

## Structure

- Keep `expense-form.tsx` responsible for hybrid-draft state, OCR orchestration, validation, project changes, and submission.
- Move saved-draft list presentation into `expense-active-drafts.tsx`.
- Move review facts and category budget impact presentation into `expense-form-review.tsx`.
- Move project, receipt, and line-entry presentation into `expense-form-entry-fields.tsx`.
- Move conflict, OCR merge, project-change, discard, unsaved-change, and success overlays into `expense-form-overlays.tsx`.
- Move line collection mutations into `use-expense-line-mutations.ts` and browser-only project helpers into a pure utility module.
- Continue using the existing item and receipt components.

## UI Contract

- Preserve grouped form sections, draft continuation, project context, receipt upload, item editing, budget review, conflicts, unsaved changes, and success states.
- Motion: retain existing sheet/modal and tap feedback only; no new page or section animation.

## Validation

- Prettier and ESLint on affected expense form modules.
- Strict TypeScript compilation.
- Relevant expense primitive tests.
- `git diff --check`.
