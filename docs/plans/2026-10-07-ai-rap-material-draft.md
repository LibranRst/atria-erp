# AI draft RAP Material

Approved milestone: prepare a project's Material RAP through chat using existing Material Master, quantities/buffer and estimated cost; review the Material budget before explicit Save. Existing AI chat/composer/history presentation stays intact. Stock reservations, movements, purchases, payments, finalization and client-facing RAB remain separate workflows.

## Behaviour and authority

- Read-only scoped project/RAP context and material lookup; resolve project and material IDs from database, ask for selection on ambiguous names. Only active materials can be added. No invented units, costs or implicit quantity conversion.
- Up to 50 rows per proposal, no silent truncation. This milestone takes conversation inputs; it adds no new attachment parser or link ingestion. Missing prices require user input unless a verified reference price exists; zero is accepted only as an explicit input.
- User with use:ai_chat, update:rap, view:budget and view:material can prepare/confirm within GLOBAL/ASSIGNED project scope. Creating a new RAP with rows also requires create:rap. NONE and unassigned projects are denied without existence disclosure. Scope/permission is resolved again from server Actor at preview and confirmation.
- Target a Draft/Active project with no RAP or the latest existing Draft. Create header and rows atomically if none; append rows to the existing Draft without replacing existing items. Reject locked/non-draft RAP and completed/cancelled projects. No automatic new revision, lock, Tukang/Subcon skip, baseline publication or RAB.
- Show budget category usage before stock hints. Compare total RAP plan after addition against Material allocation; separately display actual, pending and remaining budget. Do not add spent expenses to the same planned baseline or treat this draft as budget consumption.
- Capture project/RAP/items/budget and selected material/reference/stock context versions. Confirmation loads the owned persisted assistant proposal, expires after 30 days, compares live context, and rejects changed data before any write. It accepts identity only, not client replacement fields.

## Shared domain implementation

- Extract create/append/update/delete/lock RAP transactional helpers used by ordinary actions and AI; retain public manual signatures. Serialize through project/RAP locks so manual input/finalization and AI Save cannot race. Validate scoped project, target Draft and material references in the transaction; audit every change.
- Use one pure canonical quantity/cost calculation for manual and AI: quantities and currency at the schema's two-decimal precision with finite/bounded values and exact scaled arithmetic. Estimated totals match the stored rounded quantities. No arbitrary SQL.
- One selected proposal commits header/items, audit and existing AI confirmation receipt in one transaction. Replaying the same identity returns the receipt. Failure rolls back the whole set. Inventory quantities/defaults/cost, stock movements, cash, budget allocation and actual/pending usage remain unchanged.
- Add core Zod DTOs, typed fixed backend operations/web facades, tool catalogue, parser and readable tool labels. Reuse the stored-proposal ownership helper from Material editing where appropriate.

## UI and verification

- Compose existing ProposalCardShell, MoneyValue, InlineReviewStrip, grouped rows, DesktopTable and shared DetailSheet/OperationalFormSheet when detailed review needs space. Project/Material budget summary owns hierarchy; item list is grouped, not repeated elevated cards. Five rows mobile/ten desktop; display source of cost, quantity/buffer, estimated total and advisory stock, with contextual errors/receipt/stale recovery and correction through chat.
- Preserve 664px chat lane/600px card cap, wizard and draft state, reduced motion and shared overlay/focus owners. Test only through actual dev @Browser at 320/360/390/430 and 1024/1280/1440; no business saves on dev for QA.
- Core calculations/limits and permission/catalog tests. Disposable PostgreSQL via ATRIA_TEST_DATABASE_URL for new/existing Draft, PM assignment/custom roles/revocation, owned/expired/tampered proposals, stale budget/material/stock/RAP context, inactive material/invalid prices, race with manual add/finalize, idempotent double-click, full rollback/audit and unchanged stock/cash/budget values.
- Update AI architecture/coverage, workspace gates, changed-file formatting and graph. Finish with the Impeccable screenshot review/documenter required by the local-extension workflow.

## Acceptance evidence

- Implemented scoped lookup and immutable owned RAP proposals, identity-only preview/confirmation facades, 30-day expiry, canonical exact quantity/cost arithmetic and atomic header/items/audit/receipt. Manual RAP creation/item mutations, setup/finalization, template copying and revision creation share project/RAP serialization; template copying preserves its library snapshot/audit and uses the same exact calculation.
- Workspace tests: 1,947 passing normal tests; disposable PostgreSQL: 19 passing integration tests / 108 assertions (10 RAP and 9 Material Master edit regressions). Cases cover atomic new/append Draft, replay/double-click, custom assignment/revocation/ownership, expiry/stale context, closed project, missing grant/price/inactive material, manual create/add/template/finalize races and complete rollback. Inventory/cash/usage remain equal to their pre-save values.
- Workspace API/web/admin/mobile build and type checks pass. Lint passes with the pre-existing Material Master effect dependency warning. Changed files pass formatting; global format check still reports 112 unrelated files and was left scoped to preserve existing work.
- Actual dev web @Browser: verified 320/360/390/430 and 1024/1280/1440 with no document/dialog horizontal overflow; 5 mobile/10 desktop rows, next/previous pages, resize with an open review, reload restoring proposal and keyboard dismissal. Normal and over-allocation examples were reviewed; business Save was never clicked in dev. The explicitly labelled QA chat messages remain in history.
- Screenshots: output/ai-chat-qa/rap-draft-mobile.png, rap-draft-1440.png, rap-draft-over-budget-mobile.png and rap-draft-over-budget-desktop.png, plus seven viewport captures. Reused ProposalCardShell, DetailSheet, DesktopTable, MoneyValue and public Button/AppIcon; no new primitive or motion infrastructure.
- Impeccable finish verdict: ship. Its sole finding (a normal-budget heading shown on an over-allocation proposal) is resolved and verified in the chat card and both detailed layouts. The documenter recorded the narrow Planned RAP Review Rule in DESIGN.md and the existing sidecar.
