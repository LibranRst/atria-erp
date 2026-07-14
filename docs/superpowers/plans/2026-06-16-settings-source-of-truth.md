# Settings Source of Truth Implementation Plan

## Summary
- Add a dedicated `/settings` area for Owner/Admin workflows.
- Settings is the source of truth for Budget Allocation defaults, Expense Categories, Item & Price Library, and Material Master settings.
- Project Budget creation reads the active Budget Allocation Setting. Existing project-level category overrides remain unchanged.
- `/materials` remains the daily operational stock screen; Settings manages master/default data.

## Implemented Scope
- Added structured tables:
  - `budget_allocation_setting`
  - `budget_allocation_setting_category`
  - `item_price_library`
- Added Settings RBAC:
  - `view:settings`
  - `manage:budget_settings`
  - `manage:expense_categories`
  - `manage:item_library`
  - `manage:material_settings`
- Added Settings server actions and Zod validations.
- Added `/settings` mobile-first UI with Budget Allocation, Expense Categories, Item & Price Library, and Material Master sections.
- Connected `createProjectBudgetFromRatios` to the active Budget Allocation Setting with old constants as fallback.
- Seeded default Budget Allocation and reusable item library data.

## Product Rules
- User-facing screens should say Project Budget, Budget Allocation, Expense Categories, Item & Price Library, Material Master, and Budget Control.
- Workbook logic is source material for ratios and habits only; screens must not be labeled as Excel.
- Settings changes affect new defaults. Existing project budgets keep their own category allocation unless explicitly edited per project.
- Purchasing can manage Material Master settings but cannot change budget formula or margin defaults.

## Verification
- Permission tests must cover Owner/Finance/Purchasing/PM Settings access.
- Validation tests must cover ratio range, non-negative prices, and non-negative stock defaults.
- Main verification should include:
  - `bun test lib/auth/permissions.test.ts lib/validations/settings.test.ts lib/validations/material.test.ts`
  - `bunx tsc --noEmit`
  - `bun run lint`
  - `bun run build`
  - `bun run db:seed`
