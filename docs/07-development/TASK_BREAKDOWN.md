# Task Breakdown - Project Budget Finance & Material Control

## Terminology Mapping
- Existing field expense table: `project_cost`, not `field_request`.
- Project Budget: ERP internal budget setup with category allocation, actual spend, remaining budget, used percentage, and margin visibility.
- Settings: source of truth for Budget Allocation defaults, Expense Categories, Item & Price Library, and Material Master settings.
- Expense Categories: Material, Tukang, Operasional, Lain-lain, and Subcon.
- RAP: internal material/cost execution plan.
- RAB: client-facing estimate/proposal.

## Tasks
| Task | Goal | Acceptance |
| :--- | :--- | :--- |
| TSK-FM-001 | Update documentation source of truth | Docs describe finance/material-control MVP and no longer mark inventory out of scope. |
| TSK-FM-002 | Add canonical budget schema | Expense categories, project budgets, budget categories, project expenses, and profitability snapshots exist. |
| TSK-FM-003 | Seed budget defaults | Seed includes 90% budget cap and Tukang/Material/Operasional/Lain-lain/Subcon categories. |
| TSK-FM-003B | Add Settings source of truth | Budget Allocation Settings, Expense Category settings, Item & Price Library, and Material Master settings exist with RBAC. |
| TSK-FM-004 | Add budget actions | Ratio budget setup, category override, approval, recalculation, project dashboard, and owner dashboard actions exist. |
| TSK-FM-005 | Add category dashboard UI | Owner Dashboard and Project Detail show category cards with budget, actual, remaining, used %, and risk badge. |
| TSK-FM-006 | Clean lint/type debt | `bun run lint` has no `any`, hook-order, or purity failures. |
| TSK-FM-007 | Add material schema | Material category/master, inventory location, inventory, RAP, RAP item, stock movement, RAB estimate tables exist with relations. |
| TSK-FM-008 | Seed demo material workflow | Seed includes materials, stock, RAP plan, shortages, leftovers, and client-safe RAB estimate examples. |
| TSK-FM-009 | Add material permissions | Owner/Finance/Purchasing/PM permissions and project scoping are enforced. |
| TSK-FM-010 | Add stock movement actions | Stock in/reserve/use/return/adjustment actions are transactional and audited. |
| TSK-FM-011 | Add RAP/RAB actions | RAP item management, RAP locking, RAB generation, RAB editing, and RAB approval work. |
| TSK-FM-012 | Link expenses and bills | Material expenses and vendor bills optionally link to material, RAP item, and stock movement. |
| TSK-FM-012B | Add Tukang/Subcon packages | Work Package and Subcon Package plans link to matching expenses, vendor bills, and quotation source rows. |
| TSK-FM-013 | Build material UI | Material Master, Inventory, Material Detail, Movement History, Need to Buy, and Stock forms are mobile-first. |
| TSK-FM-013B | Build Settings UI | `/settings` is mobile-first, owner/admin-friendly, and not a technical database editor. |
| TSK-FM-014 | Upgrade Project Detail | Project page shows Category Budget Cards before RAP, Inventory Status, Expenses/Bills, Profitability, and RAB Estimate sections. |
| TSK-FM-015 | Upgrade Owner Dashboard | Dashboard shows budget, category usage, actual cost, material shortage, leftover/reusable stock, due bills, margin risk, and AI actions. |
| TSK-FM-016 | Expand AI brief | AI brief covers category finance and material risks in simple Bahasa Indonesia. |
| TSK-FM-017 | Verify | Lint, tests, build, seed, and mobile smoke checks pass. |

## Testing Focus
- Permission and project scoping.
- Settings default ratio calculations and project override behavior.
- Category budget actual/remaining/used/status calculations.
- Material links rejected for non-Material category expenses.
- Stock math for reserve/use/return/adjustment/waste.
- Audit logs for stock-changing operations.
- RAB preview excludes internal cost/margin fields.
- Existing finance flows remain green.
