# Compact Operational Form Remake V4

## Intent

- Replace the V3 guided-dashboard feel with compact mobile operational forms.
- Keep business logic, Server Actions, schemas, RBAC, finance ledger behavior, and material stock mutations unchanged.
- Preserve 48px rounded input tap targets while reducing wrapper noise, stacked helper copy, preview grids, and status panels.

## UI Rules

- No progress meters, completion percentages, grid preview cards, stacked status panels, or always-visible dashboard summaries inside forms.
- Each sheet may show one thin micro status dock above submit with at most three signals.
- Form bodies use plain sections, short labels, and field-level context lines. Avoid background cards unless the item is repeated or destructive.
- Smart defaults are indicated with a tiny text line only when a safe default was actually applied.
- Comparisons use compact text patterns such as `Before -> After`, `Budget left -> Subtotal`, or `Available -> Qty`.
- Warnings are one-line and local to the risk, except destructive stock/finance actions that may keep a confirmation sheet.
