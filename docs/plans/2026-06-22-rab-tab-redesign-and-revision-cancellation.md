# RAB Tab Redesign and Revision Cancellation

## Goal

Make the project RAB tab easy to scan on mobile, move editing into labeled bottom sheets, and allow an abandoned draft revision to be voided without changing the approved RAB, contract, budget, RAP, or packages.

## Delivery

1. Add auditable `VOID` metadata and a transactional revision-cancellation action.
2. Select the active RAB by workflow status instead of blindly choosing the largest revision number.
3. Rebuild the RAB tab around compact summary cards, concise item rows, and state-specific actions.
4. Move source selection, line editing, manual lines, bundles, Change Order processing, and cancellation into accessible bottom sheets with persistent labels.
5. Keep void revisions in history, exclude them from closing blockers, and verify the workflow with tests, static checks, build, and narrow viewport checks.

## Invariants

- Only a `DRAFT` RAB with `supersedes_rab_estimate_id` can be voided.
- Voiding a revision also cancels any linked non-approved Change Order in the same transaction.
- The current approved RAB and all financial/material baselines remain unchanged.
- Every cancellation records `void_reason`, `voided_at`, `voided_by_id`, and an `audit_log` entry.
- Revision numbering remains chronological; voided numbers are never reused.
- Client-facing RAB surfaces never expose internal costs, margins, vendor notes, or stock details.

## Verification

- Test active-RAB selection, revision numbering, validation, cancellation guards, linked Change Order cancellation, and closing behavior.
- Run RAB/workflow tests, ESLint, TypeScript, and production build.
- Check the RAB tab at 320px, 390px, and 430px with keyboard/focus behavior and no horizontal overflow.
