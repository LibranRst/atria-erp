# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Atria ERP is Dekoria's finance-first, mobile-first internal ERP for interior design/build projects. It centers on project budgets by expense category, cash/bank ledger integrity, field expense approvals, RAP/RAB planning, material stock visibility, and margin risk — not generic HR or PM modules. Product/technical specs live under `docs/`; executable code and active guides take precedence over historical implementation plans in `docs/plans/`.

Stack: Bun, Next.js App Router (v16) with React 19, TypeScript (strict), Neon PostgreSQL + Drizzle ORM, Better Auth, Tailwind v4, Framer Motion, ImageKit uploads, Gemini (`@google/genai`) receipt OCR, Vercel AI SDK v7 with DeepSeek V4 Flash (primary) and Gemini 3.7 Flash (fallback) for the AI chat agent.

AI CFO/financial briefing remains deferred **from the Dashboard** — no AI card, summary, or briefing entry point belongs on `/ledger` or any route surface. AI is reachable only through the chat button in the header (`features/ai-chat/`), which answers questions from live data via read-only tools. See `docs/plans/2026-08-14-ai-agent-chat.md` and `docs/06-technical/AI_AGENT_ARCHITECTURE.md`.

User-facing copy and much of the domain-code commenting are Bahasa Indonesia. Match the surrounding language when editing.

## Workspace Layout

This is a **Bun workspace monorepo**. The Next.js app is `apps/web/`; the repo root holds only workspace config, `docs/`, and the top-level `*.md` files. Root `package.json` declares `"workspaces": ["apps/*", "packages/*"]`, and every root script fans out with `bun --filter`.

A cross-platform Expo client (`apps/mobile/`) and shared packages (`packages/core`, `packages/tokens`) are being added — see `docs/plans/2026-08-15-expo-cross-platform-migration.md` for the plan and `docs/plans/2026-08-15-expo-migration-handoff.md` for current progress. Until those exist, `apps/web` is the only package.

## Common Commands

Bun is the package manager/runtime; `bun.lock` is committed. `pnpm` is not used — do not reintroduce a pnpm lockfile.

Run these from the **repo root**:

```bash
bun install
bun run dev            # Next dev server with localhost + LAN host (apps/web/scripts/dev-lan.mjs)
bun run dev:default    # plain `next dev`
bun run build
bun run test           # whole suite, via `bun --filter '*' test`
bun run lint           # eslint
bun run lint:fix
bun run format         # prettier --write .
bun run tailwind:format  # canonical Tailwind class order (eslint --fix) + prettier
```

Tests are Bun Test, colocated next to the code they cover (`lib/**`, `app/actions/**`, `components/**`, `db/seed/**`).

**Never run a bare `bun test` from the repo root.** `bunfig.toml` lives in `apps/web/` and is loaded from the current working directory; without it the `mock.module("server-only")` preload is missing and every `features/**/server/*.test.ts` fails. Use the root `bun run test`, or `cd apps/web` first:

```bash
cd apps/web && bun test                                # whole suite
cd apps/web && bun test lib/finance/dashboard.test.ts  # single file
cd apps/web && bun test lib/architecture/              # boundary tests
cd apps/web && bun test --test-name-pattern "reconcile"
```

**`bun run test` never touches Postgres.** Eighteen suites call real Server Actions against seeded fixtures; they are gated behind `describeIntegration` (`lib/testing/integration-db.ts`) and skip unless `ATRIA_TEST_DATABASE_URL` is set. `scripts/test-preload.ts` also repoints `DATABASE_URL` at a dead address when no test-database variable is set, so a DB test that forgets the gate fails loudly instead of silently mutating development data. Baseline is **551 pass + 135 skip** (170 core + 381 web); those 120 are gated, not broken. Point `ATRIA_TEST_DATABASE_URL` only at a disposable `db:demo:reset` database — the suites write to seed fixtures and do not fully restore them. See `docs/plans/2026-08-17-test-database-isolation.md`.

