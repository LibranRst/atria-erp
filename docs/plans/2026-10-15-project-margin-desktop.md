# Project Margin desktop

## Scope and direction

Extend the accepted Atria Operate desktop grammar to project-detail `tab=profitability` (Margin) at >=1024px. Keep Manrope, cool canvas, white owning panels, compact native HeroUI comparison tables, capsule controls, ink and restrained terracotta. This is an existing-world continuation, not a new identity or concept tournament. Mobile/native retains its one-column composition and existing workflows, with scoped factual/accessibility corrections when required.

Lead with projected margin and its configured target, actual consumed cost and remaining budget, with contract/internal-budget context. Clearly explain the canonical projection (contract minus the larger of actual cost and internal budget); do not present a forecast or settled profit as known. Compare the five canonical category allocations, consumed/paid/pending and remaining facts with readable risk. Use an independent exact category context from 1280px; narrower desktop uses explicit detail/Back without hidden selected rows. Five category rows do not need artificial pagination or search.

Present actual cash received/paid/net separately: net cash is not profit and expense consumption is not paid cash. Source restrictions, partial assigned reads, failures and absent data must not become healthy zeros. Final closed profitability uses the actual stored snapshot when supplied; missing snapshot must be stated. Independently authorized FINAL totals remain available if current budget reads fail or are missing, with current category/cash errors displayed separately; domain restriction still denies the surface. Put existing financial closing readiness and blockers in compact content-sized panels beside or below analysis, preserving explicit permissions and server decision barriers.

## Shared UI and ownership

Inspect and reuse the public inventory: DesktopTable, GroupedSurface.desktopPanel, MoneyValue, status/facts, SectionHeader, Button, shared form controls and shared confirmation/overlays. Prefer existing category table/context composition where its contract fits. Add feature composition rather than interaction infrastructure; no new chart or token family is needed.

Keep one ProfitabilityPanel/closing owner for draft note, current checklist, pending/error/confirmation and success across resize. Defer incoming project sources while its workflow is active. Server checks remain the authority on closing; never infer readiness from the summary alone. Match route/body skeletons to the new desktop hierarchy.

## Data and safety

Audit canonical margin/budget/cash calculations, snapshot reads, domain rights, project assignment and tenant isolation before widening presentation. Reuse existing budget/finance calculations and read metadata through typed API/core contracts; never calculate whole-project cash from a scoped actor's partial rows. Add minimal read/source fields when needed. Preserve transaction/audit, stock/cash/reconciliation immutability, existing schemas and writer semantics. No seed/reset, account changes, automatic closing or live financial/project-state mutation during QA.

## Acceptance and preview

1. Inspect current Margin/closing owners, complete sources and shared UI before editing.
2. Implement compact summary, five-category comparison, honest cash/snapshot states, closing readiness and matching skeletons.
3. Safe fixtures/disposable tests cover positive/low/negative margin, configured target, over-budget projection, cents/zero, source failures/restrictions, assigned/tenant scope, stored final snapshot and closing guards.
4. Actual-owner tests cover focused note/draft/checklist/source stability through resize, pending/error, confirmation and stale refresh. Do not close a development project to test the UI.
5. Batch actual dev desktop 1024/1280/1440px and mobile 320/360/390/430px visual QA; one correction batch and one confirmation, fresh finish review and additive design documentation.
6. Run appropriate workspace checks, scoped formatting/HeroUI/token checks and Graft refresh. Record unchanged failures separately; isolate production build output from running dev.
7. Open and retain the actual authenticated dev website in Browser on Margin. API3001/web3004 stay running for user testing; do not substitute a fixture preview.

## Status

Implementation, actual-app QA and verification are complete. Visual finish review returned **`disposition: ship`** with no material fixes. Correctness review identified one combined-source case (valid FINAL plus failed current budget); it was repaired and the focused follow-up found no regression.

## Delivered implementation

