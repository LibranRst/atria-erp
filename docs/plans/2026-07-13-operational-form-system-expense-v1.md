# Operational Form System — Expense Vertical Slice V1

## Intent

- Establish a stable mobile-first form foundation before migrating other operational flows.
- Redesign Expense creation around recoverable drafts, compact repeatable items, contextual material fields, explicit review, and an intentional success state.
- Preserve RBAC, project scoping, finance/material transactions, audit behavior, budget synchronization, and immutable submitted records.

## Phase 1 Scope

- Versioned server-backed `form_draft` records plus immediate local recovery for Expense drafts.
- Multiple active Expense drafts per user, optimistic revision checks, discard, expiry, and atomic submission.
- Shared workflow form footer, unsaved-change guard, draft status feedback, option choices, compact line items, review, and success patterns.
- Expense receipt upload/OCR, manual entry, stable line IDs, category-aware fields, budget/stock previews, and Indonesian operational copy.
- Draft summaries in Finance Inbox and project-context entry points.

## Safety Rules

- Saving or autosaving a draft must not create `project_cost`, canonical expenses, approvals, stock movements, cash transactions, or audit logs.
- Final submission must validate the full payload, claim the active draft, create all business records, and consume the draft in one database transaction.
- Material stock handling remains an explicit user choice and defaults to `EXPENSE_ONLY`.
- Submitted, verified, approved, paid, and rejected records are never edited in place; rejected records may be copied into a new draft.

## Acceptance Gate

- Draft survives close, reload, temporary offline state, and another authenticated session.
- Users can identify incomplete items without opening every editor.
- Review clearly states project, total, category impact, stock actions, and approval consequences.
- Double submit cannot create duplicate expenses.
- Typecheck, targeted tests, lint, build, and 320/390/430px browser checks pass before moving to Material operational forms.

## Implementation Record — 2026-07-13

- Phase 1 Expense vertical slice implemented with schema migration `0019_form_draft_expense_flow`.
- Draft API, local/server hybrid recovery, optimistic conflict handling, expiry/discard cleanup, atomic idempotent submit, and audit logging are active.
- Expense UI now uses compact stable-ID rows, contextual item sheets, explicit stock choices, OCR merge/replace protection, impact review, unsaved guard, and persistent success actions.
- Active drafts appear in Finance Inbox and project-context Expense lists.
- Verification passed: TypeScript strict, full ESLint, production build, 117 tests / 410 assertions, and browser checks at 320, 390, and 430 px.
- QA-created expense, canonical expense, audit row, and consumed draft were removed after verification; the affected budget category was resynchronized.
- The connected development database had an empty Drizzle migration journal despite an existing schema baseline, so the standard all-history migrator could not be used safely. Migration `0019` was applied directly from its checked-in migration file for integration verification; deployed environments should run it through their normal migration pipeline.
