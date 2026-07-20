# Approval Page Dashboard-Language Rework

## Goal

Bring `/approvals` into the active Dashboard/Expenses main-surface design language without changing approval permissions, finance rules, server actions, or audit behavior.

## Audit

- The page header owns a static queue badge, so its count becomes stale after a successful decision.
- Search and filters sit inside an oversized sticky card and use a legacy tab pattern.
- Every approval is rendered as a separate card, weakening grouping and increasing vertical density.
- The full page does not use the same ranked decision context, before/after budget comparison, approval confirmation, and required rejection reason already present in the Dashboard approval flow.
- Route loading uses a generic loader rather than matching the page hierarchy.

## Implementation

1. Keep the existing Owner-only route guard and load the same pending approval DTOs, ranked by the existing risk/urgency function.
2. Move live queue totals into a compact summary surface owned by `ApprovalList` so optimistic removal updates count, critical total, and nominal immediately.
3. Replace the legacy filter card with compact search plus shared `SegmentedTabs`, preserving reading position during filter changes.
4. Render time groups as section headers and grouped row surfaces with internal dividers instead of one card per approval.
5. Keep detail in a `rounded-t-[28px]` bottom sheet, reuse the Dashboard before/after budget context, and expose project, requester, category, due date, notes, and receipt progressively.
6. Require confirmation before approval. Require a minimum five-character reason before rejection and pass it unchanged to the existing server action audit note.
7. Keep the item and typed rejection reason on failed actions; remove successful items from the live queue, update totals, then close the decision surfaces.
8. Replace the generic route loader with a page-specific header, summary, filter, and grouped-row skeleton.
9. Add focused component coverage for the live summary, grouped queue, critical reason, and empty state.
10. Rework the approval detail drawer into a decision-review composition: one compact financial focal surface, a grouped request-context ledger, a dedicated before/after budget impact surface, and a fixed sheet footer for approve/reject. Keep receipt access progressive and preserve all mutation behavior.
11. Let the four approval filters fill spare segmented-control width when their intrinsic labels fit, while retaining horizontal overflow and active-item auto-centering when the available width is smaller.

## Verification

- Verify Owner access and restricted non-Owner state.
- Verify filters, search, detail sheet, confirmation, required rejection reason, success removal, and failed-action preservation.
- Check 320, 360, 390, and 430 px for amount wrapping, overflow, touch targets, bottom-sheet clearance, and stable filter position.
- Run focused tests, TypeScript, ESLint, the full Bun test suite, production build, and browser console checks in proportion to the change.
