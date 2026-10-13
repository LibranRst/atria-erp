---
version: 1
slug: "apps-web-components-ui-form-guided-form-tsx"
primary_target: "apps/web/components/ui/form/guided-form.tsx"
related_targets:
  [
    "apps/web/features/expenses/components/forms/expense-form.tsx",
    "apps/web/features/finance-dashboard/components/bank-accounts/account-form-sheet.tsx",
    "apps/web/features/settings/components/materials/material-editor-sheet.tsx",
    "apps/web/features/reconciliation/components/reconciliation-workspace.tsx",
    "apps/web/features/administration/components/roles/role-create-sheet.tsx",
    "apps/web/features/projects/list/components/drawers/project-drawer.tsx",
    "apps/web/components/ui/form/select-form-controls.tsx",
    "apps/web/components/ui/button/button.tsx",
  ]
---

# Manual input form panels

Visitor mode: Operate. Owner, Finance, Purchasing and assigned project staff complete existing manual input and review workflows efficiently at a desk.

Desktop uses the incumbent AI form geometry through public FormSheet, OperationalFormSheet and WorkflowFormSheet: wide main editor/review at left, meaningful live context and protected actions at right. No new overlay, focus, dismissal, scroll or motion owner. FormSection owns grouped editable surfaces; GroupedSurface and stacked FactRow own compact readable aside facts. MoneyValue preserves exact cents when needed.

All 44 eligible manual Operational/Workflow owners are covered across expense/bills/payments, accounts/cash, project/budget/RAP/RAB/invoices, material/inventory, settings/library, users/vendors/roles, reconciliation and onboarding. RAB export already uses the same shared slots. Eleven short, read-only or mobile-only owners and five compact name/reason dialogs retain their focused contract. Dedicated page editors remain pages.

Keep current review/confirmation and explicit mutation actions, HTML form associations, pending/disabled barriers, permission/scope locks, dirty draft policy, exit-retained entities and native-pinned/mobile one-column composition. Budget/stock/cash consequences reuse incumbent calculations and remain distinctly labeled as draft/preview. Receipt is separate from payment; statement evidence/matching does not move cash; RAB export stays client-safe; security fields never become summary values.

Unread/reading/failed sources and missing selected references show their actual state. Valid zero is shown only for known data or a successfully read empty preview. Main and aside scroll independently above protected actions. Verify 1024/1280/1440px plus 320/360/390/430px, dirty/focused resize, nested selection/Escape/focus restoration, reduced motion, blank/pending/errors and dense/long content using safe fixtures.

Desktop selectors open empty collections with truthful guidance and retain their existing search, custom-value entry and explicit create actions. Intentional empty-value options remain selectable. Dependent project/budget controls may be disabled with clear prerequisite/recovery guidance. Public Button and IconButton forward the actual button DOM ref in both presentations so the shared anchored owner positions, dismisses and restores focus correctly. Local selection uses the existing draft callback; create/menu handoffs reuse the shared exit queue and nested category/project confirmations keep their workflow owner. Nested menus inherit the active sheet layer and shared focus/dismissal coordination without replacing the parent draft or adding a feature portal.

Implementation and per-owner matrix: docs/plans/2026-10-13-manual-desktop-form-panels.md.

Dropdown audit and source inventory: docs/plans/2026-10-13-desktop-modal-dropdown-audit.md and docs/qa/2026-10-13-desktop-modal-dropdown-inventory.json. Runtime evidence covers shared variants and representative safe fixtures, rather than every individual business form.
