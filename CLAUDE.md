# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Atria ERP is a finance-first, mobile-first internal ERP for interior design/build contractors. The product centers on project budgets, cash/bank ledger integrity, field expense approvals, and real-time profitability rather than generic HR or inventory modules. Most product and technical specifications are in Bahasa Indonesia under `docs/`; treat those docs as the source of truth for intended behavior until executable code catches up.

The repository is currently an early Next.js App Router project with foundational docs and a minimal app shell. The documented target stack is Bun, Next.js App Router, TypeScript, Neon PostgreSQL, Drizzle ORM, Better Auth, Tailwind CSS/shadcn-style components, ImageKit for receipt uploads, and Gemini AI for receipt OCR and daily finance briefings. Not all target dependencies are installed yet.

## Common Commands

Use Bun as the package manager/runtime; `bun.lock` is committed.

```bash
bun install          # install dependencies
bun run dev          # start Next.js dev server
bun run build        # production build
bun run start        # run built app
bun run lint         # run ESLint
```

Testing is planned around Bun Test, but there is no test script or test configuration in `package.json` yet. When tests are added, run a single test file with:

```bash
bun test path/to/file.test.ts
```

README-documented database commands (`bun run db:generate`, `bun run db:push`, `bun run db:seed`) are intended for the Drizzle/Neon phase, but those scripts are not present in `package.json` yet. Do not assume they work until the scripts and Drizzle files exist.

## Current Codebase Shape

- `app/` contains the Next.js App Router UI entry points: `layout.tsx`, `page.tsx`, and global Tailwind tokens in `globals.css`.
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

- Primary mobile navigation is a sticky bottom nav with Projects, Ledger, Add Expense, and Profile.
- Touch targets should be at least 44x44px; the UI specs often target 48x48px or larger for critical actions.
- Use dense cards, strong hierarchy, semantic financial status colors, and the tokens in `app/globals.css`.
- Avoid traditional centered spinners for key async flows; the UI spec prefers shimmer skeletons.
- Desktop/tablet layouts should adapt to sidebar navigation and dual-pane finance/reconciliation views where appropriate.

## Documentation Map to Read Before Work

- Product scope and MVP: `docs/01-product/PRD.md`, `docs/02-product/MVP_BLUEPRINT.md`
- Financial workflows: `docs/03-flows/FLOWS.md`
- Data model and statuses: `docs/04-data/DATABASE_SCHEMA.md`, `docs/04-data/STATUS_ENUMS.md`, `docs/04-data/SEED_DATA.md`
- UI/UX and design tokens: `docs/05-ui-ux/MOBILE_FIRST_UI_UX.md`, `docs/05-ui-ux/IOS26_SOLID_DESIGN_SYSTEM.md`
- Technical architecture, auth, actions, AI: `docs/06-technical/ARCHITECTURE.md`, `docs/06-technical/AUTH_AND_PERMISSION.md`, `docs/06-technical/API_ACTIONS.md`, `docs/06-technical/AI_AGENT_ARCHITECTURE.md`
- Build order and roadmap: `docs/07-development/IMPLEMENTATION_ORDER.md`, `docs/07-development/ROADMAP.md`, `docs/07-development/TASK_BREAKDOWN.md`

## Agent Workflow Requirements

Important instructions from `AGENTS.md`:

- Read existing schemas and API documentation before proposing changes.
- Before writing executable code, create a step-by-step implementation plan under `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` and wait for user approval.
- Do not leave placeholder code such as `TODO`, `TBD`, or incomplete statements in implemented functions, schemas, or actions.
