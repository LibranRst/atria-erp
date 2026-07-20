# Material Operational Forms — Vertical Slice V1

## Intent

- Apply the stable form foundation from Expense to stock-changing material workflows.
- Make every irreversible stock mutation explicit through input, impact review, posting, and durable success states.
- Preserve the existing transactional Server Actions, RBAC, project scoping, stock movement records, audit logs, and reversal-only correction model.

## Audit Findings

- Goods Receipt posts directly from a long open editor, uses mixed-language copy, and does not show stock before/after before posting.
- Project reserve/use/return/waste uses generic English operation labels and executes from the input screen without a complete review state.
- Transfer and emergency adjustment show all line item inputs at once and do not compare source/destination stock before posting.
- Stock opname already has the correct business `DRAFT` entity, but the UI immediately saves and submits it, so users cannot intentionally preserve or resume that draft.
- Success feedback is currently a toast plus auto-close; users do not receive an operational summary or clear next action.

## Scope

- Goods Receipt: compact stable-ID rows, contextual item editor, before/after stock preview, explicit review, posting success, and unsaved-change protection.
- Project operations: Indonesian operation choices, quantity impact preview, review-before-post, and durable success.
- Transfer: compact rows, source/destination before/after comparison, duplicate prevention feedback, review-before-post, and durable success.
- Emergency adjustment: explicit direction choices, before/after/reserved guard preview, review-before-post, and durable success.
- Stock opname: variance-first rows, explicit `Simpan Draft` and `Kirim untuk Persetujuan`, resume of existing business drafts, and review before submission.

## Safety Rules

- No stock, finance, budget, or cash mutation occurs while editing or reviewing a form.
- Goods Receipt, transfer, project operations, adjustment, approval, and reversal continue through their existing transactional Server Actions.
- Posted receipts and stock movements remain immutable; correction uses the existing reversal and approval path.
- Stock opname may be edited only while its business status is `DRAFT`; approval revalidates its stock snapshot.
- Emergency adjustment remains Owner-only and always requires an audit note.

## Acceptance Gate

- Every final stock mutation has a review state with location, quantity, and before/after impact.
- Compact line rows reveal incomplete entries without opening every item.
- Stock opname can be saved as a draft and resumed before submission.
- All primary actions state their result in Bahasa Indonesia.
- Posted records are never exposed as editable forms.
- TypeScript strict, lint, relevant tests, production build, and 320/390/430px browser checks pass.

## Implementation Record — 2026-07-13

- Goods Receipt now uses stable compact rows, contextual item editing, project-change protection, stock before/after review, explicit posting copy, reversal guidance, and a durable success state.
- Project reserve/use/return/waste, stock transfer, and Owner-only emergency adjustment now require impact review before their existing transactional actions are called.
- Stock opname now exposes its canonical business `DRAFT`: users can save, resume, discard, or submit it intentionally, while only the creator can update or submit a draft.
- Shared material form patterns provide stock impact comparisons, three-choice unsaved handling, and success summaries without timeout-based closing.
- Material operational entry points and migrated form copy are aligned to concise Bahasa Indonesia.
- Verification passed: TypeScript strict, ESLint, production build, 119 tests / 413 assertions, and real-browser checks at 320, 390, and 430 px. Browser QA did not call a final posting action and created no material, stock, finance, or audit records.
- Browser artifacts are stored under `output/playwright/` for Goods Receipt, stock opname, transfer, emergency adjustment, and project reservation states.
