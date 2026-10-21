# AI bank reconciliation: complete owned workflow

Extend the approved AI review family without changing its visual world. Finish import, matching, ambiguous pair review, exception marking/clearing and saved results. Bank reconciliation compares one bank mutation to one existing Atria cash transaction; it never creates payments, balances, stock or project costs.

## Authority and shared operations

Use actual server Actor, tenant scope and existing reconcile:ledger bank-domain rights, plus use:ai_chat and view:bank_account for chat. Require an explicitly resolved bank account; never fall back to the first account. Extract shared transactional import/match/exception writers and preserve manual public signatures. Lock the bank account and sorted cash/statement rows, reject already matched or inconsistent account/direction/cent amounts, clear exception only through the explicit action, audit every change and preserve paired reconciliation. Model tools remain read-only business-wise.

## Inputs and review

Read owned chat attachments through the existing bounded private attachment service and bank-statement analyzer (CSV/TXT, Excel, PDF/images already supported). Import analysis prepares rows only. Preserve source filename/sheet/row where available; reject overflow beyond 500 and avoid silent spreadsheet truncation. Require a user-selected account even when the document detects one; expose detected account mismatch. Support manually supplied mutations and review corrections.

Use BANK_RECONCILIATION_WORKFLOW contracts in core. Distinguish IMPORT, MATCH, MARK_EXCEPTION and CLEAR_EXCEPTION. Existing mutasi context is paginated, tenant-scoped and includes authoritative IDs; no guessed IDs. Match only same account/direction/exact cents; one candidate or one exact reference can be suggested, multiple candidates remain ambiguous and unselected. Persist review rows/selection/explicit candidate choices in an owned 30-day form_draft with revision checks. Save only the selected reviewed subset, atomically with audit and receipt; remaining rows stay visible in the operational queue and can receive a fresh proposal. No auto approval or automatic cash creation for unmatched bank rows.

Replace the legacy client-payload bank confirmation with owned proof validation, retaining a safe compatibility path for stored historical proposals. Register fixed read/patch/confirm/discard operations and typed HTTP facades. Immutable exception proposals require a human reason and show current vs resulting status.

## Presentation and verification

Compose existing ProposalCardShell, ProposalInlineReview, ProposalReviewFeedback, ReviewCollection/ReviewItem, ReviewSelectionControl, FormSection/fields, MoneyValue fullDynamic, Select, FormSheet and adaptive SheetFooterActions. Single decisions stay inline with a short confirmation; multirow imports/matches use content-sized two-pane desktop review and summary-first mobile. Five rows per page, one inline editor, local selection without a network spinner, explicit Apply separate from business confirmation. Keep state and overlay ownership through resize. Use normal divider/depth/radius tokens and shared disclosure motion.

Core tests verify dates/precision/500 boundary, exact matching and ambiguity. Disposable Postgres through ATRIA_TEST_DATABASE_URL verifies ownership, live permission revocation, inactive/foreign account, stale data, duplicates, manual races, invalid candidate/duplicate pair, revision conflict, retry/double-click, rollback, audit and unchanged balance/ledger/stock. UI tests verify protected confirmation, persistence, selection and pending/privacy states. Preview real proposals and uploaded synthetic files in visible @Browser on localhost dev, mobile320/360/390/430 and desktop1024/1280/1440; cancel business actions there. Run workspace gates, update coverage/architecture, finish review/documentation and refresh graft.

## Completion

Implemented the owned import/matching/exception lifecycle, shared manual writers, actual dynamic grants and tenant checks, persistent draft/revision/selection, protected subset save and receipt. Whole-queue matching is available through explicit allUnmatched:true, with a500-row guard; subset matching remains explicit. Old mutable client proposals require regeneration. See docs/guide/ai-bank-reconciliation-verification-2026-10-11.md for functional, Browser, quality and finish evidence. The fresh finish review disposition is ship; no material fixes remain.
