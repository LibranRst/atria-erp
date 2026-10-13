# AI stored vendor bill corrections

Complete stored vendor-bill corrections inside the existing PROCUREMENT_WAREHOUSE family. Preserve the approved adaptive card, shared grouped review, five-row pagination, two-pane desktop and mobile summary/footer behavior.

## Domain and authority

The current catalog advertises update:vendor_bill as manual, but no stored-bill correction writer/action is implemented. Add a typed shared transactional correction writer and an explicit API compatibility action/web facade, then reuse that writer from identity-only AI confirmation. Do not replace draft creation, payment, receipt or stock workflows.

Support an explicit partial patch of bill number, due date, notes and nominal amount with a mandatory human reason. Preserve omitted fields and immutable vendor/project/category/Material/RAP/package identities. No client status, payment, cash or stock edits. Real tenant Actor rights and ASSIGNED scope are mandatory; NONE has no project-finance access.

VOID bills block corrections. Settled PAID bills allow documentary corrections but keep their amount. Active payment schedules block amount corrections until the schedule is decided/cancelled through its existing flow. Without pending schedules, an unpaid/partially-paid amount may not fall below completed payments or the net recorded goods-receipt value. Reject inconsistent accounting sources and no-op patches. Keep completed payments, reconciled ledger rows, receipts, stock and old audit evidence intact.

Synchronize the existing canonical project expense and category usage for amount corrections: Material purchase retains INVENTORY_ASSET accounting and does not become immediate Material realization; non-Material bills update their existing realization. Do not add another expense or pay cash. Determine outstanding/status from actual completed payments and the corrected amount. Use source fingerprints including bill, expense, category, payments and receiving movements to prevent stale confirmation. Supplier identity locking guards duplicate bill numbers. Audit the old/new source with the supplied reason in the same transaction as the AI confirmation receipt.

## Discovery and presentation

Add permission-scoped stored-bill lookup and a correction proposal tool. One-character search, explicit ambiguity/choice, stable20-row paging and current eligibility/blocking explanations are required. Lookup returns editable fields and preserved source context; it cannot expose another project's bill or financial facts without their applicable read grant.

Reuse ProcurementWarehouseProposalCard. Small documentary corrections show their complete before/after and explicit save on the card; nominal corrections add one short shared confirmation. Larger patches or budget risk retain one content-sized FormSheet with contextual ReviewCollection rows on the left and summary/actions on the right. Mobile stays summary-first. Changed text/date fields must be readable before commit. All money uses shared fullDynamic formatting. Saved outcomes point to expenses; stale/revoked/pending/error recovery remains explicit. Chat correction prepares a fresh immutable proof.

## Verification

Core precision/date/strict patch tests; disposable PostgreSQL tests for source lookup, grants/scope/tenant, omitted fields, duplicate references, completed-payment/receipt floors, pending schedules, settled/void states, Material vs non-Material budget, ownership/revocation/staleness, manual/AI races, rollback and idempotent receipts. Preserve existing procurement/warehouse suites.

Use the visible @Browser real dev app with disposable synthetic proofs, including documentary, amount, complex/budget-risk, blocked, stale, cancelled confirmation and saved cases. Verify desktop1024/1280/1440 and mobile320/360/390/430; preserve the preview tab. Run workspace tests/types/build/lint/styles/scoped formatting, record unrelated format baseline, update coverage/architecture/design through bounded finish handoffs and refresh graft. No development business data changes or bank transfers.

## Completed — 12 October 2026

Implemented shared correction writer/manual facade, strict core contract, scoped lookup/proposal tools and adaptive UI within PROCUREMENT_WAREHOUSE. No migration or existing business-row rewrite was necessary. Five authentic synthetic proofs remain in the visible disposable Browser preview. Confirming the Material amount changed the existing source/bill from 2,000,000 to 2,400,000 with one audit/receipt, unchanged cash/stock and Material realization 0. Seven settled viewport checks passed; visual finish verdict ship with no material fixes, and DESIGN.md/sidecar were documented from the shipped source. Workspace 2,106 tests and 33 disposable integration cases passed, as did types/build/lint/styles/scoped formatting; global format retains 105 unrelated baseline failures. See `docs/guide/ai-vendor-bill-correction-verification-2026-10-12.md` for evidence and provider/motion verification limits.

## Budget disclosure placement refinement

Move Rincian budget out of the stored-bill summary and below reviewed changes in the main pane, following the existing RAP review reading order. Mobile keeps the concise summary above changes and budget details below them. Reuse GroupedSurface, plain FormDisclosure and aligned inset-free FactRow values inside the shared side padding; preserve budget-view permissions, expanded state, shared content-size motion and protected actions. Other procurement reviews reuse this disclosure composition without changing their established position. Verify closed/open states and the required mobile/desktop viewport matrix in the visible disposable Browser preview; no business writes are needed.

Completed the placement refinement in the shared procurement card. Browser checks covered collapsed/expanded states at 320/360/390/430 and 1024/1280/1440 px: one disclosure below the four reviewed fields, consistent 16px inner side padding, no horizontal overflow or clipped money, and preserved expansion through resize/reopening. Keyboard Enter toggles the disclosure; existing shared motion/overlay ownership remains intact. API/web/mobile types, workspace lint and changed-file formatting pass. Global format has 104 unrelated existing failures, and lint retains the existing Material Master hook warning. Evidence is under output/ai-chat-qa/vendor-bill-correction/budget-placement; the visible disposable preview stays open at its normal viewport with no business writes.
