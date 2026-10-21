# Paduna Build Master System & Architecture Knowledge Index

> **Quick Reference for AI Agents & Developers**  
> This document provides a high-density, authoritative overview of the Paduna Build codebase, data models, business rules, design tokens, and workflow lifecycles.

---

## 1. Project Essence & Positioning

- **Company**: Dekoria (Interior Design & Build, Indonesia).
- **Core Promise**: **Project Budget Control upgraded into a real ERP with material stock visibility.**
- **Workbook Lineage**: The legacy Excel spreadsheet logic is source material for formulas, ratios, and team workflows. **User-facing UI must NEVER use Excel as a label or metaphor.**
- **Target Audience**:
  - **Owner**: Needs project value, budget, consumed/remaining budget, category usage, leftover stock, due bills, and margin risk readable in under 30 seconds on mobile.
  - **Finance Admin**: Manages project budgets, records expenses, tracks unpaid vendor bills, reconciles cash against bank mutations, maintains ledger.
  - **Purchasing / Material Team**: Tracks material shortages, reserves stock, records stock in/out/use/return/waste, links procurement to vendor bills.
  - **Project Team (PM / Designer)**: Scoped to assigned projects; logs field expense claims and verifies material readiness.

---

## 2. Technical Stack & Architecture

- **Runtime ownership**: Hono + Bun API (`apps/api`), Next.js web (`apps/web`), Expo mobile (`apps/mobile`); pure core in `packages/core`. See `docs/06-technical/ARCHITECTURE.md` for source paths and transport boundaries.
- **Styling**: Tailwind CSS v4, Vanilla CSS variables, Phosphor Icons (`@phosphor-icons/react`), Framer Motion.
- **Database & ORM**: PostgreSQL (Neon Serverless), Drizzle ORM.
- **Authentication**: Better Auth with server-side session checks (`lib/server/session.ts`).
- **Validation**: Zod 4 for Server Action input schemas and runtime validation.

---

## 3. Directory Layout & Module Responsibilities

```text
atria-erp/
├── app/                        # Next.js App Router (pages & layouts)
│   ├── (auth)/                 # Login & authentication routes
│   ├── (dashboard)/            # Core ERP surfaces (/ledger, /projects, /materials, /approvals, /settings)
│   ├── api/                    # API Route handlers (Better Auth, webhook endpoints)
│   └── globals.css             # Theme tokens & CSS variables
├── components/                 # Shared UI primitives
│   └── ui/                     # Public shared UI inventory; consumers import only from @/components/ui
├── db/                         # Database schema & migrations
│   ├── schema/                 # Drizzle schema table definitions
│   ├── index.ts                # Drizzle database client instance
│   └── seed.ts                 # Database seed script
├── features/                   # Domain-driven feature modules
│   ├── approvals/              # Multi-tier approval workflows
│   ├── bank-accounts/          # Bank account management & balance tracking
│   ├── expenses/               # Field expense claims & OCR receipt processing
│   ├── materials/              # Material Master, inventory stock & stock movements
│   ├── projects/               # Project budget, RAP execution plans, client RAB proposals
│   ├── reconciliation/         # Bank statement CSV import & cash transaction matching
│   ├── settings/               # System defaults (categories, budget ratios, material specs)
│   └── vendor-bills/           # Vendor procurement invoices & payment scheduling
├── lib/                        # Core utilities & libraries
│   ├── auth/                   # Session verification & RBAC helpers
│   ├── utils/                  # Formatting, business labels, and Framer Motion presets
│   └── utils.ts                # Class merging (cn) helper
├── docs/                       # Project documentation & architectural plans
└── .agents/                    # Antigravity rules, skills, hooks & configurations
```

### Shared UI First

Before adding UI, inspect `apps/web/components/ui/index.ts`, the component stories/tests, and the relevant taxonomy in `DESIGN.md`. The mandatory decision order is **reuse → compose/extend → create**. Feature code owns domain data and workflow composition; it does not recreate shared portal, focus, dismissal, collision, keyboard, money-formatting, motion, or touch-target behavior.

The canonical contextual surfaces are `ActionMenu`, `AdaptiveSelect`, `SelectionDialog`, `SearchDialog`, `CompactFormDialog`, `CalendarDialog`, `ConfirmationDialog`, `SuccessDialog`, `AnchoredFilterPanel`, `FormSheet`, `DetailSheet`, `ContextPopover`, and `Tooltip`. Full decision rules and the acceptance checklist live in `.agents/rules/05-shared-ui-first.md`; detailed visual and interaction taxonomy lives in `DESIGN.md`.