A second gate, `describeEmptyIntegration` / `ATRIA_TEST_EMPTY_DATABASE_URL`, serves the opposite need: `lib/testing/empty-database-loaders.integration.test.ts` proves every main route's loader survives a migrated-but-unseeded database — the state `docs/guide/financial_workflow_guide.md` starts from. Point it at a migrated empty database, never at the demo one; the two requirements contradict each other, so only one is ever set at a time.

Database scripts (all destructive ones require `--confirm-reset`):

```bash
bun run db:seed              # insert-only; refuses a non-empty or production DB
bun run db:reset             # empty DB for production-style UAT
bun run db:demo:reset        # connected demo dataset + CSV fixtures in apps/web/.atria-demo/
bun run db:demo:verify
```

`.env` and `.env.example` live in `apps/web/`, next to the code that reads them. Drizzle migrations live in `apps/web/drizzle/`; config is `apps/web/drizzle.config.ts`. Check `package.json` before running any script — do not infer commands from docs.

## Architecture

Layering runs database → auth/RBAC → transaction helpers → Server Actions → UI. Read-only data fetching happens in Server Components; Client Components are for interaction, local state, animation, camera/upload, and forms. All mutations are Server Actions — no internal REST endpoints for mutations. The set of API routes is closed and **enforced by an allowlist assertion** in `lib/architecture/server-boundaries.test.ts`, not by prose. Two exist today: Better Auth at `app/api/auth/[...better-auth]/route.ts`, and the AI chat stream at `app/api/ai/chat/route.ts`. The AI chat route is a deliberate, bounded exception because `useChat` needs an HTTP transport for token streaming; it is read-only (every tool exposed to the model is read-only, enforced by `lib/ai/tools/read-only.test.ts`) and verifies session plus `use:ai_chat` before doing anything. Do not add write capability to it.

A third route, `app/api/trpc/[trpc]/route.ts`, is planned as the bridge for the native client — React Native cannot invoke Server Actions. It is bounded the same way: it may only expose procedures that delegate to use-cases in `apps/web/server/usecases/**`, it never contains business logic or touches Drizzle directly, and every mutation goes through the same use-case its Server Action counterpart calls. Adding it means updating the allowlist assertion deliberately. Do not add a fourth.

Three source roots inside `apps/web/`, with enforced boundaries:

- `app/` — routes, layouts, `loading.tsx` skeletons, `error.tsx`, and `app/actions/**` (the `"use server"` modules, grouped by domain: `finance/`, `project/`, `material/`, `settings/`, `ai/`, `media/`, plus onboarding/administration/activity-detail families).
- `features/<domain>/` — feature slices with `components/`, `hooks/`, `server/`, `types/`, `utils/`. Domains: activity-detail, administration, approvals, expenses, finance-dashboard, materials, onboarding, profile, projects, reconciliation, settings. `projects` nests `detail/`, `list/`, and `shared/` sub-slices that each follow the same shape. A slice holds one domain; anything cross-cutting belongs in `lib/` or `components/ui`.
- `lib/` — cross-cutting domain logic and pure helpers (`lib/finance`, `lib/project`, `lib/material`, `lib/validations` Zod schemas, `lib/auth` permissions, `lib/server/session.ts`, `lib/hooks/` shared React hooks, `lib/utils/{money,date,motion,cn}.ts`, `lib/types/`).
- `components/ui/**` and `components/layout/**` — shared primitives and the mobile shell/bottom nav. Application code imports shared UI from the `@/components/ui` barrel only; deep paths stay inside `components/ui/**`.
- `db/` — `db/index.ts` client, `db/schema/{auth,projects,finance,materials,system}.ts` re-exported from `db/schema.ts`, seed under `db/seed/`.

All paths above are relative to `apps/web/`, and the `@/*` alias resolves there — so `@/db`, `@/lib/finance`, and `@/components/ui` are unchanged from before the monorepo move.

`apps/web/lib/architecture/` holds executable architecture tests that fail the build-time suite. They anchor on `import.meta.dir`, not `process.cwd()`, so they behave identically no matter where they are invoked from.

