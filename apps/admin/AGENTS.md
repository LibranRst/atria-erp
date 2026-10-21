# Standalone Admin

`apps/admin` is an independent Next.js presentation client for Owner and authorized administrative users. Backend operations, Better Auth, Drizzle, RBAC and project scope live in `apps/api`. Read the approved phase/review boundary in `docs/plans/2026-10-06-standalone-admin-heroui.md` before expanding scope.

## UI ownership

- Load the project Impeccable and HeroUI skills. This app's approved visual authority is native HeroUI v3 defaults, compact `sm`/`md` controls, semantic theme tokens and keyboard-first desktop operation. Consult `apps/admin/DESIGN.md` as the local system record.
- Import the full HeroUI stylesheet in this app document. Use HeroUI components and their built-in interaction contracts directly; repeated domain compositions and money/status presentation belong in the local `components/ui` inventory. Inspect that inventory before adding a primitive.
- Keep mobile UI and styles in `apps/web`/`apps/mobile`. This app owns its density, overlays, motion and theme; the legacy 48px/capsule/scoped-CSS rules do not apply here. Maintain accessible labels, keyboard focus, reduced motion and usable small-screen layouts.
- Use full-page editors for substantial Project Budget work. Maintain draft state on resize, show Indonesian mutation feedback, and preserve query/hash during navigation.

## Transport

- Share pure calculations/DTOs/Zod schemas through `@atria/core`, declaration-only contracts through `@atria/api/contract`, and neutral HTTP transport through `@atria/api-client`.
- Keep Next session/cookie/navigation/cache handling in this app's server adapter. Mutations forward current credentials to existing API operations, validate input, require explicit user action, and never retry automatically.
- Admin entry uses the stable `use:desktop_admin` permission; every domain operation still checks its own permission/project scope in the API.
- The independent admin origin uses the same account database and its own browser session. Same-origin auth/proxy endpoints keep bridge secrets server-only.

## Acceptance

Verify desktop 1024/1280/1440 and smaller screens without redirecting on resize; verify web/mobile regression separately. Run root workspace gates and app-specific tests using this app's Bun preload. Live mutation tests require a disposable database. Phase 1 ends with a working Proyek/Budget review; complete all later parity before removing old desktop code.
