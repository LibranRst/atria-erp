# Quick Start through chat

Approved: complete the existing Quick Start workflow through AI chat, retain incumbent card/sheet UI, and exercise real confirmation in a visible Browser QA tab.

## Contract

- Add read-only setup context and immutable QUICK_START proposals. Actions: acknowledge the current step, pause, resume without skipping, retry the current step, declare the human's initial-stock decision, and create the first project with its canonical budget while completing Quick Start.
- Settings remain authoritative. Read actual active cap/category defaults, client/PM choices and readiness blockers. One-character lookup, twenty-row pages, explicit ambiguity resolution. Do not invent amounts, RAB approval, stock decisions, clients or setup completion.
- Reuse shared manual/AI transactional writers. Lock tenant, current role/user/grants, configuration/defaults and relevant references. Preserve existing manual public signatures and legacy mapping. No AI bootstrap, credentials, grants or emergency bypass.
- Human identity-only confirmation rechecks unique owned proof, thirty-day expiry and exact source fingerprint. State/event/audit/project/budget and one receipt commit atomically; concurrent/replayed confirmations do not duplicate projects or advance twice. No-op decisions need no write. A malformed setup/default or invalid source stays blocking.
- Stock decisions change readiness metadata only, never stock/cash. “No existing stock” is blocked if actual nonzero physical/reserved stock or pending opening batches contradict it. Existing stock setup uses the already supported independent opening approval workflow.
- Retrying records the existing bounded retry event, not an automatic business retry. Completed setup is not reset. Progress actions do not silently review/skip financial defaults.

## UI

Inherited Atria Operate extension. Reuse ProposalCardShell, ProposalInlineReview/ProposalDiffRow, GroupedSurface/FactRow, ReviewCollection/ReviewItem, MoneyValue, FormSheet, SheetFooterActions and ConfirmationDialog. Progress/stock decisions show complete compact card differences; project creation retains desktop two-panel/mobile summary-first five-row review and one explicit Save. Required stock decision gets one concise shared confirmation. No new shared primitive, typography, token or motion infrastructure.

## Verification

Disposable Postgres: preparation/no-op, every transition, pause/resume/retry, Settings-based first project, client/PM validation, source drift, ownership/expiry/grant/tenant checks, stock-readiness guard, concurrency/replay, rollback and shared manual compatibility. Visible Browser: actual progress/stock/project confirmation, cancel, stale/recovery, resulting setup/project, all seven responsive widths, keyboard/reduced motion. Workspace tests/build/typechecks/lint/scoped formatting, fresh Impeccable finish reviewer/documenter and graph refresh. Synthetic stored proofs and model live verification are reported separately.

## Completed

The immutable QUICK_START family, two read-only tools and two fixed identity-only operations implement the full flow. Existing manual operations share the locked transactional writer; source resolution is tenant-scoped, actual user/role/membership/grants are authoritative and malformed/default/reference sources stay blocking. Project creation and setup completion share the audit/event/receipt transaction. Resume is an explicit action without stage advancement. Retry records telemetry/audit only. No new UI primitive or grant migration is introduced.

Sixteen disposable integration cases/63 assertions, core and workspace gates passed. Browser confirmed seven setup decisions and created exactly one project/budget with five categories, preserving all physical/cash and pre-existing budget hashes. All seven widths and keyboard/reduced-motion interactions were checked. Final fresh review: ship, no material findings. `docs/guide/ai-quick-start-verification-2026-10-13.md` records acceptance and the unverified live-model boundary. The five previously Gap-labelled registered Quick Start operations now have their real supported proposal/confirmation route.
