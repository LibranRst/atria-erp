# Reconciliation Workspace Readable Redesign

## Goal

Rework the reconciliation workspace into a calm, readable mobile workflow across 320–430 px without changing finance semantics or Server Action contracts.

## Confirmed direction

- Use comfortable 96–112 px rows with up to two lines for the primary description.
- Place the exact monetary value on its own stable line so it never competes with a chevron.
- Use a hybrid list: records requiring a decision become independent cards, while passive records and history stay on one grouped white surface with dividers.
- Give Mutasi Bank, Catatan Atria, and Riwayat a shared visual grammar but tailor their information hierarchy.
- Preview both sides of a completed match in Riwayat.
- Rebuild detail sheets around a focal amount, stacked Atria/bank evidence, and a clear review-to-confirm flow.
- Preselect a single strong suggested match while retaining an explicit way to choose another candidate.
- Limit icons and semantic color to direction, confirmed state, and warnings.
- Follow the Dashboard/Cash Ledger as the closest visual reference.

## Implementation

1. Extract purpose-built reconciliation row primitives and remove the competing icon/value/chevron layout.
2. Give every row a two-level reading order: identity/context first, then direction/status plus exact amount.
3. Present history as an Atria-to-bank pair preview rather than a generic completed transaction.
4. Redesign match and history sheets with a focal summary and stacked grouped evidence sections.
5. Simplify import, manual-entry, and exception sheets so helper copy is contextual and supporting information is progressively disclosed.
6. Align the structural loading state with the new page and row hierarchy.

## Motion decision

No new decorative motion. Keep the existing `SegmentedTabs` selection pill, standard sheet/backdrop transitions, and existing reduced-motion-aware tap feedback only.

## Verification

- Run focused reconciliation/component tests, TypeScript, lint, and production build.
- Browser-check Mutasi Bank, Catatan Atria, Riwayat, match sheet, history sheet, import sheet, manual-entry sheet, and exception sheet at 320, 375, and 430 px.
- Confirm primary amounts do not wrap or clip and changing tabs does not move the document vertically.
