# Architecture

## Shape

Atria is a Bun workspace with three independently runnable applications. Hono + Bun (`apps/api`) owns backend execution and PostgreSQL through Drizzle. Next.js (`apps/web`) renders web views and forwards HTTP requests. Expo (`apps/mobile`) talks directly to the API. `packages/core` contains pure calculations, DTOs and Zod schemas shared by the clients and API.

The standalone Next.js client `apps/admin` is being introduced as the fourth application, with independent HeroUI desktop presentation and the same API/account database. Neutral typed HTTP transport belongs to `packages/api-client`; each Next frontend retains its own cookies/navigation/cache adapter. Admin entry is manual on its own origin; its production host-only cookie session is independent from web. `use:desktop_admin` gates entry while API operations retain domain permissions/project scope. Legacy web desktop stays until complete replacement acceptance; the first Proyek/Budget slice has a user review gate. See [the approved admin migration](../plans/2026-10-06-standalone-admin-heroui.md).

The API owns Better Auth, Actor construction, database-backed permissions/project scope, finance/material transactions, AI, notification streaming and background jobs. Its runtime imports contain neither Next.js, React nor web source modules. Web execution contains no database client, server Better Auth instance or backend business implementation.

## Transport and ownership

- Existing native procedures remain tRPC + SuperJSON at `/api/trpc`. `@atria/api/contract` exposes declaration-only `AppRouter`; client bundlers cannot load API runtime exports.
- Browser authentication remains same-origin through the web `/api/auth/**` forwarding route. The API preserves cookie and native bearer sessions. Web SSR/session helpers validate sessions through HTTP with `no-store`.
- Web Server Actions and feature loaders retain their original signatures as HTTP facades. An explicit allowlist at API `/api/internal/web-rpc` dispatches existing backend operations. This private compatibility route requires a dedicated `API_BRIDGE_SECRET` and derives authorization from forwarded user credentials; it cannot load arbitrary modules or execute supplied code. Actor-based loaders replace supplied Actors with the session's Actor.
- Auth, tRPC, AI chat, notification SSE and internal notification job routes in web are forwarding adapters. The private web bridge has no public web forwarding route. Headers, all `Set-Cookie` values, Expo token headers and cancellation are preserved.
- `/api/finance/dashboard-desktop` is a read-only web adapter for the two explicit desktop Dashboard reads. It validates bounded chart/table inputs and delegates through typed facades to API-owned session, permission, tenant and aggregation logic. It is not a generic compatibility bridge and exposes no operation selector or bridge secret. GET avoids late Server Action Flight payloads resetting client-managed Dashboard tab URLs; mutations and the mobile snapshot transport remain unchanged.
- Successful web mutations apply the API's path/layout invalidations. ActionResponse transport errors remain structured form errors, with no automatic mutation retries. Authenticated data and permission memoization are scoped to the current request.
- Finance/stock transactions remain whole inside the API. Notification commit effects are released only after successful COMMIT; background failure cannot change a committed business response. The durable outbox and external scheduler support recovery.

## Domain layers

API paths below are relative to `apps/api/src/backend/` and use `@backend/*`:

- Auth, Actor and permissions: `lib/auth.ts`, `lib/auth/*`, `server/actor.ts`.
- Database/schema: `db/*`; migration history and operator scripts belong to `apps/api/drizzle` and `apps/api/scripts`.
- Business operations: `app/actions/*`, `server/usecases/*`; the legacy action directory name describes compatibility, not a Next runtime dependency.
- Screen reads: `features/**/server/*`.
- Budget, finance and AI helpers: `lib/budget/*`, `lib/finance/*`, `lib/ai/*`.
- Native tRPC transport and web compatibility allowlist: `server/trpc/*`, `server/web-rpc/registry.ts`.
- Portable request context, navigation, revalidation and background dispatch: `apps/api/src/runtime/*`.

Web owns JSX/UI primitives, frontend navigation, cache invalidation and typed HTTP facades. Existing browser fallback features in mobile use a separate web URL. Mobile-only development starts API + Metro and no Next process; browser fallbacks still require an available web frontend.

For commands, local URL defaults, environment ownership and Docker setup, see [mobile/API development](../guide/mobile-api-development.md). For measured startup/resource evidence and its limits, see [backend performance](../guide/backend-performance.md).

## Existing Finance Spine

The ledger, bank account balance mutation helper, project budget, project costs, vendor bills, client payments, approvals, and audit logs are the foundation. Material-control features must integrate with this spine instead of replacing it.

## Settings Layer

Settings is the source of truth for defaults and master data:

- `budget_allocation_setting`
- `budget_allocation_setting_category`
- `expense_category`
- `item_price_library`
- Material Master and inventory defaults

Project Budget creation reads the active Budget Allocation Setting. Existing project budgets keep their own saved allocation unless edited directly.

## Canonical Budget Layer

The canonical budget layer models Dekoria's Project Budget Control workflow:

- `expense_category`
- `project_budgets`
- `project_budget_category`
- `project_expenses`
- `project_profitability_snapshot`

This layer powers Project Budget Setup, Expense Tracker by Category, Budget Dashboard, Category Usage, Remaining Budget, and Margin Visibility. Legacy `project_budget`, `project_budget_item`, and `project_cost` remain during migration so existing finance flows continue to work.

## Material-Control Extension

Material-control data adds:

- Material Master and categories.
- Inventory locations and stock balances.
- RAP internal material plan.
- Stock movements.
- Client-safe RAB estimates.

Stock movement is operational inventory state attached to the Material budget category. It does not replace category budget tracking or finance ledger entries. Finance cash movement remains in `cash_transaction`.

## Mutation Rules

- Finance balance changes use `mutateBalance`.
- Stock changes use dedicated material actions that update inventory, insert movement rows, and write audit logs inside one transaction.
- Expense/vendor bill flows must link to a budget category. They can optionally link to material, RAP item, and stock movement only when the category is Material.

## Client Safety

RAB estimate preview must be generated from a DTO that excludes internal cost, margin, markup, vendor note, and internal note.
