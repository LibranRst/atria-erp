# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Atria ERP is Dekoria's finance-first, mobile-first internal ERP for interior design/build projects. It centers on project budgets by expense category, cash/bank ledger integrity, field expense approvals, RAP/RAB planning, material stock visibility, and margin risk — not generic HR or PM modules. Product/technical specs live under `docs/`; executable code and active guides take precedence over historical implementation plans in `docs/plans/`.

Stack: Bun, Next.js App Router (v16) with React 19, TypeScript (strict), Neon PostgreSQL + Drizzle ORM, Better Auth, Tailwind v4, Framer Motion, ImageKit uploads, Gemini (`@google/genai`) receipt OCR. AI CFO/financial briefing is deferred from the Dashboard; do not reintroduce it unless product scope explicitly changes.

User-facing copy and much of the domain-code commenting are Bahasa Indonesia. Match the surrounding language when editing.

## Common Commands

Bun is the package manager/runtime; `bun.lock` is committed.

```bash
bun install
bun run dev            # Next dev server with localhost + LAN host (scripts/dev-lan.mjs)
bun run dev:default    # plain `next dev`
bun run build
bun run lint           # eslint
bun run lint:fix
bun run format         # prettier --write .
bun run tailwind:format  # canonical Tailwind class order (eslint --fix) + prettier
```

Tests are Bun Test, colocated next to the code they cover (`lib/**`, `app/actions/**`, `components/**`, `db/seed/**`). There is no `test` script:

```bash
bun test                              # whole suite
bun test lib/finance/dashboard.test.ts  # single file
bun test --test-name-pattern "reconcile"
```

Database scripts (all destructive ones require `--confirm-reset`):

```bash
bun run db:seed              # insert-only; refuses a non-empty or production DB
bun run db:reset             # empty DB for production-style UAT
bun run db:demo:reset        # connected demo dataset + CSV fixtures in .atria-demo/
bun run db:demo:verify
```

Drizzle migrations live in `drizzle/`; config is `drizzle.config.ts`. Check `package.json` before running any script — do not infer commands from docs.

## Architecture

Layering runs database → auth/RBAC → transaction helpers → Server Actions → UI. Read-only data fetching happens in Server Components; Client Components are for interaction, local state, animation, camera/upload, and forms. All mutations are Server Actions — no internal REST endpoints (the only API route is Better Auth at `app/api/auth/[...better-auth]/route.ts`).

Three source roots, with enforced boundaries:

- `app/` — routes, layouts, `loading.tsx` skeletons, `error.tsx`, and `app/actions/**` (the `"use server"` modules, grouped by domain: `finance/`, `project/`, `material/`, `settings/`, `ai/`, `media/`, plus onboarding/administration/activity-detail families).
- `features/<domain>/` — feature slices with `components/`, `hooks/`, `server/`, `types/`, `utils/`. Domains: activity-detail, administration, approvals, expenses, finance-dashboard, materials, onboarding, profile, projects, reconciliation, settings, shared-hooks.
- `lib/` — cross-cutting domain logic and pure helpers (`lib/finance`, `lib/project`, `lib/material`, `lib/validations` Zod schemas, `lib/auth` permissions, `lib/server/session.ts`, `lib/utils/motion.ts`, `lib/types/action-response.ts`).
- `components/ui/**` and `components/layout/**` — shared primitives and the mobile shell/bottom nav.
- `db/` — `db/index.ts` client, `db/schema/{auth,projects,finance,materials,system}.ts` re-exported from `db/schema.ts`, seed under `db/seed/`.

`lib/architecture/server-boundaries.test.ts` is an executable architecture test. It fails the build-time suite when:

1. A `features/<domain>/actions/` folder exists (server entrypoints belong in `app/actions/`).
2. A file under `features/**/server/**` does not start with `import "server-only";`.
3. Any route `page.tsx` imports from `@/db` or `drizzle-orm` directly — pages must delegate to a server loader.
4. A `"use server"` module exports anything other than directly declared `async` functions (no re-exports, consts, classes, or type-only value exports).

Keep these invariants in mind before moving code; run `bun test lib/architecture/server-boundaries.test.ts` after restructuring.

### Server Action contract

Every Server Action returns `ActionResponse<T>` from `lib/types/action-response.ts`: `{ success: true, data }` or `{ success: false, error: { code, message, details? } }` where `code` is one of `UNAUTHORIZED | FORBIDDEN | CONFLICT | VALIDATION_ERROR | INSUFFICIENT_FUNDS | TRANSACTION_FAILED | NOT_FOUND | INTERNAL_SERVER_ERROR`. See `docs/06-technical/API_ACTIONS.md`.

Read the session via `getServerSession()` / `requireServerSession()` in `lib/server/session.ts`, then enforce RBAC with `lib/auth/permissions.ts`. Never trust client-provided user IDs or role claims.

## Finance and Data Integrity Guardrails

Follow `AGENTS.md`, `docs/06-technical/ARCHITECTURE.md`, and `docs/04-data/DATABASE_SCHEMA.md` for financial flows.

