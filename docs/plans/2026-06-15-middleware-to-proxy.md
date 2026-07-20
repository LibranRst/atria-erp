# Implementation Plan: Next.js Middleware to Proxy Migration

## Context

Next.js 16 deprecates the root `middleware.ts` file convention in favor of `proxy.ts`. Current Next.js documentation says to rename the file and rename the exported `middleware` function to `proxy`. Proxy always runs on the Node.js runtime, so the former explicit `runtime: "nodejs"` config must be removed from the proxy file.

## Scope

- Replace the deprecated root `middleware.ts` convention with `proxy.ts`.
- Preserve the existing Better Auth session check, RBAC behavior for `/ledger`, redirect targets, and route matcher configuration.
- Avoid any database, finance, ledger, or permission model changes.

## Files

- [middleware.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/middleware.ts) - remove after migrating content.
- [proxy.ts](file:///Volumes/DekoriaSSD/App%20Projects/atria-erp/proxy.ts) - add migrated proxy implementation.

## Steps

1. Rename `middleware.ts` to `proxy.ts`.
2. Rename `export async function middleware(...)` to `export async function proxy(...)`.
3. Keep `export const config` with the existing `matcher` array unchanged and remove the obsolete `runtime: "nodejs"` field because proxy runtime cannot be configured.
4. Run a repository search to confirm no active source file still exports or references the deprecated root middleware convention.
5. Run lint or build verification to confirm Next.js no longer emits the middleware deprecation warning and the project still type-checks through the configured tooling.

## Verification

- `bun run lint`
- If lint is unavailable or insufficient, run `bun run build` and report any unrelated failures separately.

## Risks

- Documentation files still mention middleware as historical project docs; this plan does not rewrite them because the warning is caused by the executable root file convention, not documentation text.
- If Better Auth behavior changes under Next.js proxy runtime, verification may surface a runtime issue; no auth behavior changes are intended.
