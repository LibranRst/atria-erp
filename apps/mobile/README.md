# Paduna Build mobile client

The Expo SDK 57 / React Native client talks to the standalone `@atria/api`
backend through tRPC and Better Auth. Native sessions remain in SecureStore;
mobile imports only the generated API contract types.

The display identity is **Paduna Build**, with the primary **Paduna** wordmark
(no Build suffix) on login and launch screens. Canonical assets and decisions
live under `docs/brand/paduna/`. The Temu launcher icon uses white on terracotta;
Android layers and the iOS Icon Composer document use the same approved artwork.

Technical identities remain compatible: package `@atria/mobile`, slug
`atria-erp`, scheme `atria`, bundle ID `com.anonymous.atria-erp`, and the existing
native workspace/scheme `AtriaERP`. Branding does not rename these or change
auth, routing, database or financial/material behavior.

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

Changing the app name, launcher icon, splash or permission messages requires a
new native build; Metro reload alone does not replace installed app metadata.
The checked-in Expo assets/config remain the source of truth for regenerated
native projects. Local `ios/` files are ignored and were synchronized without
cleaning the existing workspace or custom native modules.

For the installed Xcode 27.1 / Swift 6.4 toolchain, the local iOS workspace uses
Expo modules built from source (`EXPO_USE_PRECOMPILED_MODULES=0 pod install`,
with `EXPO_USE_PRECOMPILED_MODULES: "false"` in `ios/Podfile.properties.json`).
This avoids importing Expo modules compiled with Swift 6.3.1. The narrow Bun
patch `patches/expo-modules-jsi@57.0.4.patch` also lets Expo's existing interface
cleanup recognize Swift 6.4's `__ObjC::` namespace syntax. It retains the
existing package version and the helper's intended C++ extension filtering.

See the [mobile development guide](../../docs/guide/mobile-api-development.md)
for simulator, LAN, separate-terminal, and process shutdown details.
