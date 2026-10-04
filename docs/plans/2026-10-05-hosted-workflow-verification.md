# Hosted workflow verification and Atria naming — 5 October 2026

## Authorized objective

Verify all web workflows through the deployed web/API stack, fix blockers, use the normal app interface, and replace the exaggerated boss/pilot naming with Atria/Dekoria names. Preserve existing user/profile/company data and free/no-card constraints. The initial target frontend name is `atria-dekoria` if available; service/project display names use `Atria` and `atria-api`.

## Baseline and isolation

Current reviewed source is `78076cad`; executable navigation/session source was verified at `dd666bae`. Previous CI passed 24 disposable PostgreSQL suites (142 tests) and 22 anonymous hosted checks, which do not establish full hosted business acceptance. Current authenticated dashboard is empty financially and quick start is paused; verify database counts before any write. The earlier local CDN TLS failure requires distinguishing ISP DNS routing from actual provider delivery; see the verified correction below.

Use a dedicated disposable QA database and test users/accounts/projects for ledger/stock mutations. Prefer schema-only isolation or a fresh database rather than copying company rows. Keep the normal app on its current database and auth secrets. A temporary QA deployment may be used within existing free credits; avoid exposing company data and never upgrade/add a payment method. Credentials remain backend-only/private and must not appear in source, terminal output or evidence. Preserve the original checkout's unrelated uncommitted work.

## Implementation order

1. Inspect hosting, app state, storage and typed transport; resolve the exact account/endpoint blockers. Read-only evidence first.
2. Change browser metadata to Atria, remove the pilot notice by using normal public build configuration, and rename the owned frontend domain. Update web URL, API trusted origins/CORS and storage reference handling together; verify TLS/login/protected paths. Changing domains may require the user to sign in on the new host.
3. Restore private exact-byte attachment delivery with valid TLS, authorization, MIME/size/time/quota limits preserved. Do not bypass certificate validation or make financial files public. Establish upload→authorized download→OCR/chat and negative-access evidence using synthetic fixtures.
4. Run hosted finance/material/RAB/chat workflows with per-role identities and deterministic expected ledger/stock/category values. Cover double submit, concurrent approval, timeout/retry, rollback/idempotency, permission removal/custom role and foreign-project denial. Exercise login/password/logout; use synthetic account credentials, never reset the user's personal password.
5. Check 320/360/390/430 mobile and 1024/1280/1440 desktop, keyboard/focus, fresh server snapshots, export/download and responsive overflow. Reuse existing shared UI and HTTP facades; no new UI primitive is planned.
6. Verify backup/readback/restore on the QA dataset and notification outbox/scheduler behavior; never send test messages to real people. Record delivered vs undelivered integration evidence distinctly.
7. Publish the tested snapshot, repeat checks on the normal final domain and save the acceptance matrix. Clean up only created QA artifacts/resources using supported safe recovery/expiration; preserve source, credentials and backups. No blanket claim that untested provider delivery or company baseline is complete.

## Acceptance matrix

- Authentication and access: individual role logins, password/logout, custom grants/revocation, project scoping, desktop gate.
- Project budget/expenses: defaults, budget allocations, five categories, expense/OCR draft, review/approval/payment, budget/cash/margin refresh.
- Finance: vendor bill/approval/payment, client invoice/receipt, account cash in/out/transfer, bank import/reconciliation/closing and immutable reconciled entries.
- Material: master/location, RAP, stock receipt/reserve/use/return/transfer/adjustment/waste/reversal, concurrency and category/project links.
- RAB: client-safe selected RAP/package/manual rows, totals, PDF/Excel output, internal cost/margin/vendor-note isolation.
- AI/media: 9Router exact model, text/tool proposal/human confirmation, image/PDF/history, private bytes/denials, oversized/malformed upload, timeout and generic errors.
- Operations/UX: scheduler/internal notifications, backup/restore, PWA outage/recovery without mutation retry, supported widths, named domain and normal branding.

Each row must record the environment, source identity, method, expected/actual result and evidence. Local/integration tests cannot substitute for hosted/browser evidence. Known external or human-input blockers stay explicit.

## First implementation

Normal build configuration disables the pilot-only balance notice without touching balances or domain features. Browser/application metadata and unknown-route header fallback use Atria. Existing shared UI/ledger surfaces remain unchanged. The original domain remains active until authentication/CORS and delivery migration prerequisites are ready.

