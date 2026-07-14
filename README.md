# Atria ERP

Atria ERP is Dekoria's internal Project Finance & Material Control System for interior design and build projects. It preserves the team's familiar project-budget workflow of Project Budget Setup -> Expense Tracker by Category -> Budget Control Dashboard -> Category Usage -> Remaining Budget -> Project Margin, then upgrades it with RAP material planning, inventory visibility, stock movement, vendor bill tracking, project profitability, and owner-friendly AI briefs.

The product promise is: **Project Budget Control upgraded into a real ERP with material stock visibility.** The workbook remains source material for ratios and habits, but user-facing screens should not be labeled as Excel.

The product is practical by design. It is not a full accounting suite, not a generic project management tool, not just a prettier spreadsheet, and not a complex warehouse/manufacturing system. Its job is to help Dekoria see where project budget, category spending, materials, and margin are going before leaks become expensive surprises.

## Product Focus
- Project Budget: ERP budget setup by category with contract value, internal budget, consumed budget, pending review, paid amount, remaining budget, used percentage, target gross, and projected margin.
- Settings: source of truth for Budget Allocation defaults, Expense Categories, Item & Price Library, and Material Master settings.
- Expense Categories: Material, Tukang, Operasional, Lain-lain, and Subcon are first-class budget controls.
- Expense Tracker: actual money spent by project and category, with quick mobile entry and optional vendor/receipt/payment context.
- Budget Dashboard: owner-readable category cards with allocated budget, actual spend, remaining budget, used percentage, and risk badge.
- RAP: internal execution and material plan. Locked RAP becomes the cost baseline.
- Tukang Work Packages: lightweight internal labor/scope packages linked to Tukang expenses.
- Subcon Packages: lightweight vendor/subcon scope packages linked to Subcon vendor bills or expenses.
- Material Master: structured material names, specs, units, category, brand/code, and vendor context.
- Stock Inventory: current, reserved, available, buffer/minimum, location, and valuation context.
- Stock Movement: stock in, stock out, reserve, use, return, transfer, adjustment, and waste.
- Vendor Bills / Purchase Tracking: payable and purchase records connected to vendor, project, budget, and material when relevant.
- RAB: client-facing estimate generated from selected RAP Material items, Tukang packages, Subcon packages, and manual client-safe lines when useful, but editable and safe from internal cost/margin exposure.
- Owner Dashboard and AI Brief: simple Bahasa Indonesia summaries of category budget usage, margin risk, material shortage, leftover opportunity, due bills, and suggested actions.

## Preserved Foundations
The existing app already includes valuable foundations and should not be rewritten blindly:
- Better Auth, RBAC, project scoping, and role permissions.
- Drizzle/PostgreSQL schema, migrations, and seed workflow.
- Project budgets, project costs, vendor bills, client invoices, payments, ledger, and audit logs.
- Existing budget item and project cost tables remain during migration while canonical project budget/category tables are introduced.
- Transactional bank balance mutation helper.
- Mobile shell, bottom navigation, expense drawer, project detail, expenses, approvals, and ledger/dashboard screens.
- Gemini OCR and daily AI briefing architecture.

## Tech Stack
- Runtime and package manager: Bun
- Framework: Next.js App Router
- Language: TypeScript
- Database: PostgreSQL / Neon
- ORM: Drizzle ORM
- Authentication: Better Auth
- Styling: Tailwind CSS with project CSS tokens
- AI: Google Gemini via `@google/genai`

## Documentation Map
- `docs/01-product/PRD.md`: product direction and acceptance criteria.
- `docs/02-product/MVP_BLUEPRINT.md`: MVP modules and role workflows.
- `docs/03-flows/FLOWS.md`: finance/material operational flows.
- `docs/04-data/DATABASE_SCHEMA.md`: database model and relationships.
- `docs/04-data/STATUS_ENUMS.md`: status and movement enums.
- `docs/05-ui-ux/MOBILE_FIRST_UI_UX.md`: mobile-first screen guidance.
- `docs/05-ui-ux/IOS26_SOLID_DESIGN_SYSTEM.md`: visual system.
- `docs/06-technical/AUTH_AND_PERMISSION.md`: RBAC model.
- `docs/06-technical/API_ACTIONS.md`: Server Action contracts.
- `docs/06-technical/AI_AGENT_ARCHITECTURE.md`: AI guardrails and brief design.
- `docs/07-development/ROADMAP.md`: phased roadmap.
- `docs/07-development/TASK_BREAKDOWN.md`: implementation task breakdown.
- `docs/07-development/IMPLEMENTATION_ORDER.md`: build and verification order.

## Local Development
```bash
bun install
cp .env.example .env
bun run db:seed
bun run dev
```

Open `http://localhost:3000`.

## Core Engineering Rules
- Use strict TypeScript. Do not introduce `any`.
- Validate all Server Action inputs with Zod.
- Use Drizzle query APIs and query builder. Do not execute raw SQL in app code.
- Budget formulas and master data should come from Settings, with code constants used only as seed/fallback defaults.
- Mutations must read the server session directly through Better Auth.
- Balance-changing and stock-changing operations must run inside transactions and write audit logs.
- Reconciled ledger transactions are immutable.
- AI may analyze and propose, but must not mutate finance/material records without explicit human approval.
- Material tracking must roll up into the Material category; it must not hide or replace Tukang, Operasional, Lain-lain, Subcon, gross, or remaining-budget controls.
- Tukang/Subcon package planning is a lightweight detail layer. Do not turn Operasional and Lain-lain into heavy RAP/BOQ flows.
