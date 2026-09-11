# Perbaikan Notifikasi Atria ERP

Approved scope: web and backend, preserving the bell morph and existing local work.

## Contract

- Read is independent of resolved. Unread badge counts all eligible unread records; action count includes read but unresolved actions.
- Information stays visible for 30 days after reading; resolved actions for 30 days after resolution. Unread information and open actions never expire. No physical deletion.
- Typed events, transaction-bound creation/resolution, per-recipient idempotency, server-side permissions/project scoping, stable cursor pages of 20 and separate aggregate counts.
- Cover field expenses, vendor workflow, budgets, RAP/RAB/change orders, stock/receipts, project lifecycle, and vendor/client due dates.
- Notify responsible authorized users; do not suppress actions assigned to the actor. No daily duplicate reminders. Escalation becomes unread; recovery resolves the condition.
- Due dates start H-3 in Asia/Jakarta. Protected hourly scheduler endpoint, deployment-neutral; deployment and scheduler activation excluded.
- Shared content for full page, drawer and accessible shared morph dialog. Session-owned store,
  visible/online-only SSE invalidation, slow polling fallback, retries, mutation failure feedback
  and safe navigation.
- Preserve Expo push foundations; no mobile UI, Web Push implementation or guaranteed push delivery.

## SSE synchronization amendment — 6 September 2026

- Use Server-Sent Events because notification synchronization is server-to-client and does not
  require a bidirectional socket protocol.
- Add a monotonic notification change cursor based on indexed `(tenantId, userId, updatedAt, id)`.
  Every read/resolution mutation updates `updatedAt`.
- The authenticated Node.js route streams invalidation events, heartbeats through buffering
  proxies, and rotates connections within a bounded lifetime so session/role changes are
  revalidated.
- The client keeps one EventSource for the current session while visible and online. Focus,
  visibility, online recovery, and SSE invalidations trigger the existing deduplicated refresh.
- Keep a two-minute fallback refresh with failure backoff up to five minutes. SSE failure must not
  make the notification center unusable.

## Acceptance

Test >50 records, stable cursor ties, retention boundaries, invalid input, account/permission changes, optimistic races, stage handoff, partial batches/payments, duplicate events, transaction rollback, scheduler concurrency, due-date transitions and recovery. Verify 320/375/390/430px, keyboard/focus, reduced motion and error states. Run relevant finance/material regression tests, typecheck, lint, format and build; report unrelated baseline failures. Never reset the user's database.

## Verification completed

- Workspace tests: 250 core + 802 web passed; 143 external-database integration cases skipped by the existing gate.
- Notification PostgreSQL fixture: 125-row cursor pagination, aggregate counts, ownership/project/permission isolation, read vs resolved, event retry deduplication, transaction rollback, recurring condition recovery, actual H-3/due/overdue/paid job transitions, push-token account reassignment, and the actual 0038 migration against snapshot 0037 passed in isolated PGlite databases.
- Production build and workspace lint passed. Notification-owned formatting passed; repository-wide format check reports pre-existing issues in unrelated files.
- Storybook verification: dialog fits 320/375/390/430px without horizontal overflow; Shift+Tab wraps inside the dialog; Escape returns focus to the retained bell trigger. Shared DialogFrame owns modal semantics, focus, scroll/layering and reduced-motion handling. Existing IconButton, SegmentedTabs, GroupedSurface, Badge and Button primitives are reused.
- An unauthenticated POST to the built scheduler route returned HTTP 401.
- Migration was tested in isolation and then applied to the configured `atria_uat_guard` database through the direct Neon connection. Its partial `0037` drift was reconciled idempotently before applying `0038`. A later explicitly authorized demo-seed task reset that sandbox; no user or production database was reset. Hosting scheduler activation and deployment remain outside this implementation handoff. External Expo delivery and real-device/screen-reader UAT were not exercised.
- SSE amendment: migration `0039_notification_sse_cursor` was applied to `atria_uat_guard`.
  The isolated protocol test verified authenticated status, SSE headers, retry hint, session event,
  invalidation event, cursor id, and cancellation. Browser UAT changed one notification through
  Drizzle without reloading the page; the unread badge appeared through SSE within the five-second
  cursor interval and disappeared again after the row was restored. The resolver cursor test also
  proves that assigned-project scope changes invalidate a PM stream.
