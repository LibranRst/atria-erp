# Page & Workflow Audit — 18 June 2026

## Shipped in this overhaul

- Settings Library: cost components, provenance, effective date, margin-derived price, vendor/material context, mobile bottom sheet.
- Project RAP/RAB: Library snapshot picker, immutable approved RAB, source refresh, RAP revision, formal Change Order approval, mobile-only layout.
- Project Profitability: Projected Margin and Cash Position are no longer presented as the same metric; closing checklist/final snapshot controls are available.
- Payments: one-click client invoice schedule 30/35/25/10 plus existing manual invoice/payment flow.
- Materials: Goods Receipt UI separated from vendor payment.
- Expenses/Payments drawers: removed viewport breakpoints that created desktop arrangements inside the fixed mobile shell.
- Entire `app/` and `components/` TSX surface now has no `sm:`, `md:`, `lg:`, or `xl:` layout variants.

## Route audit

| Route            | Workflow assessment                                                                                                                                          | Follow-up                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `/`              | Owner budget overview remains the correct first screen.                                                                                                      | P1: add explicit realized-vs-cash legend when final snapshots exist.                                              |
| `/projects`      | Current mobile list/create flow is consistent.                                                                                                               | P2: add filter for closing blockers.                                                                              |
| `/projects/[id]` | P0 integrity fixed for Library snapshots, revisions, Change Order, stock cost, invoice schedule, and closing.                                                | P1: dedicated Change Order history and category-plan revision UI; P1 stock-operation history grouped by RAP item. |
| `/expenses`      | Finance spine remains useful; fixed mobile sheets.                                                                                                           | P1: multi-line vendor bill with document upload and Goods Receipt status chip.                                    |
| `/expenses/new`  | Fast non-material entry preserved; Material drill-down remains optional.                                                                                     | P1: delay stock mutation until Finance verification or expose pending movement state.                             |
| `/materials`     | Mobile operational control center: grouped inventory, shortage, history, Goods Receipt, project operations, transfer, opname approval, and receipt reversal. | P2: add barcode scanning when physical warehouse hardware is selected.                                            |
| `/approvals`     | Existing owner approval remains useful.                                                                                                                      | P1: add Change Order approval cards/history when approval is not completed inline.                                |
| `/ledger`        | Correctly remains cash ledger, not profitability.                                                                                                            | P2: filters for project/reference and stock-cost explainer link.                                                  |
| `/settings/*`    | Mobile-first source-of-truth workspace; Library provenance implemented.                                                                                      | P1: template version history and vendor quote attachment.                                                         |
| `/profile`       | No finance-integrity blocker found.                                                                                                                          | P3 visual polish only.                                                                                            |
| `/login`         | No workflow gap found.                                                                                                                                       | P3 visual polish only.                                                                                            |

## Remaining risks

1. Waste uses the generic adjustment path; a dedicated project-linked Waste action/UI should create canonical non-cash cost explicitly.
2. Field direct-use currently mutates stock at submit time in the compatibility path. Preferred next change: pending movement until Finance verification.
3. Goods Receipt currently posts immediately; void requires an audited reversal action before production rollout.
4. Change Order UI completes create → client confirmation → internal approval in one guided Owner/Finance action. A separate pending-client/pending-approval inbox is recommended for larger teams.
5. Closing reservation check uses project movement totals. A future `project_stock_reservation` balance table would make partial reservation release more precise.

## Recommended next design phase

1. Vendor bill document UX and pending stock movement verification.
2. Barcode/label support after warehouse hardware selection.
3. Change Order history/inbox and package-revision bottom sheet.
4. Owner dashboard final-snapshot portfolio metrics.
