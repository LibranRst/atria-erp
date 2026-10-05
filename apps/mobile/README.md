# Atria ERP mobile client

The Expo SDK 57 / React Native client talks to the standalone `@atria/api`
backend through tRPC and Better Auth. Native sessions remain in SecureStore;
mobile imports only the generated API contract types.

Run these commands from the monorepo root:

```sh
bun install
bun run dev:mobile
```

This starts API on port 3001 and Expo Metro on port 8081. It starts no Next.js
process. Backend secrets and database configuration belong in `apps/api/.env`.
Copy `apps/mobile/.env.example` to `apps/mobile/.env` for client overrides.
Development defaults derive the reachable API and web hosts from Metro.

`EXPO_PUBLIC_API_URL` points to the API. `EXPO_PUBLIC_WEB_URL` points to the web
frontend for features that still open in a browser. Start `bun run dev:web`
separately when testing one of those features locally. Browser and native login
keep separate sessions. Release builds need explicit service URLs.

To use a remote API, set the client URL and run `bun run dev:expo` for Metro
alone. Routes live in `src/app/`, with native UI and feature code under `src/`.

```sh
bun run --cwd apps/mobile typecheck
bun run --cwd apps/mobile lint
bun run --cwd apps/mobile test
bun run build:mobile
```

Typecheck regenerates API contract declarations first. The native bundle build
exports iOS and Android to `apps/mobile/dist/ios` and `apps/mobile/dist/android`.

See the [mobile development guide](../../docs/guide/mobile-api-development.md)
for simulator, LAN, separate-terminal, and process shutdown details.
