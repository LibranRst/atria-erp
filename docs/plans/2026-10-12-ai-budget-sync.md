# AI budget summary inspection and synchronization

Approved scope: inspect one accessible project against canonical stored expenses and completed vendor payments, show exact differences, explicitly synchronize derived category summaries, and verify the persisted result. Settings, category allocations, contract/cap, transaction statuses, cash and inventory are source data, not repair targets.

## Domain and transport

- Reuse canonical usage/status calculations in `lib/budget/budget-sync.ts` for both diagnosis and writes. Share an audited project writer with the existing manual recalculation action.
- Lock project, budget and ordered categories; compute consistent before/after values with exact cents, fingerprint the stored/source snapshot. Never reconstruct missing expenses or adjust allocations to make a discrepancy disappear.
- Read requires session, AI/project/budget view rights and tenant/project scope. Commit additionally requires update:budget. Only a unique owned stored tool identity is accepted; expiry, changed source, revoked access and replay are handled explicitly.
- Commit changes only discrepant derived fields, writes one before/after audit and one idempotent AI receipt in the transaction. Verify the result before commit.

## Presentation contract

Inherited Atria Operate. Compact card shows project, matching/differing category count, and labeled before/after differences. Safe direct synchronization lives in the card with a concise protected confirmation; read-only per-category detail is optional. No mandatory review step for a clean diagnosis.

Reuse ProposalCardShell, ProposalInlineReview/DiffRow, ReviewCollection/Item, GroupedSurface, FactRow, MoneyValue(fullDynamic), FormSheet with desktop aside/mobile stack, FormDisclosure and SheetFooterActions. Maximum five category rows per page. Maintain existing responsive geometry, disclosure motion, visible errors/recovery and stable overlay ownership.

## Verification

- Pure checks for exact amounts/status/percentages and strict identity schema.
- Disposable Postgres tests: read-only diagnosis, no-op, discrepancies/status changes, source invalidation, permission/scope/tenant denial, expiry, ownership, concurrent replay, rollback and financial/stock/Settings invariants.
- Browser preview in existing visible QA tab: diagnose, details, confirmation, save, verified state, clean and stale/error examples; 320/360/390/430 and 1024/1280/1440 layouts.
- Workspace tests/typechecks/lint/build, scoped formatting and HeroUI style check. Fresh Impeccable finish review and durable documentation handoff.

Live provider tool selection is a separate certification; QA browser uses deterministic synthetic tool output backed by the real API and disposable database.

## Completion

Implemented all approved phases. The shared manual recalculation now uses the audited writer; model tools remain read-only. Eleven disposable integration cases and the workspace gates passed. Browser approval verified exactly one audit/receipt with unchanged source hashes. Responsive evidence covers all required widths. Finish review disposition is ship after correcting pending-only confirmation truth. See `docs/guide/ai-budget-sync-verification-2026-10-12.md` for evidence and remaining live-provider certification.
