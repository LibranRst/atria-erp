# Roadmap - Project Budget Finance & Material Control ERP

## Phase 0: Preserve and Stabilize

- Keep existing auth, RBAC, ledger, project budget, expenses, vendor bills, approvals, AI OCR, and mobile shell.
- Fix lint/type debt so future work starts from a clean baseline.

## Phase 1: Documentation Source of Truth

- Update PRD, MVP blueprint, flows, schema docs, enums, UI guide, auth/permissions, API actions, AI architecture, roadmap, task breakdown, implementation order, README, and agent instructions.
- Remove obsolete claims that inventory is out of scope.
- Align terminology: Project Budget, RAP, and RAB.
- Re-center the source of truth on Project Budget Control upgraded with material stock visibility. Workbook logic remains background source material only.

## Phase 2: Canonical Budget Data Model

- Add `expense_category`, `project_budgets`, `project_budget_categories`, `project_expenses`, and `project_profitability_snapshots`.
- Add Settings tables for Budget Allocation defaults and Item & Price Library.
- Seed budget defaults: 90% internal budget cap, Tukang 18%, Material 35%, Operasional 1%, Lain-lain 0.5%, Gross remainder, Subcon optional.
- Backfill canonical rows from legacy budget/cost tables while preserving compatibility.

## Phase 3: Material Data Model

- Add material category, material master, inventory location, material inventory, RAP, RAP item, stock movement, RAB estimate, and RAB estimate item tables.
- Extend project expenses and vendor bills with optional material/RAP/stock links.
- Add Tukang Work Package and Subcon Package planning as lightweight non-material detail linked to matching expenses, vendor bills, and quotation source rows.
- Add seed/demo data for realistic project material workflows.

## Phase 4: Budget Dashboard and Category Actions

- Add Zod-validated actions for budget setup from ratios, category override, approval, recalculation, project dashboard, and owner dashboard.
- Add category risk status calculation: SAFE, WATCH, CRITICAL, OVER_BUDGET.
- Move dashboard and project detail reads toward canonical category budget cards.

## Phase 5: Material-Control Actions

- Add validations, permissions, and Server Actions for material master, inventory read model, stock in, reserve, use, return, adjustment, shortage, RAP, and RAB estimate generation.
- All stock-changing actions run in transactions and write audit logs.

## Phase 6: UX Screens

- Add dedicated `/settings` for Budget Allocation, Expense Categories, Item & Price Library, and Material Master.
- Add Project Budget Setup and Category Budget Cards before material drill-down.
- Add mobile-first Materials, Inventory, Material Detail, Stock Movement, Stock In, Reserve, Use, Leftover, Need to Buy, RAP, and RAB Estimate screens.
- Add Project Detail package cards for Tukang Work Packages and Subcon Packages, plus selected-source quotation generation.
- Update Owner Dashboard and Project Detail to show finance/material health.
- Keep expense entry fast and progressive.

## Phase 7: AI Finance & Material Brief

- Deferred until the core Dashboard and operational modules are stable. No AI CFO surface or financial-briefing pipeline is active in the current release.

## Phase 8: Verification and Release

- Add tests for permissions, stock math, RAP shortage math, client-safe RAB projection, dashboard aggregates, and existing finance regressions.
- Run lint, targeted tests, build, seed verification, and mobile browser smoke checks.
