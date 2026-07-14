# AI Agent Development Guidelines

You are working on Atria ERP for Dekoria, an interior design and build company. The product direction is Project Finance & Material Control, not a generic ERP.

The product promise is: **Project Budget Control upgraded into a real ERP with material stock visibility.** Workbook logic is source material for ratios and team habits, but user-facing screens must not be labeled as Excel.

## Planning and Documentation
1. Read existing schema, actions, docs, and UI before changing code.
2. Before major executable changes, write or update a plan under `docs/superpowers/plans/`.
3. Keep documentation aligned with the current product direction.
4. Do not leave docs saying inventory is out of MVP scope.
5. Do not refer to a non-existent `field_request` table; the implemented field expense table is `project_cost`.
6. Do not let material/inventory screens replace the category-based project budget workflow.
7. Treat Settings as the source of truth for budget allocation defaults, expense categories, item/price library, and material master settings.

## Product Vocabulary
- Project Budget: ERP internal budget setup with project value, approved RAB value, internal budget cap, category allocations, pending review, consumed budget, paid amount, remaining budget, used percentage, and margin visibility.
- Expense Categories: canonical budget buckets are Material, Tukang, Operasional, Lain-lain, and Subcon.
- Settings: owner/admin-controlled defaults for Budget Allocation, Expense Categories, Item & Price Library, and Material Master. Code constants are seed/fallback values, not the long-term source of truth.
- Budget Category Usage: allocated amount, actual spend, remaining amount, used percentage, and risk status per category.
- RAP: internal execution/material plan and cost baseline.
- Tukang Work Package: lightweight internal labor/scope plan linked to Tukang expenses.
- Subcon Package: lightweight internal vendor/subcon scope plan linked to vendor bills or Subcon expenses.
- RAB: client-facing estimate/proposal that may be generated from selected RAP Material items, Tukang packages, Subcon packages, and manual client-safe rows, but must be client-safe.
- Material Master: structured material list with specs, category, unit, brand/code/color, and vendor context.
- Inventory: current stock, reserved stock, available stock, minimum/buffer stock, location, and cost context.
- Stock Movement: stock in, stock out, reserve, use, return, transfer, adjustment, and waste.

## Preserve Useful Work
Do not blindly delete or rewrite existing auth, RBAC, project scoping, ledger, bank mutation helper, project budget, expenses, vendor bills, client payments, approvals, AI OCR/briefing, mobile shell, project pages, or reusable components.

When replacing the budget model, introduce canonical tables additively and preserve compatibility with legacy `project_budget`, `project_budget_item`, and `project_cost` until reads, writes, tests, approvals, vendor bills, and dashboards have been migrated.

## Strict TypeScript
- Do not introduce `any`.
- Give function arguments and return types explicit types.
- Avoid type assertions unless interfacing with untyped third-party data.
- Use Zod for Server Action input validation.

## Drizzle and Finance Safety
- Do not execute raw SQL in application code.
- Use Drizzle query APIs and query builder.
- Balance-changing actions must run in `db.transaction`.
- Reconciled `cash_transaction` rows must not be edited or deleted.
- Every balance-changing operation must write `audit_log`.
- Money movement requires explicit user action and appropriate permission.

## Material-Control Safety
- Material control is attached to the Material budget category. It must not replace Tukang, Operasional, Lain-lain, Subcon, or project margin tracking.
- Material/RAP/stock links are allowed only for Material category expenses.
- Tukang/Subcon package links are allowed only for their matching category and project.
- Operasional and Lain-lain should stay fast and simple; do not add heavy RAP/BOQ-style planning to them by default.
- Non-material expense entry must stay fast and simple.
- Stock-changing actions must run in `db.transaction`.
- Stock-changing actions must write `stock_movement` and `audit_log`.
- Reservation does not create a cash transaction.
- Usage does not create a cash transaction by itself; cash impact belongs to expense/vendor payment flows.
- Adjustments and waste require an audit note.

## RBAC and Scoping
- Mutations must read the Better Auth session server-side.
- Do not trust client-provided user IDs.
- PMs may only access projects assigned to them.
- Owner and Finance Admin have global finance access within their permissions.
- Purchasing has material/inventory permissions but still must use explicit actions.
- Owner and Finance Admin can manage finance Settings; Purchasing can manage Material Master settings but must not change budget formula or margin defaults.

## AI Guardrails
- AI can analyze, summarize, suggest, and prefill forms.
- AI must analyze category budget usage before or alongside material shortage details.
- AI must not mutate finance/material data without explicit human approval.
- AI must not generate or execute arbitrary SQL.
- AI output for owner should be practical and written in simple Bahasa Indonesia.
- AI must not expose internal RAP cost/margin/markup/vendor notes/internal notes in client-facing RAB output.

## UI/UX Rules
- Mobile-first.
- Use readable cards, clear sections, large tap targets, simple forms, status badges, and clean financial amounts.
- Avoid cluttered tables on mobile.
- Owner dashboard must be understandable within 30 seconds.
- Owner and finance must immediately see project value, budget, consumed budget, remaining budget, category usage, and margin risk before drilling into material details.
- Keep the UI calm, premium, operational, and trustworthy.

### iOS-Inspired Fully Rounded UI Style (Paten)
We enforce a strict fully rounded iOS interaction style for a premium, native-app feel:
- **Inputs & Dropdowns**: All text inputs (TextInput), date pickers (DatePickerField), and selection selectors (ComboboxField, FilterSelect) MUST be fully rounded (`rounded-full`) with a minimum height of `min-h-12` (48px) and side padding `px-5`.
- **Textareas**: Multiline text areas (Textarea) must use `rounded-2xl` (16px border-radius) for layout stability.
- **Buttons**: All primary, secondary, and option cards/buttons (including toggles and selectors) must use `rounded-full` (capsule style).
- **Drawers & Sheets**: Sliding bottom drawers and bottom sheets (BottomSheet, ConfirmationSheet) must use large soft rounded top corners (`rounded-t-[28px]`) or fully rounded cards (`rounded-[28px]`) with a top divider pull bar where applicable.

### Unified Motion & Animation Tokens
All animations MUST use Framer Motion and reference the unified animation presets in `lib/utils/motion.ts` to ensure consistency:
- **Drawers & Sheets sliding up**: Use `slideUpDrawerVariants` with `transitionSpringSmooth` (`type: "spring", stiffness: 300, damping: 32`) to achieve a natural sliding momentum.
- **Backdrops & Fades**: Use `fadeVariants` with `transitionEaseSmooth` (`type: "tween", ease: [0.32, 0.94, 0.6, 1], duration: 0.35`) for a smooth translucent fade-in/fade-out overlay.
- **Snappy Micro-interactions**: For tap active scales, hover effects, or quick popovers, use `transitionSpringSnappy` (`type: "spring", stiffness: 380, damping: 30, mass: 0.8`) e.g. with `whileTap={{ scale: 0.97 }}` or `scale: [1, 1.02]`.
- **Bouncy celebratory animations**: Use `transitionSpringBouncy` (`type: "spring", stiffness: 300, damping: 26`).
- Avoid defining custom/ad-hoc spring properties or inline CSS keyframes directly.
