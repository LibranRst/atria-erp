# AI expense batch — implementation and verification

Date: 2026-10-11. Scope: multi-line expense draft, selected submission, continuation of owned manual drafts, verification, approval/rejection and payment as separate human-confirmed actions.

## Implemented contract

- One draft supports 1–50 rows, stable keys, 30-day expiry, revision checks and persisted selection. Unknown amounts/categories remain incomplete. The model only reads context and prepares proposals.
- Review uses shared `ProposalCardShell`, `ReviewCollection`/`ReviewItem`, square `ChoiceRow`, grouped form controls, `MoneyValue`, `FormSheet`, `ProposalInlineReview` and `ConfirmationDialog`. Five rows per page. Desktop uses a main review column with budget disclosure and a summary/action aside; mobile keeps one column.
- Corrections are applied to draft metadata before submission. Selected valid rows commit together; remaining rows stay draft. Resuming a manual draft removes only submitted rows, guarded by its revision. Retry tokens and receipts prevent duplicate submission.
- Material stock modes use the same transactional writer as manual expense submission. Explicit Material stock handling is permission-checked; non-material entry remains simple. Submission does not pay cash.
- Owned chat image evidence is adopted through a separate private expense reference without destroying the chat attachment. Receipt ownership and project linkage are checked server-side.
- Verification, approval/rejection and payment are independent proposals. Every action rechecks grants, project scope, source status and snapshot. AI has no emergency override. Payment requires an active bank account and a distinct human-provided reference for every cost; all selected ledger writes and audits commit atomically.

## Automated verification

`bun run test`: 2,081 passing tests, zero failures across the workspace and operator scripts. Core batch boundary/identity tests, read-only tool coverage and adaptive review policy are included.

Disposable PostgreSQL suite: 15 passing tests, zero failures. Run through the local Postgres preload, which supplies `ATRIA_TEST_DATABASE_URL`; no test used the development database. Covered partial/repeated submission, double-click/idempotent replay, manual-draft continuation and races, conversational corrections, stock movement modes and forecast, evidence adoption/ownership, expiry/revocation/project assignment/tenant isolation, 50/51 boundary, stale data, verification/independent approval/payment, rejection, and rollback after a later selected write fails.

Workspace build, API/web/mobile type checks, token and HeroUI style checks passed. Final lint has zero errors and the pre-existing Material Master `accept` dependency warning. Final web build passed after the last UI edit.

Scoped Prettier verification passed for the changed feature files and design documents. The global format check reports 106 unrelated existing files; they were not mass-reformatted.

An older Dashboard button test depended on the previous icon pack's SVG dimensions. Its assertion now checks accessible SVG rendering while retaining the compact capsule assertions.

## Dev app review through @Browser

Live chat prepared a six-row Menteng expense draft using the real context/proposal tools. Initially five rows were ready and one category was missing. The sixth category was corrected through the shared selector and applied to draft metadata. Rapid selection changes responded locally, with all six selections and the correction retained after reload. The protected submission confirmation showed six rows and Rp370,000; it was cancelled.

Review was resized across mobile 320/360/390/430 and desktop 1024/1280/1440 pixels while keeping the same draft. DOM geometry checks showed no horizontal overflow in the review. Pagination exposes five rows then the sixth; keyboard focus reached normal-sized editable values. Screenshots are under `output/ai-chat-qa/expense-batch-workflow/`.

Live context lookup found one submitted Material cost and one approved Operasional cost. The verification proposal showed the actual requester, quantity, amount and status transition. No verified cost was available for an approval preview. For payment, the assistant requested account/reference first, then prepared the existing approved cost with BCA Operasional and the explicitly synthetic QA reference. Verification and payment protected confirmations were opened and cancelled; payment showed the account and before/after balance. Multi-cost decisions, rejection and successful saved outcomes are covered by database tests rather than invented dev records.

Browser checks write only AI draft/conversation metadata. Business submission, decisions, stock effects and cash payments are verified by the disposable database suite, not committed in the development app.

The finishing review requested two visual fixes: supporting requester/quantity/unit-price facts moved into the single-claim Rincian disclosure, and embedded blockers moved immediately after project identity. A clearly labeled synthetic stale-snapshot AI proposal verified the blocker order and disabled payment on desktop and mobile. That fixture changes only conversation/proposal metadata. Post-fix web build, type check, lint and nine adaptive policy tests passed. Final finishing disposition: ship.

## Acceptance notes

The capability catalog, fixed web operations, typed facades, architecture and coverage matrix were updated. No schema migration is needed: owned form drafts and AI mutation receipts reuse existing storage. This closes the expense batch workflow, not every remaining AI action gap.

