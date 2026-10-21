# Unified responsive web review

Atria now uses canonical web routes with one existing web session. At >=1024px every authenticated role gets desktop presentation; domain permissions and assigned-project scope continue to govern data/actions. Phone/native-pinned presentation keeps the mobile composition.

Start the ordinary app from the root:

```sh
bun run dev:stop
bun run dev:web-api
```

This uses the configured API/database and web at http://localhost:3003. Sign in with the existing Atria account. `dev:stop` is optional when no Atria development process is already running; it stops other Atria presets as documented in [development presets](development-presets.md).

The combined review focuses on shell, Dashboard, Proyek and Project Budget. Atria Manrope, ink/terracotta, cool surfaces, semantic money/status and motion remain. Fine-pointer desktop HeroUI controls are compact; mobile/coarse-pointer targets stay48px. Providers, route children and portal destinations remain stable on resize; focused control/overlay presentation is held until blur/close so active DOM and drafts survive.

Old /admin paths are compatibility bridges to ordinary routes, carrying IDs/query/hash. Native `surface=mobile` is only a layout hint and does not grant authorization. The old desktop presentation gate is retired; historical grant rows and migration records are preserved.

A synthetic review is running at http://127.0.0.1:3430/ledger against an isolated in-memory API at3441. Its fixture credentials are owner@atria.test / FixtureAdmin123!. These are test-only, unrelated to the configured real account database. Synthetic scenarios validate frontend transport/layout/control behavior, not live finance/stock invariants.

Current acceptance: desktop1024/1280/1440 and mobile320/360/390/430 no document overflow, selected-project retention, exact focused input/dialog/portal identity and draft preservation on resize, custom scoped role without desktop grant, native mobile pin, and legacy alias hashes. Independent review disposition is ship after one bounded fix batch. Full safe suite1,739pass/164skip, TypeScript/lint/webbuild/scopedstyles/token checks pass. Repository-wide format check retains123 existing failures; changed-file format/diff checks pass.

Remaining module visual acceptance and removal of standalone apps/admin/startup/origin/cookie tooling wait for the combined user review. Existing full workflows still run through web and the same API; this slice does not claim final standalone cleanup.
