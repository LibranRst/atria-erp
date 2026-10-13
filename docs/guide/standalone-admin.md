# Standalone Admin development

The approved admin migration is tracked in [the plan](../plans/2026-10-06-standalone-admin-heroui.md). `apps/admin` is an independent Next.js frontend with native HeroUI components/styles; it consumes the same API and account database as web and Expo. The first working Proyek/Budget slice is reviewed before the remaining workflows. Existing `/admin` stays available until full replacement acceptance.

## Local startup

For one-terminal combinations and stopping all Atria dev servers, use [development presets](development-presets.md): `bun run dev:admin-api`, `bun run dev:admin-web-api`, `bun run dev:all`, and `bun run dev:stop`. Preset web uses port3003; individual app commands below keep their existing defaults.

Configure `apps/api/.env` as described in [API development](mobile-api-development.md). Copy `apps/admin/.env.example` to `apps/admin/.env.local`, set `API_ORIGIN` to the API service and the same server-only `API_BRIDGE_SECRET` as the API. Add `ADMIN_ORIGIN=http://localhost:3002` to API configuration. Keep bridge secrets out of `NEXT_PUBLIC_*` variables.

From separate root terminals:

```sh
bun run dev:api
bun run dev:admin
```

The default admin address is `http://localhost:3002`. Web can be run separately with `bun run dev:web`. `bun run dev` continues to start the existing web app; starting admin is explicit.

The admin entry permission remains `use:desktop_admin`. An authorized user signs in with the existing account; API domain permissions and assigned-project scope apply to every operation. Admin cookies use an independent `atria-admin` namespace; the server adapter maps them to Better Auth's canonical cookie names for API requests. Web cookies are excluded from admin requests, and admin logout clears only admin cookies. This keeps sessions independent even when local apps use different ports on the same host. Production hosts also retain host-only cookies.

The admin frontend proxies auth at its own `/api/auth/**` and forwards server-side operations through the private typed compatibility bridge. `packages/api-client` owns transport/protocol validation; each Next app owns session/cookie/navigation/cache handling. No API runtime or web UI imports belong in admin bundles. Existing canonical notification destinations can be interpreted locally by each app.

## Verification

```sh
bun --filter @atria/admin typecheck
bun --filter @atria/admin test
bun --filter @atria/admin lint
bun run build:admin
bun run test
bun run lint
```

Root build includes all four applications. Admin imports the full HeroUI stylesheet in its own document; the legacy web scoped stylesheet tooling remains until cutover. Finance/material mutations in integration/browser scenarios require an explicitly disposable database; default tests must not mutate development or production data.

## Migration boundary

| Workflow                                                                                      | Phase                                |
| --------------------------------------------------------------------------------------------- | ------------------------------------ |
| Shell, sign-in, temporary password, access gates, account, projects and Project Budget        | First working review slice           |
| Expense/OCR, bills, approvals, invoices/payments, accounts/transfers, reconciliation, closing | Finance parity after review          |
| RAP/RAB, packages, revisions/change orders, material master, stock and movements/import       | Project/material parity after review |
| Settings/defaults/library/templates, users/roles, onboarding, notifications and AI existing   | Administration parity after review   |
| Old desktop renderer/adapters/preferences/scoped styles removal and old-link redirects        | After full parity and acceptance     |

During phase 1, onboarding can hand off explicitly to the existing Atria web workflow. That handoff is transitional and does not count as standalone onboarding parity. Old desktop code, role grants, migration history and existing finance/material records stay intact. A review-ready first slice is not a completed migration.