## Reopened UI consistency verification

The user rejected the initial visual result. The earlier verification established working flows, but missed inconsistent density and composition compared with the approved RAP/RAB reviews.

The dev app was retested through @Browser with mouse clicks, editing and pagination. Fixed: an oversized mobile category-summary block, repetitive verification/stock copy on ordinary rows, three large footer actions, the single-column desktop editor, tiny uppercase review labels, empty-child row spacing and the Apply button swapping into Submit. Draft cards now follow the compact RAP/RAB composition. Review keeps two main facts, supporting category budget below rows, normal sentence-case fields, quantity/price beside each other on desktop, and compact secondary utilities. Shared ReviewItem places the mobile amount beside its summary and avoids an empty detail gap.

Single-claim stage cards now show expense identity and shared status/balance comparisons instead of separate equally weighted status/balance rows. Multi-claim stages use contextual rows with one active Rincian disclosure. Payment reference stays visible. The final finishing review found three further issues: above-row budget, a split Rekening label and a truncated stage title. These were corrected and all three scored resolved; final disposition: ship.

Real QA draft quantity changed from one to two, recalculating its selected total to Rp420,000. Apply persisted metadata only; Submit remained disabled before Apply and required a separate protected confirmation afterward. Rapid selection, five-row pagination, reopening/reload and responsive resizing retained corrections and selection. Submission confirmation was cancelled. A clearly labeled synthetic six-cost proposal tested multi-row payment layout without creating costs or cash records; missing source IDs deliberately prevent payment.

Mobile320/360/390/430 and desktop1024/1280/1440 were checked. Evidence is under output/ai-chat-qa/expense-batch-workflow/ux-consistency. All 985 web tests passed; the 11 targeted grouped-review/form/adaptive-policy tests passed again after the fixes. Web type checks, build, scoped lint, Prettier and diff whitespace checks passed. Global lint retains one pre-existing Material Master hook warning. The design hook also reports existing font/radius literals elsewhere in globals.css; this refinement changes only the shared review-label rule and does not suppress those findings.

User follow-up: shared Edit/Ringkas now uses the same below-summary action row as Rincian across similar AI reviews. Expense selection controls use the white secondary button; Browser computed style confirmed rgb(255, 255, 255) at rest, retaining the ordinary hover state. Draft and stage budget disclosures reuse the RAP 16px horizontal wrapper and non-inset inner facts. Measured left/right insets are 16px at all seven widths, without horizontal overflow. Edit/collapse and budget disclosure interaction passed in the visible preview tab. Two shared-review/form tests, web typecheck, scoped lint and formatting passed; finance data was not changed. Evidence: ux-consistency/controls.

Selection refinement: Material Master, client RAB draft and expense draft now use the shared labeled Pilih/Dipilih control beside Edit. ReviewItem no longer reserves a leading checkbox column. The checkbox remains independent of validation/saved state; Material Master does not repeat selected status in its readiness label. Expense chat correction is a full-width secondary action under Submit; project navigation is beside metadata discard below review content. Browser verified Space toggling, immediate count/total, unchanged editor state and seven-width selection retention. Shared DOM fixtures cover mobile and desktop semantics, including disabled choices. A desktop adapter defect that forced role=button was corrected for selection roles while retaining its visual classes and unified motion. All 985 web tests, build and lint passed after this change. Screenshot evidence: ux-consistency/selection. Business records remained unchanged.

Divider and selector refinement: review collections, embedded editors and AI fact groups now use the manual FormSection `outline-variant/20` separator rather than the 2% surface ring. Browser computed styles confirm 1px manual-token separators. Shared plain/search/filter selectors animate the full popup using Dashboard anchored motion for entry and exit; the hidden option collection remains mounted, interrupted exits are cancelled, and create actions wait for focus restoration. Search resets after exit. The shared DOM fixture verifies action-to-input focus handoff. Browser verified Enter, Escape, repeated opening, current category label, and editor/selection continuity at seven widths with no horizontal overflow. All 985 web tests, web build, workspace lint (zero errors, existing dependency warning) and HeroUI style check passed. Business data stayed unchanged. Evidence: ux-consistency/dividers-motion.

Inline stage-card actions now compose the shared SheetFooterActions adaptive layout: correction and commit align in one row when labels fit, with matching control height; narrow cards wrap without clipping. Retained batch review asides keep their primary-first vertical order. @Browser verified the annotated 785px card, both verification/payment cards across 320/360/390/430/1024/1280/1440px, no page/button overflow, and separate verification confirmation (cancelled). Evidence: ux-consistency/inline-actions. No business action was committed.
