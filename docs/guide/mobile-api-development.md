# Mobile development with the independent API

Run commands from the repository root. Configure backend secrets and `DATABASE_URL`
in `apps/api/.env`; configure public client URLs in `apps/mobile/.env` using the
corresponding `.env.example` files. Never put backend secrets in `EXPO_PUBLIC_*`.

For one-terminal API/client combinations and checkout-scoped shutdown, use [development presets](development-presets.md). `dev:mobile` now uses that registered supervisor; preset web fallback defaults to port3003.

```sh
bun install
bun run dev:mobile
```

`dev:mobile` starts the API on port 3001 and Expo Metro on port 8081. It does not
start Next.js. Ctrl-C stops both process trees; if either service fails, its
companion stops too. Open the existing iOS development build or Expo client after
Metro starts. Do not use `--localhost` for Metro on this Mac: the previous
simulator verification found an IPv6-only binding issue with that flag.

The native client uses `EXPO_PUBLIC_API_URL` for Better Auth and tRPC. In
development, leaving it empty derives the reachable Metro hostname with port 3001. A physical device must use the Mac's LAN address, not `localhost`. An
explicit URL may also point to a remote development API, allowing Metro to run
alone with `bun run dev:expo`.

`EXPO_PUBLIC_WEB_URL` is separate and only supplies browser destinations for
features that have not moved to native. Plain `dev:expo` with this value empty
uses Metro's hostname with port3000; registered presets explicitly supply the
LAN hostname with their configured web port (3003 by default). When adding web
to the default mobile/API preset, start it separately on that same port:

```sh
bun run --cwd apps/web dev:preset --hostname 0.0.0.0 --port 3003
```

The browser uses its own cookie session. Native login stays in SecureStore and
uses bearer authentication; opening a web feature may require browser login.
Starting web is optional for native flows. Both client URLs must be explicitly
configured for release builds; opening web features requires a reachable web
frontend. Changing client environment values requires restarting Metro.

For separate terminals, use `bun run dev:api` and `bun run dev:expo`. API data and
database scripts now belong to `@atria/api`; root `db:*` commands forward there.

Mobile imports only the generated `AppRouter` type from `@atria/api/contract`.
`bun run --cwd apps/mobile typecheck` regenerates API declarations first.
Runtime imports of API implementation and all web app imports are prohibited.

```sh
bun run test:dev-scripts
bun run --cwd apps/mobile test src/lib/runtime-url.test.ts
bun run --cwd apps/mobile typecheck
bun run build:mobile
```

`bun run build` builds API, web, standalone admin, and native client bundles in that order.
`bun run test` and `bun run lint` include every workspace. Native bundle exports
land in `apps/mobile/dist/ios` and `apps/mobile/dist/android`; native app-store
binaries still use the existing Expo native build workflow.

Notification scheduler configuration belongs to the API Worker: delivery fallback every 30 minutes and daily recovery at 00:00 WIB. Set `ATRIA_API_URL` explicitly. Web has no scheduled jobs; deployment of the API/Worker remains a separate action.

`ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED` is a nonsecret development presentation flag shared by API and web so temporary-password simulation gates agree. It is disabled in production regardless of its value.
