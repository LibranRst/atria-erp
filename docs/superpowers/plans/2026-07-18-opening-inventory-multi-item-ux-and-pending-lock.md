# Opening Inventory Multi-item UX and Pending Lock

Date: 18 July 2026

## Objective

Make the opening-stock workflow clearly support one batch with multiple physical-stock items, while preventing the same material/location inventory from being submitted into more than one pending opening batch.

## Implementation

1. Treat `PENDING_APPROVAL` opening items as ineligible in candidate reads and explain the reason in Bahasa Indonesia.
2. Recheck inventory state and pending-batch membership inside the create transaction while locking inventory rows in a deterministic order, so direct or concurrent submissions cannot bypass the UI.
3. Recompose the manual item builder around a clear batch-level explanation, selected/eligible progress, accessible add/remove actions, per-item subtotal, and explicit all-selected state.
4. Keep CSV import as the efficient multi-item path and preserve maker-checker, audit logging, and the rule that submission does not change stock until approval.
5. Add regression tests for candidate eligibility and pending conflict where the current test seams permit; otherwise cover the extracted decision helper and validation contract.
6. Recompose the opening-batch detail drawer with a stable batch identity, grouped document facts, real item rows, audit/source context, explicit runtime-state notices, and a separated reversal flow.
7. Carry the full opening-item facts into the approval read model and show material, location, physical quantity/unit, unit cost, and subtotal in both approval drawers before the checker decides.

## UI Contract

- Information hierarchy: batch source, physical-stock items, opening inventory value, approval consequence.
- Surfaces: grouped source fields, one grouped item surface per independently editable inventory row, one focal total-value surface, inline restricted/pending states.
- States: empty prerequisites, one/many eligible items, all selected, duplicate selection, pending submission, CSV preview errors, submit success/failure.
- Detail drawer states: pending, posted, rejected, reversed, reversible, restricted reversal, and missing item detail.
- Approval review: one grouped item surface with dividers; every row exposes quantity/unit and unit cost rather than only the aggregate batch value.
- Accessibility: explicit button labels, 48px targets, visible validation reasons, keyboard-compatible selectors and actions.
- Motion: existing sheet transition and `transitionSpringSnappy` tap feedback only; row addition/removal and mode content remain instant.

## Verification

- TypeScript and relevant material tests.
- Manual UI verification at 320, 360, 390, and 430 px for one eligible item, several eligible items, all selected, pending candidate, and validation error states.
- Confirm one batch persists several items, a pending inventory cannot be resubmitted, and no stock changes before approval.
