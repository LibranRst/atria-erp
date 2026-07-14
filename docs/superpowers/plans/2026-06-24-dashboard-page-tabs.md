# Dashboard Page Tabs

## Goal

Turn `/ledger` into a top-level tabbed dashboard where each dashboard tab is a complete operational view: Ringkasan, Approvals, Budget Risk, Cash Due, and Materials.

## Implementation Notes

- Keep one shared dashboard header and place `SegmentedTabs` directly below it.
- Keep Ringkasan as the default first tab with the existing financial pulse, AI insight, priorities, risk preview, category health, and transactions.
- Move detailed approvals, budget risk, cash due, and material issue content into their own page-level tabs rather than nesting tabs inside a section.
- Reuse shared approval detail resolution and existing approval server actions.
- Add dashboard detail data additively; no database migration is required.

## Verification

- Unit test dashboard tab counts/defaults and detail shaping.
- Unit test approval detail mapping for project cost and vendor payment approvals.
- Run targeted finance tests, lint, production build, and mobile browser checks.