`server-boundaries.test.ts` fails when:

1. A `features/<domain>/actions/` folder exists (server entrypoints belong in `app/actions/`).
2. A file under `features/**/server/**` does not start with `import "server-only";`.
3. A file under `server/**` does not start with `import "server-only";` — the use-case/tRPC layer.
4. Any route `page.tsx` imports from `@/db` or `drizzle-orm` directly — pages must delegate to a server loader.
5. A `"use server"` module exports anything other than directly declared `async` functions (no re-exports, consts, classes, or type-only value exports). This is what forces the thin-wrapper pattern: a Server Action may call a use-case, but may not `export { x } from "..."` it.
6. `app/api/**` contains any `route.ts` outside the sanctioned allowlist. Adding one is a design decision, so the list is asserted explicitly rather than left to prose.

`ui-import-boundaries.test.ts` fails when application code imports a deep `@/components/ui/**` path instead of the barrel, when a feature re-exports a shared primitive as if it owned it, or when consumer code recreates overlay infrastructure with portals, Floating UI, or modal semantics. It covers `apps/web` only — `apps/mobile` has its own primitive library and uses neither the barrel nor Tailwind.

`feature-boundaries.test.ts` fails when a slice depends on another slice that the allowed-edge list in that file does not declare, when a declared edge no longer exists, or when a `shared-*` pseudo-domain reappears under `features/`. Adding an edge is a design decision: if three or more slices need the same thing, move it to `lib/`, `components/ui`, or `packages/core` instead.

Keep these invariants in mind before moving code; run `cd apps/web && bun test lib/architecture/` after restructuring.

### Server Action contract

Every Server Action returns `ActionResponse<T>` from `lib/types/action-response.ts`: `{ success: true, data }` or `{ success: false, error: { code, message, details? } }` where `code` is one of `UNAUTHORIZED | FORBIDDEN | CONFLICT | VALIDATION_ERROR | INSUFFICIENT_FUNDS | TRANSACTION_FAILED | NOT_FOUND | INTERNAL_SERVER_ERROR`. See `docs/06-technical/API_ACTIONS.md`.

Read the session via `getServerSession()` / `requireServerSession()` in `lib/server/session.ts`, then enforce RBAC with `lib/auth/permissions.ts`. Never trust client-provided user IDs or role claims.

## Finance and Data Integrity Guardrails

Follow `AGENTS.md`, `docs/06-technical/ARCHITECTURE.md`, and `docs/04-data/DATABASE_SCHEMA.md` for financial flows.

- Use Drizzle query builders/relational queries in application code. Raw SQL is for migrations only.
- Every balance-changing operation runs inside `db.transaction(...)` and writes both a `cash_transaction` ledger entry and an `audit_log` entry. Use the helpers in `lib/finance/balance-mutation.ts` rather than hand-rolling balance math.
- Option A ledger model: lock the `bank_account` row pessimistically, verify funds for cash-out, update the balance, assert exactly one row changed, then write immutable ledger/audit records.
- Money is `numeric(15, 2)` in Postgres. In TypeScript, convert to `bigint` cents with `parseNumericToCents` / `fromCents` for arithmetic — never use floats for money.
- Reconciled `cash_transaction` rows are immutable. There is no edit or delete path — the ledger is append-only by construction, and the only writes to an existing row are the three reconciliation actions in `app/actions/finance/reconcile-cash-transaction.ts` (`reconcileCashTransaction`, `markReconciliationException`, `clearReconciliationException`). Each selects the row `.for("update")` and rejects with `CASH_TRANSACTION_ALREADY_RECONCILED` if `reconciled` is already true; keep that guard inside the lock in any new write path. Corrections are compensating reversal/journal entries with audit notes.
- Stock-changing actions also run in a transaction and write `stock_movement` + `audit_log`. Reservation and usage do not by themselves create cash transactions.
- PM/Designer access is project-scoped; Owner and Finance Admin have global financial access (`docs/06-technical/AUTH_AND_PERMISSION.md`). Owner approval is required for field/vendor payments ≥ Rp 5,000,000 and any over-budget override.
- Settings is the source of truth for budget allocation defaults, expense categories, item/price library, and material master. Code constants are seed/fallback only.

