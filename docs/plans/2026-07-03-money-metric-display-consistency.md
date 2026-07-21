# Money Metric Display Consistency

## Summary

- Add reusable money presentation primitives for metric/card values.
- Multi-metric grids keep compact Rupiah as the primary value and show the full Rupiah value underneath.
- Full-width money cards show only the full Rupiah value with dynamic container-based sizing.

## Implementation

- Extend `components/ui/page-primitives.tsx` with `MoneyValue` and `MoneyMetricPill`.
- Add dynamic money CSS helpers in `app/globals.css`.
- Migrate money metrics in expenses, project list/detail, finance dashboard, invoices, profitability, closing, and settings card surfaces.
- Leave form values, list rows, toast messages, and mixed narrative money text unchanged.

## Verification

- Run `npm run lint`.
- Run `npm run build`.
- Visually check `/expenses`, `/ledger`, `/projects`, a project detail page, and settings pages where practical.