## Confirmed environment setup

The production frontend has been renamed to `atria-dekoria.netlify.app` (same Netlify site ID), with new origin CORS verified by an HTTPS preflight. Normal Atria browser/header naming and pilot notice disabled are included in the release build.

A dedicated fresh QA database `atria_verify_20261005_2202aeec` and restricted QA owner were created on the existing Neon compute, avoiding copied company/auth rows. All 44 migrations and 67 public tables were applied; a private marker guards operator calls. This database-level isolation was used because the Neon connector advertised tools but returned Unknown tool, and the CLI was unavailable. Existing production environment credentials were not overwritten.

The user approved backend-only QA database/auth/bridge plus existing ImageKit/9Router credentials and the authenticated HTTPS QA endpoint. Temporary Railway service `atria-verification-api` (19bada0c-7afb-4153-b614-0109f1cb4e77) uses one Singapore replica, Serverless, `/ready`, reviewed source branch and CI gate. Its endpoint is `atria-verification-api-production.up.railway.app`; separate Netlify QA site ID is 14dc9274-321f-4605-b1b2-53fa803396cb.

The earlier CDN-certificate diagnosis was incomplete: local port-53 DNS maps `ik.imagekit.io` to `internetpositif.id`/36.86.63.185. An authenticated HTTPS DNS response returned its actual CloudFront addresses; a request to the intended address retained full TLS verification and returned ImageKit HTTP 404 (missing account ID), proving the genuine CDN validates TLS. No system DNS or certificate-verification setting was changed. Cloud exact-byte/authorization/OCR checks remain the application-level test, and direct browser CDN paths may need an authorized application relay for the local network.

Actual QA HTTPS authentication passed Owner and Finance/PM/Purchasing logins, mandatory temporary-password destination, incorrect-current-password rejection, password update/session revocation and fresh per-role sessions. Rate limiting correctly returned 429 during rapid logins; the harness respects Retry-After and bounded waiting rather than disabling it. No personal/company credentials were used.

## Hosted findings and repair

QA finance passed budget submission/approval, staged RAP review, RAB approval, explicit activation, expense verification/approval/payment, vendor and client payments, duplicate/concurrent payment rejection, category totals, AI PDF statement import deduplication and bank reconciliation. QA stock passed receipt/reserve/use/return/waste/adjustment/transfer and receipt reversal; concurrent reversal is intentionally idempotent (both responses may return the same REVERSED document), with exactly one reversal stock movement and audit. Custom assigned-scope grants still reject foreign projects, and permission revocation takes effect on an existing session. These are real HTTPS API plus disposable database invariants; browser coverage is recorded separately.

A hosted PNG receipt reproduced a real blocker: ImageKit automatic optimization served JPEG bytes for a registered PNG. The private download correctly rejected the mismatch, preventing OCR. A strict-TLS probe showed original delivery preserves PNG bytes. Request `original: true` through the installed typed ImageKit SDK before signing, preserving authorization, expiry, MIME, size and redirect checks. The existing isolated storage test now asserts the signed `tr=orig-true` URL (red before the fix); hosted readback/OCR must pass after deployment. Provider documentation: https://imagekit.io/docs/core-delivery-features.

Netlify CLI `link --id` does not replace an already-linked site; it exits successfully while retaining the old link. Always unlink/relink and assert the resulting site ID before a QA build, then verify the browser sign-in request uses the QA origin. A wrong QA build was caught before any company mutation and replaced. QA protection remains Private, and QA browser login/redirect now succeeds. Production metadata stays company-neutral because company identity is configured per instance; domain remains atria-dekoria.

Mobile browser verification also identified unnamed icon-only bottom navigation links. Reuse the existing BottomTabBar/WorkspaceLink and NavItem label; add aria-label without changing geometry or focus ownership. This is a small accessibility repair, with existing component tests and hosted accessible-name checks.

Hosted PDF inspection reproduced an export layout bug: visibility-hidden app chrome still occupied print flow, so the one-item RAB started halfway down page one and spilled onto page two. Isolate only the document ancestor path during print, hide other app nodes from layout, and reset transformed sheet ancestors. Reuse RabExportDocument and the existing DetailSheet/ExportCanvas; no new overlay or money primitive. Verify the same Chromium print output after rebuild, checking page count, first-content position, client totals and internal-note/cost exclusion.
