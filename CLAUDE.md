# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Atria ERP is Dekoria's finance-first, mobile-first internal ERP for interior design/build projects. It centers on project budgets by expense category, cash/bank ledger integrity, field expense approvals, RAP/RAB planning, material stock visibility, and margin risk — not generic HR or PM modules. Product/technical specs live under `docs/`; executable code and active guides take precedence over historical implementation plans in `docs/plans/`.

Stack: Hono + Bun backend, Expo native client, Next.js App Router (v16) with React 19, TypeScript (strict), Neon PostgreSQL + Drizzle ORM, Better Auth, Tailwind v4, Framer Motion, ImageKit uploads, Gemini (`@google/genai`) receipt OCR, Vercel AI SDK v7 with DeepSeek V4 Flash (primary) and Gemini 3.7 Flash (fallback) for the AI chat agent.

AI CFO/financial briefing remains deferred **from the Dashboard** — no AI card, summary, or briefing entry point belongs on `/ledger` or any route surface. AI is reachable only through the chat button in the header (`features/ai-chat/`), which answers questions from live data via read-only tools. See `docs/plans/2026-08-14-ai-agent-chat.md` and `docs/06-technical/AI_AGENT_ARCHITECTURE.md`.

User-facing copy and much of the domain-code commenting are Bahasa Indonesia. Match the surrounding language when editing.

## Workspace and backend ownership

Read `AGENTS.md` for current workspace rules and `docs/06-technical/ARCHITECTURE.md` for transport boundaries. `apps/api` owns Hono/Bun, database, Better Auth, business transactions, AI and jobs. `apps/web` owns Next rendering and typed HTTP facades; `apps/mobile` is Expo. `packages/core` remains pure shared data/validation/calculation code.

API source uses `@backend/*` under `apps/api/src/backend`; web `@/*` points into `apps/web`. Web-facing action signatures are compatibility interfaces, not locations for new business logic. Add API operations/procedures and keep the web layer as an HTTP caller. API contract exports are declaration-only; a client cannot import its runtime.

## Commands and tests

Use root workspace scripts from `package.json`. `bun run dev:mobile` starts API + Metro, `dev:api` starts API alone, and `dev:web` starts Next. Local native API and browser destinations use separate URLs. Read `docs/guide/mobile-api-development.md` for environment ownership, type generation, Docker and operator tooling.

Use `bun run test`, `bun run lint`, and `bun run build` at root. Never run bare root `bun test`: apps have their own preloads. Single backend tests run from `apps/api`; single presentation tests run from `apps/web`. Domain tests moved with their implementations. The API test preload refuses the development DB; Postgres integration tests require disposable `ATRIA_TEST_DATABASE_URL`, or `ATRIA_TEST_EMPTY_DATABASE_URL` for migrated-but-empty loader fixtures. These suites write to fixtures and do not fully restore them. PGlite subprocess tests exercise HTTP auth, finance, RBAC and invariants without a live database.

## Architecture checks

API and web architecture tests enforce framework/database separation, scoped role authority, finance/stock guardrails and the sanctioned route allowlist. Run both apps' boundary suites after structural changes. Web Server Actions are declared async forwarding functions; the private API web bridge has a fixed operation allowlist and a transport credential. It resolves user authorization from forwarded cookies/bearer tokens. Native tRPC uses the same backend use-cases. No transaction crosses an HTTP boundary.

Web auth, tRPC, AI chat, notification stream, job and private media handlers are explicit HTTP forwarding adapters. Private media uses a two-minute session-bound upload ticket for direct API upload (avoiding frontend function body limits), and authenticated byte delivery from registered project/user-owned ImageKit files. The web media adapter performs no storage, authorization or domain mutation itself. UI layout/loading/error boundaries remain web-owned. Portable backend screen loaders return data/status and use portable redirect controls where the legacy contract requires them. API background notification effects start after COMMIT; durable outbox recovery remains independent of the web process.

For hosted pilot setup, provider approval, cutoff data, backup/restore and cold-start acceptance, use `docs/guide/free-boss-pilot.md`. Production AI requires approved providers; Gemini confidential-data approval requires a paid project.

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

## Desktop Dashboard read adapter

`GET /api/finance/dashboard-desktop` is sanctioned only for the two typed desktop table/cashflow reads. It validates bounded inputs and delegates to the independent API's session, permission, tenant and reporting use-cases. It contains no database/business mutation and cannot forward arbitrary operation names. Using GET prevents late Server Action Flight responses from resetting client-managed Dashboard tab/filter URLs. Keep the native/mobile snapshot and mutation transports unchanged; update the web route allowlist alongside this boundary. See `docs/plans/2026-10-10-desktop-dashboard-redesign.md`.

## Notification scheduler HTTP exception

`POST /api/internal/notifications` is the deployment-neutral hourly notification reconciliation entrypoint. A scheduler cannot call a browser Server Action, so this handler is explicitly allowed alongside auth, AI chat and tRPC. It requires the server-only `NOTIFICATION_JOB_SECRET` bearer credential, uses a database execution lock, and changes notification state only. Do not add public CRUD routes under this exception. For deployment, retry behavior and retention, read `docs/guide/notifications.md`.
