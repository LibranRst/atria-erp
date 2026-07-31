# Approval Queue Pagination Health

## Goal

Make the Approval page's visible counts, grouping, and load-more behavior accurately describe the ranked queue while preserving its current decision-first mobile composition.

## Scope

- Keep one full server-resolved approval queue as the source for summary and filter counts.
- Use one deterministic reference time for ranking, waiting-age summary, and age grouping.
- Paginate the filtered ranked queue in batches of 20.
- Always show the complete `Hari ini` group; apply the 20-item window only to older groups.
- Show the exact number that the next load-more action will reveal.
- Show each section's full count as a neutral pill at the right edge of its header.
- Reconcile client queue state when refreshed server data changes.
- Do not retain an artificial results height while sticky controls are disabled.
- Add focused regression tests for pagination boundaries and group counts.

## UI Contract

- Hierarchy remains summary, filter/search, grouped decision rows, then one load-more action.
- Approval rows remain grouped operational decision rows; no new card or tonal treatment is introduced.
- Empty and filtered-empty states retain their existing footprint and actions.
- Load-more remains a 48px capsule control with an explicit accessible label.
- Motion: no new animation; filters and pagination update instantly, while existing sheet transitions remain unchanged.

## Verification

- Test queues with 0, 1, 20, 21, 23, and 40+ filtered items.
- Confirm the button reports `min(20, remaining)` rather than a fixed 20.
- Confirm `Hari ini` is never truncated, even when it exceeds 20 items.
- Confirm section counts render as neutral pills rather than title suffixes.
- Run Approval tests, TypeScript, focused ESLint, formatting, and `git diff --check`.
