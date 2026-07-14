# Auth and Permission Model

## Roles
- `OWNER`: full visibility and final approval for budget, payment, and high-risk material actions.
- `FINANCE_ADMIN`: manages budgets, expenses, vendor bills, payments, and finance/material dashboards.
- `PROJECT_MANAGER`: reads assigned projects, creates project budgets/RAP drafts for assigned projects, inputs expenses, and views project material status.
- `PURCHASING`: manages material master, inventory, stock movements, reservations, purchase needs, and vendor material context.
- `DESIGNER`, `SALES`, `MARKETING`: supporting roles. Preserve existing access where useful, but they are not core MVP operators for finance/material control.

## Permission Groups
- Finance: `view:ledger`, `create:ledger`, `reconcile:ledger`, `view:profitability`.
- Budget/RAP/RAB: `view:budget`, `create:budget`, `update:budget`, `approve:budget`, `view:rap`, `create:rap`, `update:rap`, `lock:rap`, `view:rab`, `create:rab`, `update:rab`, `approve:rab`.
- Costs and bills: `view:cost`, `create:cost`, `update:cost`, `approve:cost`, `pay:cost`, `view:vendor_bill`, `create:vendor_bill`, `update:vendor_bill`, `pay:vendor_bill`.
- Material control: `view:material`, `create:material`, `update:material`, `view:inventory`, `create:stock_movement`, `reserve:stock`, `use:stock`, `adjust:stock`.
- Settings: `view:settings`, `manage:budget_settings`, `manage:expense_categories`, `manage:item_library`, `manage:material_settings`.
- AI: `view:ai_brief`.

## Scoping
- Owner and Finance Admin have global read/write access inside their permissions.
- Project Manager access is scoped to projects where `project.projectManagerId = session.user.id`.
- Purchasing has global material/inventory access but should only mutate project-linked stock movement when the target project is active and the action is explicit.
- Owner and Finance Admin can manage Settings. Purchasing can manage Material Master settings only. PM, Designer, Sales, and Marketing do not mutate Settings in v1.
- Mutating Server Actions must read the user from Better Auth server-side and must not trust client-provided user IDs.

## Guardrails
- PM can view material readiness for assigned projects but cannot see global cash ledger.
- Client-facing RAB preview must hide internal RAP cost, margin, markup, vendor notes, and internal notes.
- AI can read and propose. AI cannot approve, pay, reserve, use, adjust, or create important finance/material records without explicit human action.
