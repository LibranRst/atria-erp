# Project Payments desktop

## Scope and direction

Extend the accepted Atria Operate desktop system to project-detail `tab=payments` at >=1024px. Preserve Manrope, cool canvas, white divided owners, native HeroUI tables, capsule controls and restrained ink/terracotta. Reuse the public shared UI inventory and the existing invoice, receipt, review, confirmation, recovery and success owners. Mobile/native keeps its current one-column composition.

Lead with a compact divided band for active invoice value, cash actually received, outstanding receivables and unbilled contract context. Keep invoice status, due attention and actual receipts distinguishable; do not describe an invoice as received cash or a settled current schedule as a settled whole contract. Invoice and receipt peer collections have compact controls and complete-result sorting/filtering before controlled 10/25/50 pagination. Preserve unrelated URL parameters/hash and reset page after filter/sort changes.

At >=1280px show an independently sized contextual detail pane with exact amounts, dates, source/account identity when permitted, payment history and the existing explicit action. At 1024–1279px the first row action opens detail and Back returns to an unselected full-width list. No invisible fallback row highlight. Preserve selection, draft, focused controls, pending work, recovery and the single overlay owner through resize and incoming source updates.

## Data and safety

Audit existing complete invoice/payment reads, tenant and assigned-project scope, domain rights, source failure handling, bank identity redaction and client-safe DTO shaping. Add read metadata only when required. Reuse canonical cents helpers/calculations and existing writers; no new bulk receipt/payment, formula, migration, seed/reset or authentication bypass. Create invoice, schedule generation and record receipt remain distinct explicit permission-checked actions. Do not mutate development finance data during QA.

## Acceptance

1. Inspect owning flows, public primitives/stories/tests and read contracts before editing.
2. Build compact invoice/receipt tables, truthful empty/error/restricted/locked states and matching full-route skeletons.
3. Verify full-result totals/filter/sort/pagination, cents, void/overdue/partial states, permissions and account redaction using safe fixtures/disposable tests.
4. Verify actual create/payment forms, nested selectors, review, dirty/pending protection and source/draft stability through resize without committing live financial mutations.
5. Batch visual QA desktop1024/1280/1440 and mobile320/360/390/430, one correction batch and one confirmation, then fresh finish review and additive design documentation.
6. Run appropriate workspace checks, scoped format/styles/tokens and refresh Graft; record unchanged failures separately.
7. Open and retain the real development website in Browser on the project Payments tab. Use ordinary seeded authentication with the user's authorization; do not substitute a Storybook preview for this handoff.

## Status

Implemented on canonical project URLs. Fresh visual finish review returned **`disposition: ship`**, with no material fixes. Independent scoped correctness/React review found no actionable bug. Implementation, verification and the live dev handoff are complete.

## Delivered implementation

- `ProjectPaymentsDesktop` composes the public shared table, controlled pagination, segmented peers, filter/search controls, money, status and grouped desktop panels. Invoice and Penerimaan retain independent search/filter/sort/page/page-size state under `project-invoices-*` and `project-receipts-*`; `payments-view` chooses the collection. Complete authorized results are filtered/sorted before pagination. Empty results use full width; detail is independent at >=1280px and first-click/Back at narrower desktop.
- Summary separates active billing, actual received cash, outstanding receivables and unbilled contract. Canonical invoice helpers now use cents. VOID invoices remain inspectable but do not add active billing or debt; their historical receipts remain actual cash. Overdue attention derives the Jakarta calendar date for legacy unpaid/partial statuses without changing database state; due today is not overdue.
- One existing `ClientPaymentSheet` keeps draft, review, pending, error, confirmation and success ownership above responsive presentation. `ProjectTabs` defers source adoption while a receipt workflow or `new-invoice` owner is open. Global invoice recovery is keyed to pathname, so a project route change recovers that project's local draft instead of overwriting another project. Same-path query changes and resize keep the owner intact.
- API invoice/receipt reads are complete and separately report ready/restricted/unavailable. Existing tenant/project assignment, domain permission and DTO redaction remain authoritative. No account or reconciliation status is invented in receipt tables; authorized exact activity context is read by the existing activity owner.
- Canonical receipt writes now additionally validate invoice, project and destination-account tenant before the existing balance mutation. Receipt/reference reads are tenant scoped. Manual and AI entry points share this protection; central transaction, balance/audit and reconciled-history behavior remain unchanged.
- Actual dev testing exposed strict UUID validation in the legacy invoice-prefill reader rejecting seeded database IDs. The reader now uses the repository's database UUID syntax, existing session actor, domain/project-scope checks and tenant filters. Prefill formulas are unchanged; frontend read failure now gives a recoverable message instead of silently suggesting automatic data is ready.
- Matching route skeletons include project identity/finance navigation plus invoice/receipt table structure. No new shared primitive, style token or library dependency was introduced.

