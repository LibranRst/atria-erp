# Antigravity Agent Guidelines for Atria ERP

You are working on **Atria ERP** for **Dekoria**, an interior design and build company in Indonesia. The product direction is **Project Finance & Material Control**, not a generic ERP.

The product promise is: **Project Budget Control upgraded into a real ERP with material stock visibility.** Workbook logic is source material for ratios and team habits, but user-facing screens must not be labeled as Excel.

---

## 1. Core Operating Principles & Vocabulary

- **Project Budget**: ERP internal budget setup with project value, approved RAB value, internal budget cap, category allocations, pending review, consumed budget, paid amount, remaining budget, used percentage, and margin visibility.
- **Expense Categories**: Canonical budget buckets are strictly: `MATERIAL`, `TUKANG`, `OPERASIONAL`, `LAIN_LAIN`, and `SUBCON`.
- **Settings as Source of Truth**: Settings is the source of truth for budget allocation defaults, expense categories, item/price library, and material master settings. Code constants are seed/fallback values only. Changes to defaults apply only to new project budgets.
- **RAP vs. RAB Isolation**:
  - **RAP (Rencana Anggaran Pelaksanaan)**: Internal execution and material plan, representing the internal cost baseline.
  - **RAB (Rencana Anggaran Biaya)**: Client-facing estimate/proposal generated from selected RAP items, Tukang packages, and Subcon packages. Internal margins, markups, vendor notes, and internal costs must NEVER leak into RAB.
- **Tukang Work Package**: Lightweight internal labor/scope plan linked to Tukang expenses (no stock behavior).
- **Subcon Package**: Lightweight internal vendor/subcon scope plan linked to vendor bills or Subcon expenses.
- **Material Master & Inventory**:
  - Material Master contains specs, category, unit, brand/code/color, and vendor context.
  - Stock states: `current_stock` (physical on hand), `reserved_stock` (committed to projects), `available_stock` (current - reserved).
  - Stock movements: `stock_in`, `stock_out`, `reserve`, `use`, `return`, `transfer`, `adjustment`, `waste`.
- **Cash Ledger & Reconciliation (Option A Model)**:
  - Every balance-changing action runs in `db.transaction`, locks account row, updates balance, and writes both `cash_transaction` and `audit_log`.
  - Reconciled `cash_transaction` rows are immutable; corrections require compensating reversal entries with audit notes.

---

## 2. Technical Stack & Invariants

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5.
- **Database & ORM**: PostgreSQL (Neon Serverless), Drizzle ORM.
- **Authentication & RBAC**: Better Auth with server-side session checks (`lib/server/session.ts`).
- **Styling**: Tailwind CSS v4, Vanilla CSS variables, Phosphor Icons (`@phosphor-icons/react`), Framer Motion.
- **Validation**: Zod 4 for all Server Action inputs and schema assertions.

### Strict TypeScript Rules
- NEVER introduce `any`.
- Always provide explicit function argument and return types.
- Avoid type assertions (`as Type`) unless interfacing with untyped third-party data.
- Validate external and action inputs with Zod.

### Drizzle & Finance Safety Rules
- NEVER execute raw SQL in application code.
- Always use Drizzle query APIs and query builder.
- Balance-changing and stock-changing actions MUST run inside `db.transaction`.
- Every balance-changing and stock-changing operation MUST write an `audit_log` row.
- Reconciled cash transactions must never be directly updated or deleted.

---

## 3. UI/UX & Design System (Calm Modern Luxury)

Before writing or editing UI, load `.agents/skills/impeccable/SKILL.md` and consult `DESIGN.md`, `PRODUCT.md`, and `.impeccable/design.json`.

- **Mobile 320–430 px is the Source of Truth**: The fixed `max-w-md` shell remains one column at every viewport. Desktop browser preview alone is not acceptance evidence.
- **iOS-Inspired Contextual Form Style (Paten)**:
  - **Standalone Inputs & Dropdowns**: Outside grouped forms, MUST use a white fully rounded control (`rounded-full`) with minimum height `min-h-12` (48px) and side padding `px-5`.
  - **Grouped Forms**: Controls inside `FormSection` MUST render as borderless rows on one white grouped surface. Apply the radius to the outer panel, use subtle dividers between rows, keep labels visible, and do not nest a capsule around every value.
  - **Textareas**: Standalone textareas use `rounded-2xl`; grouped textareas grow inside their row without an additional rounded container.
  - **Buttons**: All primary, secondary, and option buttons must use `rounded-full` (capsule style).
  - **Drawers & Sheets**: Sliding bottom drawers use `surface-container-low` canvas, white grouped content surfaces, large soft rounded top corners (`rounded-t-[28px]`), and a pull bar.
- **Unified Motion & Animation Tokens (`lib/utils/motion.ts`)**:
  - Drawers/Sheets: `slideUpDrawerVariants` with `transitionSpringSmooth`.
  - Backdrops/Fades: `fadeVariants` with `transitionEaseSmooth`.
  - Micro-interactions: `transitionSpringSnappy` (e.g. `whileTap={{ scale: 0.97 }}`).
  - Celebratory animations: `transitionSpringBouncy`.
- **Financial Formatting**: Always use the shared `MoneyValue` component from the `@/components/ui` barrel with tabular numerals, compact primary amounts, and exact secondary amounts.
- **Language**: User-facing copy is predominantly clear, professional Bahasa Indonesia. Never render raw enums (`snake_case`) directly; translate via `formatBusinessLabel`.

---

## 4. Antigravity Workspace Capabilities & Customizations

This repository is configured with project-specific customizations in `.agents/`:
- **Rules (`.agents/rules/`)**:
  - `01-design-system.md`: Complete visual grammar, tokens, iOS form rules, motion tokens.
  - `02-finance-safety.md`: Ledger safety, transaction locking, audit logs, reconciliation.
  - `03-material-control.md`: RAP/RAB isolation, stock movements, vendor bills, goods receipt.
  - `04-codebase-standards.md`: Strict TypeScript, server actions, Zod schemas, RBAC.
- **Skills (`.agents/skills/`)**:
  - `impeccable`: Canonical UI design, audit, polish, accessibility, responsive, and motion workflow driven by `PRODUCT.md`, `DESIGN.md`, and `.impeccable/design.json`.
  - `atria-finance`: Runbook for ledger, cash transaction, and reconciliation workflows.
  - `atria-material`: Runbook for material inventory, stock movements, and RAP planning.
  - `atria-qa`: Runbook for linting, type-checking, database resetting, and seed verification.
  - `atria-knowledge`: Instant indexed guide to documentation, schema, and API actions.
- **Lifecycle Hooks (`.agents/hooks.json`)**:
  - Pre-tool safety checks and invocation reminders.
- **Documentation Index**:
  - Refer to `docs/ANTIGRAVITY_INDEX.md` for a comprehensive architecture and schema map.
