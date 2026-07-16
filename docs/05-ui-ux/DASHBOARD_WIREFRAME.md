# Dashboard and Project Overview Wireframe

The implemented Dashboard is one of the two current reference surfaces for `docs/05-ui-ux/MAIN_SURFACE_DESIGN_LANGUAGE.md`. This document defines Dashboard information architecture only; do not treat it as a generic page template.

The dashboard is a mobile-first financial decision surface. It must show company position and the next important work without behaving like a spreadsheet or hiding related information behind tabs.

## Dashboard Order

1. Financial position: cash available, open receivables, open payables, obligations due within seven days, active-project budget usage, remaining budget, and projected margin.
2. At most three role-ranked priorities.
3. At most three risky active projects.
4. Nearest due documents and material attention previews.
5. Three recent cash changes.

Portfolio budget values include `ACTIVE` projects only. Cash and open receivable/payable balances remain company-wide. Outstanding balances are invoice or bill value minus posted payments, with `VOID` records excluded.

Owner priorities approval and margin/project risk. Finance Admin priorities overdue payables, overdue receivables, and operational finance work. Material shortage remains supporting context after budget and finance risks.

AI CFO and generated financial briefing are deferred. Ringkasan must not reserve empty space or expose a briefing shortcut.

## Dashboard Detail Tabs

- Persetujuan is an Owner-only decision queue ranked by budget impact, due date, waiting age, and amount. Rejection requires a reason.
- Budget compares portfolio and project actuals against budget and target margin against projected margin.
- Jatuh Tempo groups open documents into Terlambat, Hari Ini, 7 Hari ke Depan, and Berikutnya using Asia/Jakarta calendar days.
- Rekening shows total cash, near-obligation coverage, account status, and recent reconciliation context; mutations remain in the account detail sheet.
- Material shows shortage/low-stock risk, receipt reversal requests, and recent waste/adjustment context without replacing Material & Stock.

## Compact Category Row

Each row shows category name, risk badge, remaining amount, used percentage, and a contextual usage indicator only when it improves the comparison. Full Budget, Actual, Pending, Paid, and Remaining values belong in project-level detail—not repeated on the owner dashboard.

## Project Overview Order

1. Compact project identity with client, project status, financial health, and a Detail bottom sheet.
2. One financial health card focused on remaining internal budget and used percentage.
3. Readiness cards for RAB, RAP, Material, and Tagihan.
4. At most three project blockers or actions.
5. Five compact category rows; tapping a row opens full financial detail and a contextual module action.

Static project profile information and long instructional workflow copy must not occupy the primary Overview flow.
