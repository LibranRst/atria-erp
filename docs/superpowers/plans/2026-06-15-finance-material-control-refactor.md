# Finance & Material Control Refactor Plan

## Summary
Atria ERP will be refactored from a finance-first project budget app into Dekoria's Project Finance & Material Control System. The existing finance, auth, approval, ledger, project budget, expense, vendor bill, mobile shell, and AI OCR foundations must be preserved. New work must add material planning, stock visibility, stock movement, RAP internal planning, client-safe RAB estimates, and owner-readable material/finance dashboards.

## Current State
- The app already has Better Auth, RBAC, project scoping, Drizzle schema, project budgets, project costs, vendor bills, client payments, cash ledger, audit logs, AI receipt parsing, AI daily briefing, mobile shell, bottom navigation, and demo seed data.
- The docs currently conflict with the new direction because inventory is marked out of MVP scope, `field_request` is still referenced in older docs, and RAB is used for both internal budget and client estimate.
- Existing tests pass for finance/auth/AI flows, but lint currently fails because of pre-existing `any`, hook purity/order, unused import, and string escaping issues.
- The worktree already contains unrelated dirty state around the middleware-to-proxy migration. Do not revert those changes unless the user explicitly asks.

## Product Direction
- Core workflow: Project Budget -> RAP / Material Plan -> Inventory Check -> Purchase Need -> Expense / Vendor Bill -> Stock Movement -> Budget / Margin Dashboard.
- The app is not a full accounting system, a generic project manager, or a warehouse-heavy inventory suite.
- Owner value: open the app and understand budget condition, actual cost, remaining budget, material budget used, material shortage, leftover stock, reusable stock, vendor bills due, and margin risk within 30 seconds.
- Finance/admin value: create budgets, input expenses, connect costs to RAP/material/stock movement when relevant, track paid/unpaid vendor bills, and upload proof.
- Purchasing/material value: see needs per project, reserve stock, record stock in/out/use/return/waste/adjustment, and identify shortage or reusable leftover.
- Project team value: see material readiness for their projects without manual chat follow-up.

## Terminology Decisions
- Project Budget: high-level internal budget split by category, preserving the familiar Excel workflow.
- RAP: internal execution/material plan and locked cost baseline. RAP can link to material master and stock.
- RAB: client-facing estimate/proposal. It can be generated from RAP but must be editable, bundleable, hideable, renameable, roundable, discountable, and revisioned.
- Internal cost, internal margin, markup, vendor notes, and internal notes must never appear in client-facing RAB preview.
- `project_cost` remains the implemented table for field expenses. New docs must not describe a non-existent `field_request` table.

## Implementation Order
1. Update source-of-truth docs and this implementation plan.
2. Fix lint/type debt without changing business behavior.
3. Add Drizzle schema and seed data for material category, material master, inventory location, material inventory, RAP, RAP item, stock movement, RAB estimate, and RAB estimate item.
4. Extend permissions and Zod validations for material, RAP, inventory, stock movement, and RAB estimate actions.
5. Add material-control Server Actions with transaction and audit logging for stock-changing operations.
6. Extend expense and vendor bill flows with optional material, RAP item, and stock movement links.
7. Add mobile-first Material, Inventory, RAP, Need to Buy, Stock Movement, and client-safe RAB screens.
8. Expand Owner Dashboard and AI Finance & Material Brief.
9. Add tests for permissions, stock math, client-safe RAB output, dashboard aggregates, and existing finance regressions.
10. Run lint, targeted tests, build, seed verification, and mobile browser smoke test.

## Data Model Scope
- Add `material_category`, `material_master`, `inventory_location`, `material_inventory`.
- Add `project_rap`, `project_rap_item`.
- Add `stock_movement` with movement types `STOCK_IN`, `STOCK_OUT`, `RESERVE`, `USE`, `RETURN`, `TRANSFER`, `ADJUSTMENT`, and `WASTE`.
- Add `rab_estimate`, `rab_estimate_item`.
- Extend `project_cost` and `vendor_bill` with optional links to material, RAP item, and stock movement.

## UX Scope
- Owner Dashboard focuses on finance/material condition and urgent actions.
- Project Detail gains sections for Budget, RAP/Material Plan, Inventory Status, Expenses/Bills, Profitability, and RAB Estimate.
- Material area includes Material Master, Inventory, Material Detail, Movement History, Stock In, Reserve, Use, Leftover/Return, and Need to Buy.
- Forms stay progressive: non-material expenses remain quick, and material/RAP links are optional when not relevant.

## Guardrails
- No blind rewrite and no deletion of useful existing modules.
- No raw SQL in app code.
- No automatic money movement or important material mutation from AI without explicit user action.
- No mutation of reconciled ledger transactions.
- Stock-changing actions must run in a database transaction and write audit logs.
- RAB preview must be client-safe and hide internal cost/margin fields.

## Verification
- Preserve current passing finance/auth/AI tests.
- Add focused tests for material permissions, stock movement calculations, RAP shortage math, and RAB client-safe projection.
- Run `bun run lint`, targeted `bun test`, `bun run build`, seed verification, and mobile browser smoke test before declaring a slice complete.
