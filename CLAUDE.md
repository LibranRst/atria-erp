# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Atria ERP is a finance-first, mobile-first internal ERP for interior design/build contractors. The product centers on project budgets, cash/bank ledger integrity, field expense approvals, material stock visibility, and real-time profitability rather than generic HR modules. Most product and technical specifications are under `docs/`; active guides and executable code take precedence over historical implementation plans.

The repository is an active Next.js App Router application using Bun, TypeScript, Neon PostgreSQL, Drizzle ORM, Better Auth, Tailwind CSS, ImageKit, and Gemini receipt OCR. AI CFO/financial briefing is deferred from the current Dashboard; do not reintroduce it unless product scope explicitly changes.

## Common Commands

Use Bun as the package manager/runtime; `bun.lock` is committed.

```bash
bun install          # install dependencies
bun run dev          # start Next.js dev server
bun run build        # production build
bun run start        # run built app
bun run lint         # run ESLint
```

Tests use Bun Test. Run a focused test file with:

```bash
bun test path/to/file.test.ts
```

Check `package.json` before running database or project scripts; do not infer commands from historical docs.

## Current Codebase Shape

- `app/` contains the Next.js App Router routes, layouts, loading states, and server actions.
- `app/globals.css` defines the HSL-based dark design tokens (`--bg-*`, `--text-*`, `--primary`, `--success`, `--warning`, `--critical`) and maps them into Tailwind v4 `@theme` variables. Prefer these semantic tokens over hardcoded colors.
- `tsconfig.json` uses strict TypeScript and maps `@/*` to the repository root.
- `eslint.config.mjs` extends Next.js core web vitals and TypeScript rules.
- `docs/` contains the real product, data, architecture, UI/UX, and implementation guidance. Consult it before implementing substantial features.

## Architecture Direction from Docs

The intended architecture is data-flow-first:

1. Database layer and Drizzle schema
2. Auth and RBAC security layer
3. Core transaction helper / Option A ledger model
4. Server Actions with Zod validation
5. Gemini AI integrations
6. Mobile-first iOS 26 Solid UI

Use Next.js Server Components for read-only data fetching directly on the server. Use Client Components only for interactive UI, local state, animation, browser APIs, camera/upload flows, and form interactions. All data mutations should be implemented as Next.js Server Actions, not internal REST endpoints, unless a documented integration requires an API route.

Server Actions are expected to be organized by domain:

- `app/actions/finance/` for ledger, bank accounts, client payments, vendor payments, and financial summaries.
- `app/actions/project/` for project budgets, budget items, field cash requests, and project approval flows.

All Server Actions should return the documented `ActionResponse<T>` shape from `docs/06-technical/API_ACTIONS.md` so Client Components can handle success and error states consistently.

## Finance and Data Integrity Guardrails

This app manages financial state. Follow `AGENTS.md`, `docs/06-technical/ARCHITECTURE.md`, and `docs/04-data/DATABASE_SCHEMA.md` when implementing financial flows.

- Use Drizzle ORM query builders/relational queries for application code. Raw SQL is reserved for migrations only.
- Every balance-changing operation must run inside `db.transaction(...)` and write both a `cash_transaction` ledger entry and an `audit_log` entry.
- Use the documented Option A ledger model: lock the relevant `bank_account` row with pessimistic locking, verify funds for `CREDIT` cash-out operations, update the balance, verify exactly one row changed, then write immutable ledger/audit records.
- Never edit or delete reconciled `cash_transaction` rows. Corrections must be compensating reversal/journal transactions with audit notes.
- Do not trust client-provided user IDs or authorization data. Read the session on the server through Better Auth, then enforce RBAC and project scoping.
- PM and Designer access is project-scoped; Owner and Finance Admin have broader/global financial access as documented in `docs/06-technical/AUTH_AND_PERMISSION.md`.
- Owner approval is required for field/vendor payments of Rp 5,000,000 or more and for any over-budget override.

## Validation and Types

- Keep strict TypeScript. Avoid `any`; use concrete types, inferred Drizzle types, Zod schemas, or type guards.
- Validate every Server Action input with Zod before business logic. Match Zod constraints to Drizzle/PostgreSQL constraints: UUIDs, string lengths, numeric bounds, and enums/statuses.
- Money values are documented as PostgreSQL `numeric(15, 2)`. Be careful with JavaScript floating point; prefer minor units or a decimal library when implementing real money arithmetic.

## UI/UX Direction

Atria ERP is mobile-first for field Project Managers and should feel like a premium native iOS-style WebView.

- Load the project skill at `.claude/skills/atria-ui-ux/SKILL.md` before planning, implementing, styling, redesigning, reworking, auditing, or reviewing any UI. Follow its live references, motion decision, and verification workflow.
- `docs/05-ui-ux/MAIN_SURFACE_DESIGN_LANGUAGE.md` is the active page-design source of truth.
- The current Dashboard (`/ledger`) and Expenses (`/expenses`) are reference implementations. Reuse their grammar and shared primitives; do not copy either layout blindly.
- The fixed `max-w-md` mobile shell remains one column at all viewports. Verify 320, 360, 390, and 430px rather than judging only from desktop preview.
- Use one justified focal summary, concise section headers, grouped surfaces with dividers, purpose-built rows, and restrained status treatments. Do not make every row a card.
- Use shared financial formatting with tabular numerals; primary amounts must not wrap.
- Keep visible actions compact while preserving a 48x48px effective touch target.
- Use structural route skeletons matching the final hierarchy. Avoid generic centered spinners and large loading layout shifts.
- Horizontal tabs and filters may auto-center within their strip but must never scroll the document vertically or move the user's reading position.
- Preserve established identity surfaces such as bank account gradients. Avoid repeated progress bars, decorative vertical severity rails, excessive glass/gradients, and whole-section animations.

## Documentation Map to Read Before Work

- Product scope and MVP: `docs/01-product/PRD.md`, `docs/02-product/MVP_BLUEPRINT.md`
- Financial workflows: `docs/03-flows/FLOWS.md`
- Data model and statuses: `docs/04-data/DATABASE_SCHEMA.md`, `docs/04-data/STATUS_ENUMS.md`, `docs/04-data/SEED_DATA.md`
- Main-surface design language: `docs/05-ui-ux/MAIN_SURFACE_DESIGN_LANGUAGE.md`
- UI/UX workflow and component tokens: `docs/05-ui-ux/MOBILE_FIRST_UI_UX.md`, `docs/05-ui-ux/IOS26_SOLID_DESIGN_SYSTEM.md`
- Technical architecture, auth, actions, AI: `docs/06-technical/ARCHITECTURE.md`, `docs/06-technical/AUTH_AND_PERMISSION.md`, `docs/06-technical/API_ACTIONS.md`, `docs/06-technical/AI_AGENT_ARCHITECTURE.md`
- Build order and roadmap: `docs/07-development/IMPLEMENTATION_ORDER.md`, `docs/07-development/ROADMAP.md`, `docs/07-development/TASK_BREAKDOWN.md`

## Agent Workflow Requirements

Important instructions from `AGENTS.md`:

- Read existing schemas and API documentation before proposing changes.
- Before major executable changes, write or update a step-by-step implementation plan under `docs/plans/YYYY-MM-DD-<feature-name>.md`.
- Do not leave placeholder code such as `TODO`, `TBD`, or incomplete statements in implemented functions, schemas, or actions.
