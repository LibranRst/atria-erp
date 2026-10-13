# AI remaining material actions

## Scope

Extend the existing project-stock review with reservation release and warehouse waste. Add goods-receipt reversal request, independent approval and rejection to the existing procurement/warehouse review. Model tools remain read-only; identity-only explicit confirmation executes the shared transactional domain writers with atomic receipts.

Reservation release is a new neutral movement (`RELEASE_RESERVATION`): physical stock, cost and cash remain unchanged. Release only the current project's matching material/location/RAP reservation. The movement type column is varchar, so no database migration or new grant is required; use existing `reserve:stock`. Project projections must consume the release history.

Waste uses `waste:stock`, a human audit reason of at least ten characters, existing cost attribution and non-cash Material actuals. It consumes warehouse stock and this project's reservations, never other projects' reserved stock. It is distinct from physical returns of previously recorded use.

Receipt cancellation preserves the request/approval/rejection state machine, assignment scope and maker/checker rules. Emergency self-approval stays manual. The shared reversal writer validates current remaining stock/value and reservations, creates compensating movements, updates valuation, and records audit/notifications in one transaction. Request and rejection change no stock.

## Implementation

1. Extend core contracts, calculations and labels; extract receipt preparation/writers and route existing manual actions through them without changing public signatures.
2. Extend read-only project-stock tools and add receipt lookup/proposal support with database permissions, exact source snapshots, 30-day owned proposals, stale protection and atomic receipt replay.
3. Reuse ProposalCardShell, FormSheet, ReviewCollection/ReviewItem, FactRow, MoneyValue, ProposalReviewFeedback and ConfirmationDialog. Preserve desktop two panes, mobile one column, five rows per page, quiet details and shared motion.
4. Register fixed operations/facades where needed. Update capability catalog, coverage matrix, architecture and design documentation.

## Verification

Meaningful calculation tests; disposable PostgreSQL integration through ATRIA_TEST_DATABASE_URL for release quotas, waste attribution, assignment/custom grants, revocation, maker/checker, reversal guards, stale/manual races, idempotent confirmation, rollback, stock/movement/audit and unchanged cash. Check inherited review interactions in DOM tests. Verify dev app via @Browser at 320/360/390/430 and 1024/1280/1440, including resize/keyboard and pagination. Finish with independent visual review/documentation, workspace gates and graft build. Preserve unrelated workspace changes and report pre-existing gate failures separately.

## Status

Implemented and verified.

- Shared manual/AI project-stock writer covers release and waste; extracted receipt preparation/writer preserves manual public signatures and replay behavior, with tenant/assignment and maker/checker guards.
- Core contracts/calculations, typed fixed release operation/facade, read-only tools, capability permissions, review labels, coverage matrix and architecture are updated. No migration/new grants needed.
- Workspace tests: 2,018 passed. Disposable PostgreSQL AI suites: 24 passed; ordinary warehouse regression: 10 passed on the initial fresh seed. Coverage includes live permission/assignment, own RAP release quotas, noncash waste, stale/manual races, duplicate confirmation and rollback of all reversal items/audit/receipt. Core targeted tests and inherited review DOM suites passed.
- API/web/admin/mobile workspace build passed; final web rebuild passed after copy adjustments. Lint has zero errors and the pre-existing Material Master effect-dependency warning. Tokens/HeroUI styles and diff checks passed. Scoped files formatted; root formatting check still reports unrelated pre-existing formatting drift.
- Dev @Browser evidence: output/ai-chat-qa/material-remaining, five preview kinds across seven widths (35 checks), pagination preserved on resize and keyboard details. Synthetic owned AI message metadata only; fake business IDs deliberately block development mutations. Independent Impeccable finish verdict: ship. Matching DESIGN.md/sidecar rules updated narrowly.
- Emergency receipt self-approval stays on the manual form; AI never accepts emergency fields. Cash, vendor bills and actuals remain unchanged by receipt cancellation. Waste can affect noncash Material actuals through existing source attribution.
