# Financial UAT Observability and Developer Account Simulation

Date: 18 July 2026

Amendment: atas keputusan produk pada 18 July 2026, akun tim aktif dengan password sementara boleh digunakan dalam developer simulation. Login normal dan production tetap mewajibkan penggantian password.

## Outcome

- Turn the financial workflow guide into an implementation-aligned UAT runbook that names the actual route, UI surface, mutation, persisted evidence, and before/after values for every material finance flow.
- Add a development-only Owner account simulation tool so one browser session can exercise Finance Admin, Project Manager, and Purchasing boundaries without sharing or bypassing passwords.

## Safety contract

- The switcher is enabled only when `NODE_ENV !== "production"` and `ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED=true`.
- Starting a simulation requires the current effective user to be an active Owner, Owner onboarding to be `COMPLETED`, and active Finance Admin, Project Manager, and Purchasing accounts. Temporary-password status does not block development simulation.
- The selected account must be active and non-Owner.
- The Better Auth session itself changes effective `userId`, so every Server Action and route guard sees the simulated account. Client-only role overrides are prohibited.
- The session stores the original Owner in `developer_actor_user_id`; stopping restores the same session atomically and writes audit evidence.
- Stopping an existing simulation remains available if the env flag is later disabled, preventing a stranded simulated session.
- No password is read, changed, displayed, or shared by this feature.

## UI contract

- Owner entry point: Profile, after account/access facts.
- One grouped developer surface: explanatory warning followed by active staff account rows.
- Simulated state: a compact persistent floating status above bottom navigation naming the effective account and offering one explicit restore action. Its layer stays below every drawer and confirmation overlay.
- Restricted, incomplete-onboarding, missing-team, temporary-password badge, pending, success, and failure states use explicit Indonesian copy.
- Motion: no page or list animation; existing button tap feedback only. Identity changes navigate instantly.

## Implementation steps

1. Extend the Better Auth session schema and migration with nullable `developer_actor_user_id`.
2. Add server-side feature gating, readiness checks, target listing, start/stop actions, transaction locking, audit logs, and role-aware redirects.
3. Add the Profile switcher and global simulated-session banner using existing grouped surfaces and mobile-safe controls.
4. Rewrite the financial workflow guide around real routes, UI checkpoints, mutation evidence, canonical budget behavior, cash/stock invariants, and the developer switcher.
5. Verify TypeScript, ESLint, focused tests, migration consistency, production build, and relevant mobile widths/runtime states.
