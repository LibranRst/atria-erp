# Implementation Order

## 1. Documentation First
Create the implementation plan and update all product/technical docs before executable changes. The current approved plan is:

`docs/superpowers/plans/2026-06-16-settings-source-of-truth.md`

## 2. Add Settings and Canonical Budget Model
Add Drizzle schema, relations, migrations, and seed data for:
- budget allocation settings;
- item price library;
- expense category;
- project budgets;
- project budget categories;
- project expenses;
- project profitability snapshots.

Preserve legacy `project_budget`, `project_budget_item`, and `project_cost` during migration.

## 3. Add Budget Actions and Read Models
Implement Zod-validated, RBAC-protected actions for:
- project budget setup from active Settings ratios;
- category allocation override;
- budget approval;
- category recalculation;
- project budget dashboard;
- owner budget dashboard.

## 4. Add Material Data Model
Add Drizzle schema, relations, migrations, and seed data for:
- material category/master;
- inventory location/inventory;
- project RAP/RAP item;
- Tukang/Subcon category plan item;
- stock movement;
- client-facing RAB estimate/item;
- optional project cost/vendor bill links.

## 5. Add Material Server Actions
Implement Zod-validated, RBAC-protected actions for material, inventory, stock movement, RAP, and RAB. Stock-changing actions must run in transactions and write audit logs.

## 6. Extend Existing Workflows
Add project budget category links to expenses and vendor bills. Add optional material/RAP/stock movement links only for Material expenses. Add optional Tukang/Subcon package links only for matching categories. Keep Operasional and Lain-lain quick.

## 7. Build Mobile UX
Add `/settings`, category budget cards to Owner Dashboard and Project Detail before material drill-down. Add material and project-control screens using existing mobile shell/card patterns. Avoid dense tables on mobile.

## 8. Expand AI Brief
Deferred. Preserve OCR and historical AI data, but do not expose or run AI CFO briefing in the current Dashboard release.

## 9. Verify
Run:
```bash
bun run lint
bunx tsc --noEmit
bun test lib/auth/permissions.test.ts lib/finance/actions.test.ts lib/finance/actions-field.test.ts lib/finance/dashboard.test.ts lib/finance/ocr-form.test.ts lib/ai/gemini.test.ts
bun run build
```

Then seed and smoke test the main mobile flows.
