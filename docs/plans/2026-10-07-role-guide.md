# Panduan Peran untuk Pengguna Atria

Date: 2026-10-07
Status: implemented; development migration applied; feature verified on disposable PostgreSQL and responsive web

## Agreed experience

- One minute, permission-aware introduction for every existing/new web account, mobile and desktop. No native Expo changes, interactive tour, task tracking, or new company SOP.
- One shared DetailSheet: role identity, at most three actual responsibilities, one scope note, and a safe first-step navigation action. All dismissal methods acknowledge viewing; closing preserves the current URL and reading position.
- Owner/Finance default to Ledger, PM to assigned Projects, Purchasing to Materials. Check real route permissions and scope; custom roles use actual capabilities with Profile fallback.
- Never interrupt password change or any onboarding route. Owner starts after quick start is complete/paused or an existing installation no longer needs it. Finance opening-stock review remains first. Defer automatic opening while an overlay or editable control is active.
- Permanent replay through Profile near Hak akses. One stable coordinator across resize; reuse DetailSheet, GroupedSurface, SheetSection, AppIcon and SheetFooterActions.
- Extend DetailSheet with opt-in mobile dismissOnPull; gesture dismissal uses the same close path and acknowledgment as other exits. Existing sheet defaults retain their resize contract.

## API and persistence

- Pure typed DTOs, Zod acknowledgment validation and capability mapping in packages/core. Session, effective database access, onboarding eligibility and persistence in apps/api.
- Typed getOwnRoleGuide and acknowledgeOwnRoleGuide operations explicitly registered in web RPC; apps/web retains HTTP facades.
- Additive per-user last acknowledgment state, synchronized across devices. Context covers guide version, role, project data scope and only guide-relevant grants; ignore historical desktop access and unrelated technical grants.
- Derive the user server-side, reject stale context, make repeated acknowledgment idempotent, and never write acknowledgment during developer simulation.
- Fetch/write failures do not block normal work. Suppress repeat opening within the current session after dismissal even if saving fails; allow a later visit to retry by presenting again.

## Validation

- Four built-in roles, custom roles, revoked/changed access, scope changes, no assigned project, safe CTA guards and neutral user-facing labels.
- First view, all dismissals, manual replay, cross-device receipt, stale/idempotent acknowledgment, failed fetch/write and developer simulation.
- Password/onboarding priorities, deep links/query/scroll continuity, active overlay/input deferral and resize preservation.
- Mobile 320/360/390/430 and desktop 1024/1280/1440; keyboard, screen reader semantics, safe area and reduced motion.
- Targeted tests plus workspace tests, TypeScript, lint, formatting and build. Database tests use only ATRIA_TEST_DATABASE_URL for a disposable database. No finance/stock resets or account/data mutations for verification.

## Implementation evidence

- Pure permission-driven copy and safe CTA mapping, including custom roles and project-scope guards. Role labels/priorities never grant domain access.
- API actions and explicit web-RPC dispatch, own-user receipt transaction with fresh role/grant checks, typed web facades, stable coordinator and Profile replay.
- Fixed manual/automatic request races; a quick explicit replay takes priority over a delayed automatic request. Failed acknowledgment remains locally suppressed without blocking work.
- Unit, DOM, architecture and real PostgreSQL receipt tests pass. Full workspace run: 1,886 passed, 188 integration cases skipped without a disposable DB. Dedicated receipt integration passed separately on disposable PostgreSQL.
- Six browser scenarios passed across the final verification runs: four roles, manual CTA navigation, and header/backdrop/pull dismissal. Owner/Finance viewport matrix covered 320/360/390/430 and 1024/1280/1440, cross-device receipts, URL preservation, Profile replay, reduced motion, and no document overflow.
- Workspace production build and API/web/mobile typechecks passed. Shared-sheet focus/presence and guide coordinator DOM regressions pass. Guide/shared-sheet scoped lint passes. Full lint still reports an unrelated react-hooks/refs error in AI chat; repository formatting reports 118 existing files outside this change.
- Generated additive migration 0047 and its snapshot. The guarded operator requires an explicit development target and verifies all earlier migration hashes before applying only this table. Applied and rechecked on the configured practice database; no company finance/material data changed. Production was not deployed or migrated.
- Design hook: preserved the existing root 16px baseline with a narrowly scoped ignore. Documented the new pull-dismissal contract in DESIGN.md and its sidecar; did not regenerate unrelated existing design metadata.
