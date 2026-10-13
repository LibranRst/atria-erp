# AI penerimaan dan stok gudang

Complete the remaining warehouse-intake actions inside the existing procurement/warehouse AI family. Preserve Atria's approved card, grouped review, five-row pagination, two-pane desktop sheet, mobile summary order, shared confirmation and explicit human commit.

## Scope and authority

- Multi-material project goods receipt with explicit project, location, receipt reference, date, supplied unit costs and optional verified bill/RAP links. Reuse and harden the existing transactional receipt writer; do not fabricate project or material IDs or choose a default warehouse silently.
- Company warehouse stock-in without a project, with an explicit audit source/reference, quantities and costs. Extract a shared stock-in writer for the existing manual action and AI; warehouse domain permissions remain independent of role names; project links retain ASSIGNED restrictions and company-only inventory follows the existing explicit warehouse-domain grants. Retain company source references in an additive warehouse_intake header linked from existing stock movements.
- Inventory-opening request, independent approval, reasoned rejection and guarded reversal. Extract shared transactional opening writers from the manual actions. Keep zero-stock/no-history eligibility, pending-opening conflicts, maker/checker, later-movement reversal barriers, notifications and readiness milestones. No AI emergency override.
- Ordinary stock correction keeps the already implemented stock-count approval flow; this work does not introduce a direct emergency adjustment tool.

## Contracts and transport

Extend the typed `PROCUREMENT_WAREHOUSE` contracts with receipt, stock-in and opening actions. Require finite bounded two-decimal quantities/costs, real dates, unique rows, human references/reasons and a bounded batch. Prepare immutable server-owned source snapshots through dedicated intake lookups/proposal tools. Reuse the existing owned proof reader and identity-only atomic confirmation/receipt. Current database Actor permissions, tenant/project access, live references and source fingerprints are rechecked before execution. Model preparation never changes business stock, cash or budget.

Receiving an active material at an active location without an inventory row previews zero stock and explicitly discloses inventory creation. Create that empty row only inside the confirmed transaction; a concurrent creation makes the old proof stale. Missing Material Master or warehouse references still block the action.

Keep runtime implementation in `apps/api`; reuse existing typed web facades and register tools in the action catalog, proposal persistence/reader and coverage inventory. Preserve existing manual public signatures and old proposal compatibility; old client-payload receipt previews must regenerate an owned proof before saving.

## Presentation

Reuse `ProcurementWarehouseProposalCard`, `ProposalCardShell`, `ReviewCollection`/`ReviewItem`, divided `FactRow`, readable before/after comparisons and `MoneyValue fullDynamic`. Small decisions stay inline; larger row sets retain one content-sized wide `FormSheet` with summary and protected actions in the right desktop aside. Show material, location, quantity, unit cost, subtotal, stock effect and supplied audit reference. Opening requests say that stock changes only after another user's approval. Physical stock changes require the shared short confirmation. Footer primary commits remain ink and correction actions white on gray review canvases. Preserve disclosure, page and overlay state through resize and reopening.

## Verification and completion

Core tests cover actions, precision, dates, duplicates, bounds and review policy. Disposable Postgres via `ATRIA_TEST_DATABASE_URL` covers current permissions/custom roles, tenant/project access, missing/inactive references, zero-stock eligibility, maker/checker, duplicate receipts, stale source, concurrent/manual races, rollback, repeat confirmation, weighted costs, stock/audit rows and unchanged cash/project actuals. Exercise legacy/manual compatibility and opening readiness/notifications.

Preview real owned proposals in the visible @Browser dev app using disposable synthetic data; inspect desktop1024/1280/1440 and mobile320/360/390/430, confirmation and blocked states. Keep a visible preview tab for the user. Run workspace tests/typechecks/build/lint/style gates and scoped formatting, document unrelated baseline failures without mass rewrites, update AI coverage/architecture, complete the Impeccable finish-review/documentation handoffs and refresh graft.

## Completion evidence — 12 October 2026

All six actions are implemented in the existing family, including explicit receiving inventory initialization and multiple RAP lines for one material. Migration 0048 was applied additively to the configured development database and named disposable databases. Development business rows were not changed during verification.

Workspace tests passed (2,102), as did workspace build and lint (one existing unrelated hook warning). Twelve new intake integration cases, seven legacy receipt-reversal cases and twelve existing procurement cases passed against disposable PostgreSQL. Browser verification used real owned proofs and the real API at 3004/3005, with synthetic data; a confirmed missing-inventory receipt produced stock 2, average cost 125000, one movement, audit and confirmation receipt, without adding cash transactions or project expenses. Seven viewport sizes retained five-row pages and no overflow. Scoped formatting passes; repository-wide formatting has 105 pre-existing unrelated failures. Final visual fixes retain whole reference labels, right-aligned mobile amounts and initially visible exact confirmation totals.

See `docs/guide/ai-warehouse-intake-verification-2026-10-12.md` for reproduction, evidence and verification limits.
