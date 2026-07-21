# Dashboard Detail Tabs Taste Refinement

## Goal

Refine the `/ledger` detail tabs after the compact redesign so the UI feels less generated, more operational, and more consistent with the approved Ringkasan hierarchy.

## Direction

- Keep Ringkasan unchanged.
- Keep instant tab switching with local state and `window.history.replaceState`.
- Replace separate KPI cards with one compact white inline summary strip.
- Keep section titles outside white content cards.
- Make detail cards use clean list spacing with flat rows and subtle dividers.
- Replace heavy approval mini cards, especially Vendor Payment rows, with compact decision rows.
- Move heavier budget context from approval rows into the approval detail bottom sheet.

## Scope

- Only update dashboard detail tab presentation in `components/dashboard/finance-dashboard.tsx`.
- Preserve approval server actions, local removal after success, URL tab support, and role behavior.
- Do not change data shape, database schema, or unrelated dashboard sections.

## Verification

- Run `npm run lint`.
- Run `npm run build`.
- Browser-check `/ledger` at 320, 390, and 430 px.
- Verify tab switching remains instant and URL updates without page navigation feel.
- Verify Owner approval actions still open confirmation and Finance Admin does not see Owner-only actions.
