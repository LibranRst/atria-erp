# Stored vendor bill correction verification — 12 October 2026

`getVendorBillCorrectionContext` and `proposeVendorBillCorrection` complete stored-bill corrections within the existing PROCUREMENT_WAREHOUSE family. This differs from creating/editing an owned invoice draft. The previous manual catalog label did not have a stored-bill writer; the new `correctVendorBill` API compatibility operation and typed web facade share the same writer as identity-only AI confirmation.

## Behavior

Actual `view:vendor_bill`, `update:vendor_bill`, AI access and project scope govern discovery/proposals. Custom roles do not need draft-creation permission. NONE is excluded from project finance; ASSIGNED remains restricted. Search accepts one character and returns 20 rows with continuation and actual source IDs.

Partial patches support bill number, due date, notes (explicit null clears) and finite positive two-decimal amount, with a human reason of at least ten characters. Omitted values and vendor/project/category/Material/RAP/package links remain unchanged. No client status or payment edits are accepted.

VOID is locked. PAID keeps its amount, while documentary corrections remain possible. PENDING/PROCESSING payment schedules block amount corrections until resolved; metadata can still change. Completed-payment and net-receipt floors protect existing transactions. Amount edits require one consistent canonical source expense, update that existing row, and synchronize category usage. Material retains INVENTORY_PURCHASE/INVENTORY_ASSET; other categories correct their existing approved realization. No new expense, payment, cash transaction or stock movement is created by correction.

Project eligibility follows the shared active-project guard in both lookup and writer; nonoperational projects return an explicit blocker and no editable fields. Inconsistent partial-payment history also holds amount corrections while documentary changes remain available.

Stored proof fingerprints cover the bill, project, supplier, category, expenses, payment and receiving sources. Current grants/source checks, audit and receipt share one transaction. Replay returns the prior receipt. Conflicts and active-schedule blockers remain explicit; ordinary source changes require a fresh preview. No migration is needed.

## UI and Browser proof

Small documentary changes display all date/text differences in the chat card and save explicitly. Nominal changes add one short shared confirmation. Three or more changed fields or budget risk retain the content-sized review: contextual divided rows left and grouped summary/budget disclosure/actions right on desktop, summary-first with bottom actions on mobile. The title is “Review tagihan”; the commit is “Simpan koreksi tagihan”. Text pairs show Sebelum/Sesudah; money uses complete unwrapped fullDynamic formatting. Confirmation prioritizes monetary differences and over-allocation before status/reason. Sources and the human reason remain visible before commit.

Shared primitives: ProposalCardShell, ProposalInlineReview, ProposalDiffRow, FactRow, ReviewCollection/ReviewItem, FormDisclosure, FormSheet, SheetFooterActions and ConfirmationDialog. Existing overlay ownership, focus, motion and footer colors/order remain authoritative. Independent Impeccable verdict: **ship**, no material fixes. The narrow stored-bill rule is recorded in DESIGN.md and mirrored in its sidecar.

Shared MoneyValue now supports optional `fractionDigits=2` through core `formatExactIdr`; correction views opt in only for fractional amounts. Existing whole-rupiah formatting and typography remain unchanged. A second authentic synthetic proof displayed Rp100,49 →Rp100,50 distinctly in the desktop card and mobile confirmation; cancellation left it unsaved. Shared SSR and disposable database tests preserve adjacent-cent values. Final formatting-delta verdict: **ship**, no visible regression. Captures: `fractional-desktop.png` and `fractional-confirm-mobile.png`.

The design hook flagged inherited literal font sizes in the shared page-primitives file; this feature adds no font sizes. A 12px typography exception is scoped to that file in `.impeccable/config.json` to preserve approved compact financial controls. Other detector rules remain active; no second detector or unrelated typography rewrite was run.

The visible preview at `http://127.0.0.1:3004/ai` uses API 3005 and the named disposable `atria_audit_reconciliation` database. Conversation “QA koreksi tagihan vendor · database disposable” contains five authentic owned proofs: documentary, Material nominal, four-field/budget-risk, active schedule and stale source. Model credentials are deliberately disabled there; this verifies UI → real API → database → receipt, rather than claiming a live-model conversation. Normal development at `http://localhost:3003/ai` retains its provider configuration and receives the implementation. No development business rows were changed.

Browser confirmation of the Material nominal case (`5f6744ba-a9bc-41a5-bfc8-87d96b0f5036`) verified:

| Record                                  | Before → after                             |
| --------------------------------------- | ------------------------------------------ |
| Bill amount                             | Rp2,000,000 →Rp2,400,000                   |
| Existing source expense                 | Rp2,000,000 →Rp2,400,000; one row retained |
| Material realization                    | 0 →0                                       |
| Cash transaction count                  | 49 →49                                     |
| Stock movement count                    | 7 →7                                       |
| Correction audit / confirmation receipt | One each                                   |

Cancelled confirmations did not execute the correction. Active schedules show the cause and recovery with Save disabled; stale sources show “Minta preview terbaru”.

Evidence is in `output/ai-chat-qa/vendor-bill-correction/`: desktop/mobile review, confirmation, documentary, blocked and Material saved captures; `review-320/360/390/430/1024/1280/1440.png`; `viewport-checks.json`; and `browser-save-result.json`. Settled native DOM measurements confirm four rows, five visible monetary nodes without horizontal clipping, no document overflow and an in-viewport dialog at all seven widths. Screens establish visual fidelity; they are not motion recordings.

## Quality gates

| Check                                    | Result                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Workspace tests                          | 2,106 passed, zero failures                                                        |
| Disposable integration                   | 33 passed across correction, procurement and intake suites; 9 new correction cases |
| Updated card DOM and review policy       | 13 passed                                                                          |
| API/web/mobile types and workspace build | Passed; final changed web build rerun                                              |
| Workspace lint                           | Zero errors; existing Material Master hook warning                                 |
| HeroUI scoped styles                     | Passed                                                                             |
| Changed-file Prettier and diff checks    | Passed                                                                             |
| Repository-wide Prettier                 | Existing 105-file baseline fails; unrelated work preserved                         |

New integration cases cover exact/partial patches, omitted sources, duplicates/no-op, canonical expense synchronization, Material/non-Material accounting, completed payment/net-receipt floors, schedules, PAID/VOID, dynamic grants/scope, ownership/revocation/staleness, rollback, concurrency/replay and lookup pagination. Normal tests never use the development database; live PostgreSQL suites require an explicit disposable URL.

## Follow-up: budget detail placement

The stored-bill review now follows the incumbent RAP pattern: budget details appear below changed fields in the main desktop pane and below those fields on mobile, while the right aside keeps the concise decision summary and actions. This supersedes the initial summary-contained budget detail placement. The shared procurement family reuses one GroupedSurface and plain FormDisclosure with 16px inner side padding and aligned FactRow values, preserving budget-view permission and disclosure state.

Live Browser checks verified both states at 320/360/390/430/1024/1280/1440px, keyboard toggling, state persistence across resize/reopening, no clipped monetary values or horizontal overflow, and normal viewport restoration. No business save was performed. Evidence: output/ai-chat-qa/vendor-bill-correction/budget-placement/viewport-checks.json and desktop/mobile screenshots. API/web/mobile typechecks, workspace lint and scoped formatting passed; global formatting still reports 104 unrelated files and lint has the existing Material Master hook warning. No finance/domain logic or shared motion primitives changed.
