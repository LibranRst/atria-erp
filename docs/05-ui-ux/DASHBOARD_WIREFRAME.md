# Dashboard and Project Overview Wireframe

The dashboard is a mobile-first financial decision surface. It must show company position and the next important work without behaving like a spreadsheet or hiding related information behind tabs.

## Dashboard Order

1. Financial pulse: cash available, open receivables, open payables, active-project budget usage, remaining budget, and projected margin.
2. Contextual AI insight when a useful completed briefing exists.
3. At most three role-ranked priorities.
4. At most three risky active projects.
5. Five compact category health rows.
6. Five recent cash transactions.

Portfolio budget values include `ACTIVE` projects only. Cash and open receivable/payable balances remain company-wide. Outstanding balances are invoice or bill value minus posted payments, with `VOID` records excluded.

Owner priorities approval and margin/project risk. Finance Admin priorities overdue payables, overdue receivables, and operational finance work. Material shortage remains supporting context after budget and finance risks.

## Compact Category Row

Each row shows category name, risk badge, remaining amount, used percentage, and a progress bar. Full Budget, Actual, Pending, Paid, and Remaining values belong in project-level detail—not repeated on the owner dashboard.

## Project Overview Order

1. Compact project identity with client, project status, financial health, and a Detail bottom sheet.
2. One financial health card focused on remaining internal budget and used percentage.
3. Readiness cards for RAB, RAP, Material, and Tagihan.
4. At most three project blockers or actions.
5. Five compact category rows; tapping a row opens full financial detail and a contextual module action.

Static project profile information and long instructional workflow copy must not occupy the primary Overview flow.
