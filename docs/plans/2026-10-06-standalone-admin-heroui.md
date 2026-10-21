# Standalone Atria Admin — HeroUI

Date: 2026-10-06
Status: superseded by the approved unified responsive web direction in `2026-10-06-unified-responsive-web.md`. The compact standalone slice was reviewed positively; its useful presentation/state work will be reused. Keep this record as implementation history, not the current target architecture.

## Confirmed decisions

- Create `apps/admin`, a separate Next.js frontend in the same Bun monorepo, with native HeroUI v3 components/styles and compact desktop density. It owns its UI and stylesheet, with no imports from `apps/web` UI or inherited 48px/capsule/mobile styling.
- Reuse `apps/api` backend, account database, RBAC/project scope and authoritative operations; keep pure calculations, DTOs and Zod schemas in `packages/core`. Use declaration-only API contracts.
- Use an independent configurable admin origin and its own browser session with the same accounts. Keep same-origin auth/transport forwarding in each frontend; explicitly trust the admin origin in API configuration.
- Enter Admin manually. Web keeps its existing presentation until final cutover, then becomes mobile presentation at all widths with a Buka Admin link. Resize never navigates or discards drafts.
- Final target is parity with every existing workflow. Complete shell/login + Proyek/Budget first and let the user review the actual working UI before implementing remaining modules.
- Remove the old desktop renderer, UI adapters, preference/auto-entry and scoped Hero stylesheet only after full replacement parity and acceptance. Preserve safe redirects for old `/admin/**` deep links, canonical notification destinations and native fallback behavior.
- Retain stable `use:desktop_admin` permission/grants and domain checks. No reset, rollback, new bulk workflows or duplicated finance/material calculation.

## Phase 1 implementation

1. Extract reusable typed HTTP transport to `packages/api-client`; retain app-specific Next session/cookie/navigation/invalidation adapters. Preserve no-store, structured errors, no mutation retries, trusted cookie forwarding and server-only bridge secrets.
2. Scaffold `apps/admin` with pinned compatible Next/React/HeroUI, app-specific environment examples, root dev/build/start/test/lint/typecheck integration and operator documentation. Preserve all pre-existing local work.
3. Build a compact HeroUI-native shell, sign-in/session/temporary-password gates, restricted/error/loading states, keyboard navigation, profile/logout and manual links between apps.
4. Build real project list/create/edit + project detail and Project Budget workflow using existing API operations and domain permission/scoping. Surface project value, consumed/paid/remaining, category usage and margin risk with server-authoritative DTOs. Keep draft validation and explicit confirmation for mutations.
5. Verify contract/unit/UI integration tests, isolated mutation scenarios only when a disposable test DB is configured, root typecheck/test/lint/build/style/format checks and desktop 1024/1280/1440 plus existing mobile regression. No development DB mutations.
6. Present the working Proyek/Budget admin for user review. Keep future module parity/removal as outstanding work; do not claim complete migration.

## Parity sequence after phase 1 review

- Finance: expense/OCR, vendor bills, approvals, client invoices/payments, accounts/transfers, reconciliation and project closing.
- Project/material: RAP/RAB, Tukang/Subcon packages, revisions/change orders, material master, inventory/movements and import.
- Administration: Settings/defaults/library/templates, users/roles, onboarding, notifications/profile and AI existing workflows.
- Final acceptance/cutover: canonical URL compatibility, grant/revoke/custom project scopes, auth/onboarding, keyboard/overlays, freshness/draft preservation and mobile CSS regression. Remove old desktop implementation and update historical guides to superseded status.

## Design contract

Mode: Operate. The user pinned HeroUI default styling; use native size/variant props and semantic theme tokens with a dense project table and full-page budget editor. Do not invent a replacement mobile design system or use large mobile wrappers. Reuse pure money/business-label semantics through local admin public UI; new UI ownership lives in `apps/admin/components/ui`.

## Validation record

- Standalone admin shell/auth/account and typed Project/Budget reads/actions are implemented, with native HeroUI controls and independent admin cookie namespace.
- Root workspace tests: 1,706 pass, zero failures; 164 API cases requiring a disposable database are skipped. TypeScript, lint, all four application builds, legacy scoped-style drift and targeted formatting/diff checks pass.
- Repository-wide format check still reports 123 existing files; changed admin/shared-client/docs files pass the scoped check.
- Browser fixture verification exercised real Next proxy/facades/actions: login/logout isolation, desktop grant denial, table selection, project create review/commit, budget allocation review/commit and dirty draft preservation across 1024/1280/1440/390 resize. The fake API performs only in-memory synthetic changes and is not imported by app routes.
- Existing web login verified at 320/360/390/430: no overflow, Manrope and 48px mobile control remain. Full authenticated mobile workflow verification is still part of final cutover acceptance.
- Independent finish review: `ship`; dirty/pending link/logout navigation fix resolved. Native browser history traversal remains native, so that route-leaving edge case requires further acceptance before full cutover.
- Native HeroUI design recorded in `apps/admin/DESIGN.md` and its local sidecar. Detector ran once with the explicit standalone design boundary: zero findings.
- No database resets, account grants, finance or stock mutations, production deploys, or old desktop deletion were performed.
- Review preview: loopback fixture API3301 + admin3302, synthetic account `owner@atria.test` / `FixtureAdmin123!`. Normal app startup is API3001 + admin3002. Remaining workflow parity and old desktop removal are outstanding.