## Browser acceptance

The user authorized using the supplied development account to log in. The app is authenticated normally as seed Owner Ronald Wijaya at `http://localhost:3004`; no account, password or database reset was performed. Next dev resource access now includes the explicit loopback `127.0.0.1`, fixing its blocked HMR/login hydration while keeping ordinary app authorization.

Real dev project: `77777777-7777-7777-7777-777777777771` (Menteng Villa). The existing data shows three invoices and two receipts: Rp800m billed, Rp360m received, Rp440m outstanding. Browser testing did not save an invoice, generate a schedule or record a cash transaction. Only automatically created QA form drafts were discarded.

- Batched desktop matrix: Invoice and Penerimaan at 1024/1280/1440px; mobile at 320/360/390/430px. One correction batch fixed raw tab-icon strings/count labels, a mobile amount/action collision, raw invoice-stage/status copy and inherited literal text sizing in the touched forms. Confirmation captures have no horizontal document overflow.
- Keyboard row activation at 1024px opens detail; Back clears explicit selection without hidden highlights. The overdue filter returns one actual row and an unmatched search returns a truthful zero, with URL page reset preserved.
- Real backend activity detail resolves both receipt and related invoice. A nested bank selector opens above the receipt form. Its amount input keeps the same focused ID/value through 1440→390→1440; existing review shows actual account and before/after values without committing the mutation. Invoice create prefill now loads the real project number/remaining context.
- Native-pinned composition at 1280px remains mobile under reduced motion. Temporary media/viewport overrides were reset and the QA tab was closed. The retained visible tab is the real web app, not a fixture server.
- Evidence directory: `/tmp/atria-project-payments-proof/`. Primary captures: `invoices-final-{1024,1280,1440}.png`, `receipts-final-{1024,1280,1440}.png`, `mobile-final-{320,360,390,430}.png`, `receipt-review-live.png`, `invoice-create-live.png`, `receipt-activity-detail.png`, `filter-empty-live.png`, `native-fallback-1280.png`.

## Automated verification

Focused tests pass for cents/VOID settlement, full-result pagination/query state, Jakarta due boundaries, actual-owner draft/focus/source freeze and route recovery, complete authorized reads, tenant isolation, legacy prefill IDs and immutable historical ledger behavior. Mutation scenarios use disposable fixtures, never development finance data.

- `ATRIA_NEXT_DIST_DIR=.next-payments-build bun run build`: pass for API, web, transitional admin and Expo iOS/Android. Verification output was isolated from the running web dev output. API declarations and web/mobile TypeScript checks passed.
- `bun run lint`: pass; one unchanged `react-hooks/exhaustive-deps` warning in `material-master-proposal-card.tsx:171` remains.
- `bun run test`: API 837 pass / 560 skipped; core 482, mobile 107, icons 4, API client 14 and transitional admin 27 pass. Web 1186 pass / one timeout in the unchanged `desktop-modal-select-dom.test.ts` at 60s. Independent rerun of that selector passed in 34.45s. No shared selector implementation or timeout was altered. Root execution stops before dev-script tests on this existing failure; `bun run test:dev-scripts` was run separately and all 15 passed.
- Scoped code/document format, scoped `git diff --check`, HeroUI styles isolation and token checks: pass. Global format check reports 83 pre-existing paths, with no new failures against the prior 85-path baseline; the two invoice utility paths touched here are now formatted.
- `graft build`: pass. DESIGN.md, `.impeccable/design.json` and the existing Projects surface brief were updated additively by the post-review documenter.
- Logs: `/tmp/atria-project-payments-{build,lint,workspace-test,select-isolated,devscripts,scoped-format,docs-format-check,global-format,heroui,tokens,graft}.log`.

## Handoff

Retained visible Browser tab: `http://localhost:3004/projects/77777777-7777-7777-7777-777777777771?tab=payments`, authenticated as the seed Owner. API3001 and web3004 remain running for user testing. Final live screenshot: `/tmp/atria-project-payments-proof/preview-dev-ready.png`.