## Validation and Types

- Strict TypeScript, no `any`. Explicit argument and return types; avoid assertions outside untyped third-party boundaries.
- Validate every Server Action input with Zod (schemas in `lib/validations/`) before business logic, matching Drizzle/Postgres constraints: UUIDs, lengths, numeric bounds, enums from `docs/04-data/STATUS_ENUMS.md`.

## UI/UX Direction

Mobile-first for field PMs; should feel like a premium native iOS-style WebView.

- **Use the Impeccable skill for any UI/UX planning, implementation, styling, redesigning, auditing, or reviewing work.** `PRODUCT.md` and `DESIGN.md` at the repo root are the source of truth for product context and the visual design system ("The Quiet Command Center" — calm ink-and-terracotta, flat tonal layering, capsule controls, no glass/gradients/decorative motion); `.impeccable/design.json` is the machine-readable sidecar. Read all three before a UI decision, and inspect the live implementation rather than relying on old plans or screenshots.
- **Use `.agents/rules/05-shared-ui-first.md` before adding a component.** Inspect `apps/web/components/ui/index.ts`, relevant stories/tests, and production call sites; reuse first, extend or compose second, and create a primitive only when the existing interaction contract is materially insufficient. Do not implement local portal, dialog, sheet, select, popover, tooltip, focus, dismissal, money, motion, or touch-target infrastructure. The handoff must name the primitive reused/extended or justify the new primitive.
- Dashboard (`/ledger`, all tabs — Ringkasan, Persetujuan, Budget, Jatuh Tempo, Rekening, Material) is the current approved reference implementation. Reuse its grammar and shared primitives (`components/ui/feedback/*`, `FormSection`, `OperationalFormSheet`/`WorkflowFormSheet`, `SegmentedTabs`, `DuotoneIconTile`, `AppIcon`); do not copy its layout blindly. Expenses and every other route are mid-rollout to this same visual language one review gate at a time — check `docs/plans/2026-08-04-calm-modern-luxury-redesign.md` for what's approved before treating any other route as a reference.
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
- UI/UX: `PRODUCT.md`, `DESIGN.md`, and `.impeccable/design.json` (repo-root Impeccable design-system record)
- Technical: `docs/06-technical/ARCHITECTURE.md`, `AUTH_AND_PERMISSION.md`, `API_ACTIONS.md`, `AI_AGENT_ARCHITECTURE.md`
- Build order and roadmap: `docs/07-development/IMPLEMENTATION_ORDER.md`, `ROADMAP.md`, `TASK_BREAKDOWN.md`
- Manual verification: `docs/guide/seeded_demo_walkthrough.md` (seeded sandbox), `docs/guide/financial_workflow_guide.md` (empty-DB UAT)
- Selling and launching: `docs/bisnis/` — standalone HTML, outside the `DESIGN.md` system on purpose; `peluncuran-atria.html` is the open task/decision list, `bekal-bisnis-atria.html` the commercial background

## Agent Workflow Requirements

From `AGENTS.md`:

- Read existing schema, actions, docs, and UI before changing code.
- Before major executable changes, write or update a plan under `docs/plans/YYYY-MM-DD-<feature-name>.md`.
- Do not leave `TODO`, `TBD`, or incomplete statements in implemented functions, schemas, or actions.
- Introduce schema changes additively; preserve legacy `project_budget`, `project_budget_item`, and `project_cost` compatibility until reads, writes, tests, approvals, and dashboards are migrated. The field expense table is `project_cost` — there is no `field_request` table.
- AI may analyze, summarize, and prefill, but must not mutate finance/material records without explicit human approval, must not generate or execute SQL, and must not leak internal RAP cost/margin/vendor notes into client-facing RAB output.