---

## 4. Canonical Business Enums & Taxonomies

### A. Expense & Budget Categories (Code-Locked)

1. `MATERIAL`: Linked to Material Master, RAP items, inventory purchases, vendor bills.
2. `TUKANG`: Linked to Tukang Work Packages and wage claims.
3. `OPERASIONAL`: Field consumables, meals, transport, minor tools.
4. `LAIN_LAIN`: Miscellaneous unforeseen project expenses.
5. `SUBCON`: Subcontractor work packages and third-party bills.

### B. User Roles & RBAC Matrix

- `OWNER`: Full global financial visibility, approval authority over all expenses ≥ Rp 5,000,000, margin overrides.
- `FINANCE_ADMIN`: Full finance workspace, creates budgets, processes bills, reconciles bank mutations.
- `PURCHASING`: Material Master, inventory stock, stock movements, vendor bills.
- `PROJECT_MANAGER`: Scoped to assigned projects only; can submit expense claims and view project RAP/material readiness.
- `DESIGNER`: Scoped to assigned projects; view-only or draft project estimates.

### C. Approval Status Lifecycle

- `DRAFT` $\rightarrow$ `PENDING_FINANCE` $\rightarrow$ `PENDING_OWNER` $\rightarrow$ `APPROVED` (or `REJECTED` / `REVISED`).

### D. Cash Reconciliation Lifecycle

- `UNRECONCILED` $\rightarrow$ `PENDING_MATCH` $\rightarrow$ `RECONCILED` (or `EXCEPTION`).
- Reconciled rows are permanently immutable.

### E. Stock Movement Types

- `STOCK_IN` (receipt / opening stock), `STOCK_OUT`, `RESERVE` (project allocation), `USE` (project site consumption), `RETURN` (unused material returned), `TRANSFER` (inter-warehouse), `ADJUSTMENT`, `WASTE`.

---

## 5. Key Financial Invariants (Option A Ledger Model)

1. **Transaction Wrapping**: All balance changes run in `await db.transaction(async (tx) => { ... })`.
2. **Row Locking**: Lock account with `.for("update")` before modifying balance.
3. **Audit Trail**: Every balance or stock mutation writes an `audit_log` row with actor, previous state, and new state.
4. **Reconciliation Lock**: Reconciled cash transactions cannot be edited or deleted; corrections are done via compensating reversal entries with explicit audit notes.
5. **RAP vs. RAB Isolation**: Internal RAP costs, markups, and vendor notes must never leak into client-facing RAB proposals.

---

## 6. Design System Tokens & Rules

- **Mobile Viewport (320px – 430px)**: Primary truth; shell is `max-w-md mx-auto`.
- **Colors**: Use the semantic surface, text, accent, critical, ring, focus-ring, and shadow roles defined in `DESIGN.md`, `.impeccable/design.json`, and `app/globals.css`; do not introduce raw color or shadow values in UI source.
- **iOS Paten Form Style**:
  - Standalone inputs/buttons: `rounded-full` (capsule style), `min-h-12` (48px).
  - Grouped forms (`FormSection`): borderless rows inside the documented shared surface with subtle semantic dividers.
  - Drawers: semantic surface-container-low canvas, `rounded-t-[28px]`, with pull bar.
- **Motion Presets (`lib/utils/motion.ts`)**:
  - Drawers: `slideUpDrawerVariants` + `transitionSpringSmooth`.
  - Fades: `fadeVariants` + `transitionEaseSmooth`.
  - Micro-interactions: `transitionSpringSnappy`.

---

## 7. Antigravity Agent Runbooks

- **Design & UI**: `.agents/skills/impeccable/SKILL.md`, `PRODUCT.md`, `DESIGN.md`, and `.impeccable/design.json`
- **Finance & Ledger**: `.agents/skills/atria-finance/SKILL.md`
- **Material & Stock**: `.agents/skills/atria-material/SKILL.md`
- **QA & Verification**: `.agents/skills/atria-qa/SKILL.md`
- **Knowledge Navigation**: `.agents/skills/atria-knowledge/SKILL.md`
