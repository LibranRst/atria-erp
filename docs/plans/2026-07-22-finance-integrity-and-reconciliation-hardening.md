# Finance Integrity and Reconciliation Hardening

## Goal

Make internal cash postings explicitly unreconciled until matched to a bank statement, prevent duplicate bank-reference postings, remove floating-point arithmetic from finance write paths, and keep project access scoped only to the roles that have a supported finance workflow today.

## Decisions

- A cash transaction created from an internal action is `unreconciled` by default. Only the future statement-match action may set reconciliation fields.
- A non-empty bank reference is unique per bank account across cash transactions. This is the idempotency boundary for recorded client receipts and vendor disbursements.
- Finance write paths use money strings and the existing bigint-cent conversion helpers; JavaScript `number` is not used for financial comparisons or aggregation.
- Project assignment remains PM-only in this phase. `DESIGNER` does not inherit PM project access; `project_member` is deferred until a concrete supported workflow requires it.
- Cash movement direction uses `INFLOW` and `OUTFLOW`. `DEBIT` and `CREDIT` are reserved for a future double-entry journal because their meaning changes with accounting perspective.
- Canonical CSV statement import is the primary reconciliation input. Manual statement entry remains an explicit fallback for isolated exceptions, not the default daily workflow.
- Imported rows receive exact-match suggestions, but reconciliation remains an explicit human confirmation. A statement import never mutates bank balance by itself.
- A reconciled pair remains visible in an auditable history. History reads the immutable cash transaction, matched statement row, import source, reconciliation timestamp, and reviewer.
- An unmatched cash transaction may be acknowledged as a documented exception without being marked reconciled. Exceptions require a reason, reviewer, timestamp, and audit event; they remain visible and never pretend a bank match exists.
- Project closing is blocked by project cash transactions that are neither reconciled nor documented as an exception.

## Implementation Plan

1. Add schema-level uniqueness for bank-account/reference pairs and update seed data only where necessary.
2. Make `mutateBalance` create unreconciled transactions and expose exact money helpers for finance actions.
3. Add duplicate-reference checks and bigint-cent calculations to client receipt, vendor payment, field payment, and cash-transfer writes.
4. Add a transactional one-to-one statement-match action with account, direction, amount, and audit validation.
5. Remove unsupported Designer project scoping and document the deferred assignment model.
6. Add focused tests for reconciliation defaults, duplicate references, exact partial-payment state, and role scoping; run formatting, TypeScript/lint, and relevant tests.
7. Migrate legacy cash directions to `INFLOW`/`OUTFLOW` across ledger writes, statements, seed data, presentation, and tests.
8. Add canonical CSV parsing and transactional batch import with duplicate fingerprints, import audit evidence, row-level validation, and a clear summary of imported versus skipped duplicates.
9. Rework the reconciliation UI around statement import and suggested matches; keep one-row manual capture as a secondary fallback.
10. Add reconciliation history and pair detail, plus age/status context for open cash transactions.
11. Add transactional exception acknowledgement and clearing actions with required reasons and audit evidence.
12. Include unresolved project cash transactions in project-closing blockers, then align PRD, flow, API, status, and operator documentation.

## Reconciliation UI Contract

- **Role and decision:** Owner and Finance Admin review internal cash postings against bank-statement entries, then explicitly confirm one exact match. The primary risk is marking a wrong transaction as reconciled.
- **Hierarchy:** One calm workload summary exposes pending internal cash and available statement rows. `SegmentedTabs` switches between **Rekening koran** (default) and **Catatan kas**, so only one operational list is visible at a time. Suggested statement rows open the matching review sheet directly.
- **Surfaces and rows:** The active tab owns one grouped surface with dividers. Rows keep one short title, compact account/date and suggestion status, a semantic direction icon, and one non-wrapping amount. CSV import is the primary action; manual capture is a fallback inside that sheet. Matching uses one `WorkflowFormSheet` with the selected cash fact before the compatible statement selector.
- **States:** loading mirrors the header, workload summary, segmented tabs, contextual tab header, and active grouped list. Each tab has a compact semantic empty state; the cash empty state confirms completion while the statement empty state points to the existing capture action. Errors retain entered or selected data, restricted users receive the existing access-denied pattern, and successful writes close the sheet then refresh canonical data.
- **Motion:** no route, section, list, or tab-content animation. Only the established active segmented-tab pill and existing bottom-sheet slide/fade/tap feedback remain, with reduced-motion fallback.
- **Naming:** keep the standard finance term **Rekonsiliasi**, explain it as “mencocokkan catatan Atria dengan mutasi bank”, call internal rows **Catatan Atria**, bank evidence **Mutasi bank**, and completed pairs **Riwayat**.

## Reconciliation Seed Contract

- Seeded reconciled cash transactions each own exactly one matched, reconciled statement row with the same bank account, direction, and amount, plus an audit event.
- The active test queue contains one exact unmatched pair that can be reconciled, one cash transaction with no statement counterpart, and one statement-only bank charge that requires investigation or a later internal posting.
- Statement rows never change seeded bank balances. Seed validation fails when reconciliation flags, evidence fields, match cardinality, account, direction, or amount drift apart.

## Out of Scope

- Direct parsers for every bank format and many-to-many reconciliation matching. This change ships a canonical CSV template and safe one-to-one baseline; split/aggregate statement matching remains a later finance capability.
- A general ledger, accrual accounting layer, or `project_member` data model.
