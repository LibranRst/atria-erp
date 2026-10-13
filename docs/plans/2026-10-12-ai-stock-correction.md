# Direct stock corrections from chat

Approved: complete direct stock correction flow with incumbent AI card/sheet UI and visible Browser testing.

## Contract

- Add bounded read-only source context and immutable STOCK_CORRECT proposals inside the existing PROCUREMENT_WAREHOUSE family. Resolve actual material/location/project references; one-character search and20-row pages; never choose the first match or invent quantity/cost/reason. Quantity is an explicit increase/decrease delta; measured stock-count workflows remain available.
- One location and up to50 unique materials per proposal. Require a human audit reason; optional row notes and explicit movement cost use the existing manual contract. Project/RAP/Material-expense references obey current tenant/category/project links. Current stock cannot become negative or lower than reservations.
- Check actual active user, locked role/grants/data scope, material/location availability, operational readiness and exact source versions at confirmation. ASSIGNED requires its accessible project; NONE remains warehouse-domain only. No approval-grant escalation or emergency self-approval.
- Extract a locked transactional writer used by existing manual adjustment aliases and AI. Preserve public signatures and compatibility. Each row writes ADJUSTMENT stock movement plus audit; one stored-identity confirmation commits the complete batch and one idempotent receipt. Replays and uncertain results cannot double-post. Average cost, reserved stock, expenses/budget realization, cash and bank balances are not correction targets.
- Original emergency adjustment remains its protected workflow. Corrections to reviewed inputs request a fresh immutable proposal; cancellation before confirmation does not change stock.

## Presentation

Inherited Atria Operate local extension; no new visual world/concept roll. Reuse ProcurementWarehouseProposalCard, ProposalCardShell, ProposalInlineReview/ProposalDiffRow, FormSheet, ReviewCollection/ReviewItem, GroupedSurface/FactRow, SheetFooterActions and ConfirmationDialog. Small corrections expose complete stock differences inline plus one concise confirmation; multi-row proposals use five-row pagination, desktop two-pane review and mobile summary/list stack. Keep stock quantities normal-sized, units explicit, audit reason visible and permitted budget context grouped in the existing location. Use existing UI ownership, motion, touch and focus infrastructure.

## Verification

Strict schemas and adaptive review routing; disposable Postgres for increases/decreases, batches, replay/concurrency, ownership/tenant/scope/permission/readiness, stale/expired/no-op/invalid source, reservation floors, rollback, shared manual writer and protected financial invariants. Browser on the visible3004 QA tab: search/selection context, inline and batch preview, confirmation/cancel/commit, stale/recovery, saved result and material-page refresh. Mobile320/360/390/430 and desktop1024/1280/1440; keyboard/reduced motion. Workspace gates, fresh Impeccable finishing reviewer/documenter and graph refresh. Record live model certification separately if synthetic stored tool outputs are used.

## Completion

Implemented strict core inputs, two read-only tools, locked immutable proposal context and a transactional manual/AI writer inside PROCUREMENT_WAREHOUSE. Confirmation uses the existing fixed owned-identity operations; no new transport operation, role grant migration or UI primitive is needed. Direct adjustment aliases are Supported in the action coverage matrix; the inventory consistency test now checks both routes and their actual confirmation path.

Fifteen disposable integration cases/101 assertions and the full workspace gates verify the contract. Visible Browser saved one six-material batch and one single correction: seven movements/audits and two receipts, exact quantities, unchanged reservations/valuation/finance. Cancellation and an actual stale commit were verified; all seven required responsive widths passed. Fresh Impeccable verdict: ship, no material fixes. Details and evidence boundaries are in `docs/guide/ai-stock-correction-verification-2026-10-12.md`; live model selection is still uncertified, while the real UI/HTTP/API/database path is exercised.
