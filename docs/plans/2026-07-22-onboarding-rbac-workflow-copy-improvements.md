# Onboarding, RBAC, Workflow, and Copy Improvements

Status: implemented and verified on 2026-07-22.

## Summary

- Replace technical onboarding verification language with clear step status and optional business detail.
- Return simulated opening-stock approval to the Owner summary while keeping standalone Finance review restricted.
- Make administration and Expenses payloads role-aware so Finance manages vendors only and Purchasing receives no bank-account data.
- Keep draft-project operational and finance domains visibly unavailable with explanatory feedback.
- Polish the budget-category sheet, activity copy, and the financial workflow guide without changing finance calculations or database schema.

## Implementation

- Add role capabilities to the administration read model and redact unavailable collections before serialization.
- Add unavailable segmented-tab behavior that remains focusable/clickable for explanation but never changes selection.
- Rework onboarding status, posted-opening state, approval navigation, and tests.
- Audit runtime presentation copy, prioritizing onboarding and activity details; keep legitimate ERP/finance vocabulary.
- Update the UAT guide with plain role-boundary definitions and real operational context for reserve/use/return/waste.

## Verification

- Run focused Bun tests, TypeScript, ESLint, and the production build.
- Verify Owner, Finance Admin, and Purchasing states plus draft/approved projects.
- Visually check 320, 360, 390, and 430 px, keyboard/focus, reduced motion, safe areas, and stable tab position.

Completed checks: 49 focused tests, `bunx tsc --noEmit`, affected-file ESLint, and `bun run build`. Browser smoke tests covered Owner onboarding, inline Finance review, locked draft-project tabs by pointer and keyboard, and the budget-category sheet without overflow or console errors.

## Motion

No page or tab-content animation. Keep only the existing disclosure transition, active tab pill, and BottomSheet slide/fade with reduced-motion fallbacks.
