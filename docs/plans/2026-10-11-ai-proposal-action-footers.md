# Consistent AI proposal action footers

Extend the approved shared SheetFooterActions adaptive layout across catalog settings, finance inputs, procurement/warehouse, project/budget management, project stock, saved RAB workflow and vendor payment proposals. Reuse each family's existing footer for its inline card and retained FormSheet. Correction and commit share a row when intrinsic label widths fit, with identical control sizes; narrow mobile surfaces wrap and desktop review asides stay stacked. Preserve primary-first ordering in retained reviews, secondary-first ordering in inline decisions, pending/stale/permission guards, destructive styling, human confirmation and saved navigation/status copy.

Shared ConfirmationDialog receives an optional adaptive action layout; opt in from AI proposal families, including matching Material Master/RAP/RAB and expense decisions without changing manual dialog defaults. Expense draft Submit/Correction also reuses the adaptive pair while Apply stays separate. No new overlay or button primitive. Business behavior, writes and confirmation policy remain unchanged.

Audit existing matching footers and use the visible @Browser dev app for representative inline cards, retained sheets and protected dialogs at mobile320/360/390/430 and desktop1024/1280/1440. Check long/pending/disabled labels, focus and resize continuity without committing business operations. Run targeted safety/DOM tests, web typecheck/lint/build, document evidence and refresh graft.

## Complete

Seven families migrated, expense draft pair aligned, matching standard AI confirmations opt in, and supporting corrections/cancel controls use quiet tone. The visible dev app covers fourteen card examples, six retained review families and the protected vendor-payment dialog; business operations were not committed. See `docs/guide/ai-proposal-action-footers-verification-2026-10-11.md` and `output/ai-chat-qa/proposal-action-footers/`.
