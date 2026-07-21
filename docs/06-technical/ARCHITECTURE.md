# Architecture

## Shape

Atria ERP uses Next.js App Router with Server Components for data-heavy views, Client Components for interactive mobile forms, Drizzle ORM for PostgreSQL access, Better Auth for sessions, and Server Actions for mutations.

## Domain Layers

- Auth and permissions: `lib/auth/*`
- Database schema and seed data: `db/*`
- Budget helpers and Settings-backed defaults: `lib/budget/*`, `app/actions/settings/*`
- Finance transaction helpers: `lib/finance/*`
- Validations: `lib/validations/*`
- Server Actions: `app/actions/*`
- Mobile UI: `app/*` and `components/*`
- AI integration: `lib/ai/*` and `app/actions/ai/*`

## Existing Finance Spine

The ledger, bank account balance mutation helper, project budget, project costs, vendor bills, client payments, approvals, and audit logs are the foundation. Material-control features must integrate with this spine instead of replacing it.

## Settings Layer

Settings is the source of truth for defaults and master data:

- `budget_allocation_setting`
- `budget_allocation_setting_category`
- `expense_category`
- `item_price_library`
- Material Master and inventory defaults

Project Budget creation reads the active Budget Allocation Setting. Existing project budgets keep their own saved allocation unless edited directly.

## Canonical Budget Layer

The canonical budget layer models Dekoria's Project Budget Control workflow:

- `expense_category`
- `project_budgets`
- `project_budget_category`
- `project_expenses`
- `project_profitability_snapshot`

This layer powers Project Budget Setup, Expense Tracker by Category, Budget Dashboard, Category Usage, Remaining Budget, and Margin Visibility. Legacy `project_budget`, `project_budget_item`, and `project_cost` remain during migration so existing finance flows continue to work.

## Material-Control Extension

Material-control data adds:

- Material Master and categories.
- Inventory locations and stock balances.
- RAP internal material plan.
- Stock movements.
- Client-safe RAB estimates.

Stock movement is operational inventory state attached to the Material budget category. It does not replace category budget tracking or finance ledger entries. Finance cash movement remains in `cash_transaction`.

## Mutation Rules

- Finance balance changes use `mutateBalance`.
- Stock changes use dedicated material actions that update inventory, insert movement rows, and write audit logs inside one transaction.
- Expense/vendor bill flows must link to a budget category. They can optionally link to material, RAP item, and stock movement only when the category is Material.

## Client Safety

RAB estimate preview must be generated from a DTO that excludes internal cost, margin, markup, vendor note, and internal note.
