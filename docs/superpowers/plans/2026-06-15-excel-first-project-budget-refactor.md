# Excel-First Project Budget Refactor

## Goal
Atria ERP must preserve Dekoria's familiar Excel workflow and upgrade it into a real ERP with material stock visibility. The primary product spine is:

`Project Budget Setup -> Expense Tracker by Category -> Budget Dashboard -> Category Usage -> Remaining Budget -> Margin Visibility -> Material Detail & Stock Control`

Material control is an improvement layer connected to the Material budget category. It must not replace Tukang, Operasional, Lain-lain, Subcon, or gross/margin visibility.

## Source Workbook Findings
- `Project Budget.xlsx` uses `Settings -> Expense Tracker -> Dashboard` as the operating flow.
- Expense categories are Tukang, Material, Operasional, Lain-lain, and Subcon.
- Default ratio row uses internal budget as 90% of project value, then Tukang 18%, Material 35%, Operasional 1%, Lain-lain 0.5%, with Gross as the remainder.
- `Estimasi (Master).xlsx` supports the RAB/RAP split: client estimate/proposal, SPK/jasa, material procurement, and setting-driven unit pricing.

## Implementation Order
1. Update docs so the Excel-first budget workflow is the source of truth.
2. Add canonical budget tables while preserving legacy `project_budget`, `project_budget_item`, and `project_cost`.
3. Seed canonical expense categories and Excel default ratios.
4. Add read actions for project and owner budget dashboards.
5. Add mobile category budget cards to Owner Dashboard and Project Detail.
6. Extend AI brief to analyze category usage before material shortage details.
7. Add tests for ratios, category status thresholds, dashboard aggregation, and material-only linkage rules.

## Data Model Direction
- `project_budgets`: canonical project budget setup and approved/internal budget snapshot.
- `expense_categories`: canonical categories: Material, Tukang, Operasional, Lain-lain, Subcon.
- `project_budget_categories`: allocation, actual spend, remaining, used percentage, and risk status per category.
- `project_expenses`: canonical expense tracker record, initially compatible with `project_cost`.
- `project_profitability_snapshots`: dashboard read model for budget, actual, remaining, category usage, material stock impact, and margin risk.

Legacy tables remain during the first migration so existing expense, vendor bill, approval, payment, ledger, and UI flows keep working while reads move to the canonical model.

## Guardrails
- Do not delete or rewrite existing finance flows blindly.
- Material/RAP/stock links are allowed only for Material category expenses.
- Non-material expense input must remain fast: category, amount, description, vendor/receipt/payment context.
- AI can summarize category and material risks, but cannot mutate finance or stock data without explicit user approval.
