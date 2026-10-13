# AI project and budget management

Approved scope: project metadata editing, PM assignment, activation and closing; canonical project-budget category allocation and submit/approve/reject decisions; exact impact preview before human confirmation. Company Settings defaults and remaining Finance workflows are later work.

## Contract and execution

- Add strict core PROJECT_MANAGEMENT proposal/view/receipt contracts and read-only context/proposal tools. Resolve references through current tenant data, paginate candidates, and reject ambiguity. The model never writes business data.
- Stored owned assistant proof, 30-day lifetime and identity-only fixed get/confirm operations retain live Actor grants, GLOBAL/ASSIGNED/NONE project scope, freshness, atomic audit/notification/receipt and replay protection.
- Extract shared transactional project identity/PM/status and canonical budget decision/allocation writers from the existing manual paths. Preserve public signatures and existing domain approval/readiness rules. Recheck scope under the project lock, serialize manual/AI races and validate reference clients/active assigned-scope PMs.
- AI metadata edits preserve omitted fields and cannot bypass activation/closing or approved RAB/Change Order contract controls. Activation requires an active assigned-scope PM, approved budget, approved RAB and matching locked RAP. Closing uses the real checklist and records the final profitability snapshot inside the same locked transaction; blockers never disappear through AI approval.
- Partial allocation edits preserve untouched categories. Evaluate the complete resulting allocation against the internal cap, use exact cents, keep actual/pending/paid separate, and require approval authority plus a human reason for approved-budget reallocation. Show below-actual and below-plan risks explicitly. No cash or stock mutation occurs.

## Presentation

Reuse ProposalCardShell, ProposalInlineReview/ProposalDiffRow, FactRow, MoneyValue fullDynamic, FormDisclosure, ReviewCollection/ReviewItem, ProposalReviewFeedback, ConfirmationDialog and FormSheet. Small metadata corrections act directly from the card. PM reassignment, activation, closing, budget approval/rejection and allocation changes use one short protected confirmation. Larger edits/category lists retain two-panel desktop review, mobile summary-first grouped rows, five rows/page and stable resize ownership. Display project identity, before/after fields, complete category allocations/remaining budget and margin facts, required reason, readiness/closing blockers and saved result.

## Verification and finish

Use pure schema/impact tests, meaningful DOM flow tests, and disposable PostgreSQL integration through ATRIA_TEST_DATABASE_URL for real shared writer/AI receipt tests: dynamic/custom-role scope, revoked grants, foreign proof, stale source, double click/replay, manual races, rollback, activation/closing blockers, subset allocation totals, audit/notifications/final snapshot and unchanged cash/stock. Live dev app visual QA uses @Browser only with synthetic owned preview metadata at 320/360/390/430 and 1024/1280/1440. Use bounded Impeccable inspection and independent finish/documentation handoffs. Update AI architecture/coverage, run workspace gates and refresh graph.

Status: complete.

Implemented PROJECT_MANAGEMENT strict contracts, two read-only tools, fixed get/confirm operations, typed facade/reader/renderer and adaptive review policy. Manual identity/PM/activation/closing and canonical allocation/decision paths share locked writers. Allocation checks include untouched categories; closing source checks/final snapshot and AI receipt are atomic. Retained cards stay compact, with complete risk/change information in the opened review; inline decisions expose their context on the card. No migration/grant or cash/stock write is introduced.

Verification: 2,035 workspace tests pass; the focused policy/DOM run passes8 tests. Disposable PostgreSQL validates11 new project/budget cases, existing activation and the finance/stok walkthrough; the combined final regression run passes46 tests. Regression exposed an existing stock-validator incompatibility with seeded PostgreSQL GUIDs; strict GUID formatting now accepts those existing IDs while still rejecting malformed IDs, with a focused test. Workspace build, typechecks, tokens/HeroUI checks, zero-error lint and scoped formatting pass. One existing Material Master effect-dependency warning and unrelated workspace formatting drift remain.

Live dev-app @Browser evidence covers10 card cases at all seven required widths (70 checks), with desktop/mobile metadata and allocation reviews, disclosure and resize evidence. Synthetic owned conversation a7bed9b9-3217-43e4-a22e-3285274cff1c has invalid snapshots and zero business writes. Independent Impeccable finish disposition is ship with no material fixes; scoped DESIGN.md/sidecar documentation is aligned. Graph refresh follows final documentation.