- Use Drizzle query builders/relational queries in application code. Raw SQL is for migrations only.
- Every balance-changing operation runs inside `db.transaction(...)` and writes both a `cash_transaction` ledger entry and an `audit_log` entry. Use the helpers in `lib/finance/balance-mutation.ts` rather than hand-rolling balance math.
- Option A ledger model: lock the `bank_account` row pessimistically, verify funds for cash-out, update the balance, assert exactly one row changed, then write immutable ledger/audit records.
- Money is `numeric(15, 2)` in Postgres. In TypeScript, convert to `bigint` cents with `parseNumericToCents` / `fromCents` for arithmetic — never use floats for money.
- Reconciled `cash_transaction` rows are immutable (`checkReconciledTransaction` guards this). Corrections are compensating reversal/journal entries with audit notes.
- Stock-changing actions also run in a transaction and write `stock_movement` + `audit_log`. Reservation and usage do not by themselves create cash transactions.
- PM/Designer access is project-scoped; Owner and Finance Admin have global financial access (`docs/06-technical/AUTH_AND_PERMISSION.md`). Owner approval is required for field/vendor payments ≥ Rp 5,000,000 and any over-budget override.
- Settings is the source of truth for budget allocation defaults, expense categories, item/price library, and material master. Code constants are seed/fallback only.

## Validation and Types

- Strict TypeScript, no `any`. Explicit argument and return types; avoid assertions outside untyped third-party boundaries.
- Validate every Server Action input with Zod (schemas in `lib/validations/`) before business logic, matching Drizzle/Postgres constraints: UUIDs, lengths, numeric bounds, enums from `docs/04-data/STATUS_ENUMS.md`.

## UI/UX Direction

Mobile-first for field PMs; should feel like a premium native iOS-style WebView.

- **Load `.agents/skills/atria-ui-ux/SKILL.md` before planning, implementing, styling, redesigning, auditing, or reviewing any UI** (`.claude/skills/atria-ui-ux` is a symlink to it). Follow its references, motion decision, and verification workflow.
- `docs/05-ui-ux/MAIN_SURFACE_DESIGN_LANGUAGE.md` is the active page-design source of truth; `docs/05-ui-ux/CONTROL_LANGUAGE.md` governs inputs, buttons, focus rings, and shadow tokens.
- Dashboard (`/ledger`) and Expenses (`/expenses`) are the reference implementations. Reuse their grammar and shared primitives; do not copy either layout blindly.
- The fixed `max-w-md` shell stays one column at every viewport. Verify 320, 360, 390, and 430 px — a desktop preview is not acceptance evidence.
- One justified focal summary, concise section headers, grouped surfaces with dividers, purpose-built rows, restrained status. Do not make every row a card, and do not repeat progress bars across sections.
- Use shared `MoneyValue` formatting with tabular numerals; primary amounts must not wrap. Use shared `SegmentedTabs` for peer views/filters — changing a tab must not move the reading position.
- Every main route needs a structural skeleton in `loading.tsx` matching its final hierarchy; no generic centered spinners.
- Compact controls with a 48×48 px effective touch target, keyboard focus, SR labels, safe-area clearance, reduced-motion support. Status needs copy + icon/shape, not color alone.
- Use only semantic tokens from `app/globals.css` (Tailwind v4 `@theme`) — no warm neutral hex, raw gray utilities, arbitrary shadows, `ring-black/*`, or component-local focus-ring colors. Preserve identity surfaces such as bank account gradients.
- All animation goes through Framer Motion presets in `lib/utils/motion.ts` (`slideUpDrawerVariants`, `fadeVariants`, `transitionSpringSmooth/Snappy/Bouncy`, `transitionEaseSmooth`). No ad-hoc springs or inline keyframes.
- Tailwind class order is linted (`eslint-plugin-tailwind-canonical-classes`); run `bun run tailwind:format` after significant class edits.

## Documentation Map to Read Before Work

- Product scope and MVP: `docs/01-product/PRD.md`, `docs/02-product/MVP_BLUEPRINT.md`
- Financial workflows: `docs/03-flows/FLOWS.md`
- Data model and statuses: `docs/04-data/DATABASE_SCHEMA.md`, `docs/04-data/STATUS_ENUMS.md`, `docs/04-data/SEED_DATA.md`
- UI/UX: `docs/05-ui-ux/MAIN_SURFACE_DESIGN_LANGUAGE.md`, `CONTROL_LANGUAGE.md`, `MOBILE_FIRST_UI_UX.md`, `IOS26_SOLID_DESIGN_SYSTEM.md`
- Technical: `docs/06-technical/ARCHITECTURE.md`, `AUTH_AND_PERMISSION.md`, `API_ACTIONS.md`, `AI_AGENT_ARCHITECTURE.md`
- Build order and roadmap: `docs/07-development/IMPLEMENTATION_ORDER.md`, `ROADMAP.md`, `TASK_BREAKDOWN.md`
- Manual verification: `docs/guide/seeded_demo_walkthrough.md` (seeded sandbox), `docs/guide/financial_workflow_guide.md` (empty-DB UAT)

## Agent Workflow Requirements

From `AGENTS.md`:

- Read existing schema, actions, docs, and UI before changing code.
- Before major executable changes, write or update a plan under `docs/plans/YYYY-MM-DD-<feature-name>.md`.
- Do not leave `TODO`, `TBD`, or incomplete statements in implemented functions, schemas, or actions.
- Introduce schema changes additively; preserve legacy `project_budget`, `project_budget_item`, and `project_cost` compatibility until reads, writes, tests, approvals, and dashboards are migrated. The field expense table is `project_cost` — there is no `field_request` table.
- AI may analyze, summarize, and prefill, but must not mutate finance/material records without explicit human approval, must not generate or execute SQL, and must not leak internal RAP cost/margin/vendor notes into client-facing RAB output.