- Canonical Margin adapts to a compact financial band, five-category native HeroUI table with the reused exact `ProjectCategoryDesktopDetail`, an independent current cash panel and server-owned closing readiness. At >=1280px category context sits beside the complete table; narrower desktop opens explicit detail and Back returns to an unselected list. No search or pagination was added to five fixed category rows.
- Configured target and canonical projected margin replace the hardcoded 10% warning. The existing projection formula is unchanged. Desktop and mobile copy distinguish budget consumption, paid cash, conservative projection, margin from currently recorded costs and stored final profitability.
- `ProjectMarginData` supplies independent current margin, current cash and FINAL snapshot source status. The snapshot read is restricted by profitability permission, tenant, project and snapshot type, with an explicit DTO. Stored categories and cash receipt/payment breakdown are not invented: those sections retain current-data labels. Canonical cash uses whole-project paidCost and complete receipt sums through shared cents helpers, not assigned actors' partial expense rows.
- Margin has an explicit `view:profitability` route gate. Closing controls require all four server rights (`view:project`, `update:budget`, `view:profitability`, `close:project`), fresh server readiness, an active project and a sufficient human note. One stable owner retains note, checklist, pending/error, explicit shared confirmation and discard across resize. Source replacement waits for it; a project ID key prevents cross-project draft/checklist reuse. Failed refresh removes an old ready checklist, and rejected writes preserve the note.
- Route/body skeletons match the summary, category comparison, contextual panel, cash and closing hierarchy. Shared public DesktopTable, GroupedSurface.desktopPanel, MoneyValue, facts/status, controls and ConfirmationDialog remain authoritative; no primitive, chart, token, schema or writer was introduced.

## Actual dev evidence

Normal seed Owner session at `http://localhost:3004` was reused. API3001/web3004 remain running. The retained visible page is `http://localhost:3004/projects/77777777-7777-7777-7777-777777777771?tab=profitability`.

- Batch matrix: desktop 1024/1280/1440px and mobile 320/360/390/430px. One factual-copy correction batch and one confirmation; no document overflow. Primary captures: `/tmp/atria-project-margin-proof/margin-final-{width}.png`.
- Keyboard activation opens Material detail at 1024px; Back clears hidden selection. The reused category detail preserves exact cents on completed BSD data. Native-pinned composition at 1280px under reduced motion remains mobile; temporary viewport/media overrides were reset and the hidden QA tab was closed.
- Real server readiness for Menteng returns eight blockers and current exact cost/cash facts. The explanation clarifies that current-cost margin excludes unrecorded remaining work. The completed BSD project honestly discloses its missing FINAL snapshot; completion copy does not claim that a stored snapshot exists.
- Supporting captures: `closing-final-1440.png`, `completed-project-1280.png`, `category-narrow-detail.png`, `native-fallback-1280.png` in the evidence directory.
- No development project was closed and no financial, stock, account or seed data was changed during QA. Deferred-action and PGlite fixtures cover mutation failure, confirmation and snapshot cases.

## Verification

Focused model/SSR, real-owner DOM, independent read-source/tenant/assigned/permission and cents tests passed. The first full workspace run passed: API 837 (560 skipped), core 484, web 1195, mobile 107, icons 4, API client 14, transitional admin 27, development scripts 15; zero failures. After the combined-source repair, the Margin model/SSR and project loading/presentation rerun passed 17 tests/144 assertions. The final real-owner DOM rerun passed in 10.93s with clean stderr after strict fixture input narrowing was corrected. It checks six exact frozen desktop amounts, the closing timestamp, missing/failed current sources, independent live-data errors, restricted access and stable resize on both presentations. Fractional mobile summary/cash values now pass explicit MoneyValue precision, preserving supplied cents without changing calculations. Valid historical summaries remain visible independently of current budget failure/missing, while active projects and restricted sources cannot use that fallback.

- `ATRIA_NEXT_DIST_DIR=.next-margin-build bun run build`: final run passed API, web, transitional admin and Expo iOS/Android, including declarations and TypeScript. The first build caught three strict types in the new test fixture; these were fixed through explicit unknown narrowing and a number annotation without weakening assertions. Production output stayed separate from running dev output.
- `bun run lint`: passed; one unchanged `react-hooks/exhaustive-deps` warning remains in `material-master-proposal-card.tsx:171`.
- Scoped code/document formatting, scoped `git diff --check`, HeroUI styles isolation and token checks passed. Global format check reports the same 83 existing paths as the prior Payments baseline, with no new failures.
- `graft build` passed. DESIGN.md, `.impeccable/design.json` and the existing Projects surface brief were updated additively, including independent authorized FINAL availability.
- Logs: `/tmp/atria-project-margin-{workspace-test,postfix-model-loading,api-declarations,build,build-final,lint,global-format,scoped-format,final-scoped-format,docs-format,heroui,tokens,graft}.log`; final owner harness log: `/tmp/atria-margin-owner-dom-test.log`.

## Handoff

The real authenticated app stays open at `http://localhost:3004/projects/77777777-7777-7777-7777-777777777771?tab=profitability`. API3001 and web3004 remain running for user testing. Final live screenshot: `/tmp/atria-project-margin-proof/preview-dev-ready.png`. No fixture server replaces this preview and no development finance/project-state mutation was committed.
