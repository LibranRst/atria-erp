# Dashboard Detail Tabs Compact Redesign

## Goal

Redesign the `/ledger` detail tabs so Approvals, Budget Risk, Cash Due, and Materials match the compact Ringkasan hierarchy while making tab switching feel instant.

## Direction

- Keep Ringkasan unchanged.
- Make each detail tab metric-first with slim KPI pills.
- Use clean titles outside compact white content cards.
- Use hybrid rows: approval mini cards, compact rows for Budget, Cash, and Materials.
- Switch tabs locally and update the URL with native history replace state instead of App Router navigation.

## Scope

- Keep the existing finance overview data shape and server actions.
- Do not add database migrations or backend fetches.
- Keep Owner-only approval actions unchanged.
- Preserve direct `/ledger?tab=...` URL support.

## Verification

- Run `npm run lint`.
- Run `npm run build`.
- Browser-check `/ledger` at 320, 390, and 430 px.
- Verify tab clicks update instantly and the URL changes without a page-like reload.
- Verify Owner approval actions still work and Finance Admin does not see the Owner-only tab.
