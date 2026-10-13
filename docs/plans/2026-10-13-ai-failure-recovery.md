# AI failure recovery acceptance

## Scope

Exercise disconnected transport, a real provider deadline, expired proposals, source changes before confirmation, and restoration after refresh in the visible QA Browser at `127.0.0.1:3004`. Use the isolated synthetic database on port 32774. Preserve model/provider configuration, permissions, and all operational budget/cash/stock records.

## Method

- Capture business state before and after. Submit real chat messages through the Browser; do not inject assistant answers, proofs, or receipts.
- Disconnect the Browser transport temporarily and restore it before retry. Verify the question is retained and retry does not duplicate persisted user turns.
- Use a temporary QA-only fetch preload to stall the existing provider request until the real 45-second deadline. The guard requires the named disposable database, QA port, and non-pilot mode. Remove the preload afterward.
- Age only an actual assistant proposal in the new QA conversation to exercise the 30-day expiry. Change only the synthetic user's display name through an ordinary audited profile update to exercise stale source rejection; restore the original name.
- Refresh an interrupted conversation and a pending proposal, checking recoverable messages and explicit human confirmation.
- Fix confirmed defects with regression tests. Keep errors that block progress visible. Confirm retries preserve transaction identity.

## Acceptance

All five scenarios have Browser evidence. Recovery clears obsolete errors, preserves the conversation and draft, and never silently confirms a mutation. Cash, stock, and project budget snapshots stay identical. Temporary network/proxy overrides are removed, and the visible QA tab stays open for review.

## Result

Completed in `docs/guide/ai-failure-recovery-verification-2026-10-13.md`. Fixed silent deadlines, raw network errors, duplicate retry questions, pending-question restoration, and proposal/current-data confusion. Fresh profile/balance/inventory reads are sequenced before factual output; unverified answers are withheld from the stream and persistence. Rejected tool attempts remain visible, while the final factual answer matches the database.
