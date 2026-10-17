# Project Stock and Expenses desktop

## Scope and direction

Continue the accepted Projects desktop system for `tab=stok` and `tab=expenses` on canonical project detail URLs, at >=1024px. Keep Atria Operate: Manrope, cool canvas, compact white owners, native HeroUI tables, capsule controls and restrained ink/terracotta. This is a specified extension of the existing visual world, not a new identity or layout tournament. Preserve mobile/native presentation and existing workflow owners.

Stock separates project material coverage from actual stock movement history. Lead with meaningful material-record counts, not totals across unlike units; compare required/reserved/secured/used/remaining purchase quantities with each source unit and exact contextual facts. Reuse existing projection and explicit stock-operation/activity-detail owners. Unknown or restricted RAP sources must not appear as healthy empty stock.

Expenses reuses the accepted standalone Expenses desktop primitives inside one project context: field claims, vendor bills and payments, source-backed financial/status facts, filters and native tables with exact detail. Do not duplicate the portfolio page header or allow project filters/create defaults to escape the owning project. Keep consumed cost distinct from paid cash and retain existing approval, scheduling and disbursement semantics.

Filter and sort each complete authorized collection before 10/25/50 pagination, with truthful totals, deterministic ties, URL state preserving project tab/unrelated parameters/hash, page resets and clamping. At >=1280px use independently sized contextual detail; narrower desktop uses first-click detail and Back without hidden fallback highlights. Reuse public DesktopTable, desktopTablePage/Pagination, SegmentedTabs, SearchInput/FilterSelect, GroupedSurface.desktopPanel, MoneyValue, facts/status/PageState and existing outer sheets. Add feature composition, not duplicated shared interaction infrastructure.

## Safety and ownership

Audit loader completeness, domain rights, tenant and assigned-project scopes before widening presentation. Keep read behavior in the API and shared DTOs in core where needed; preserve public typed web facades. No new bulk approval/payment, stock/cash mutation, calculation formula, schema migration, database reset/seed or auth bypass.

Selection, draft, pending work, form recovery and portal/focus/dismissal owners remain stable through resize. Defer incoming source replacement while a workflow is open or pending. Explicit operations keep their existing validators, transaction/audit and reconciled immutability guards.

## Acceptance and preview

1. Inspect stock/expense owners, complete sources, overlays and public UI/stories/tests.
2. Implement compact Stock/material/movement and embedded Expenses/claims/vendor/payments compositions, permission/source states and matching route skeletons.
3. Provide representative labeled synthetic fixtures, source-safe actions and actual-owner stories for complete, empty, locked, restricted, assigned/read-only, draft/pending/error and mixed-unit/cents cases.
4. Verify filter/sort/full-result pagination, exact detail, existing action entry, nested selectors, dirty/pending guards, focused drafts/source freeze through resize and native fallback.
5. Batch desktop 1024/1280/1440 and mobile 320/360/390/430 visual QA, bounded correction/confirmation, fresh finish review and scoped docs.
6. Run appropriate workspace checks, scoped formatting/HeroUI/token checks and graph refresh; record unchanged failures separately. Use disposable fixtures for mutations.
7. Open a visible Browser preview and retain it for user testing. If the authenticated app remains at login, provide a clearly labeled safe interactive fixture preview rather than claiming live authenticated acceptance.

## Status

Implemented both operational tabs on the canonical responsive project detail. Existing API3001/web3004 remain available; development data and authentication were not changed.

## Delivered behavior

- Stock separates material coverage and recorded activity. The overview counts material records rather than adding unlike units; each material keeps its own quantities and unit. Complete authorized collections are filtered and sorted before 10/25/50 pagination. `stock-view`, `stock-materials-*`, and `stock-activity-*` preserve the other query parameters and hash. Context is independent at >=1280px; narrower desktop opens detail on the first row activation and returns to an unselected list through Back.
- Project Expenses composes the existing field-claim, vendor-bill and payment workspaces with project-scoped summaries, filters and URL keys (`project-${projectId}-expenses-*`). It omits the duplicate portfolio header and project filter. The existing create/review/disburse/schedule owners remain in place.
- Global expense and vendor-bill forms lock to the route project. A recovered draft for another project is preserved, excluded from the current project's resume list, and blocked from submission or autosave into the current owner. Late bootstrap and route navigation also retain the correct project.
- `ProjectTabs` freezes incoming source replacement while an operation, global input form, pending action or other owning editor is active. Actual-owner DOM tests verify unchanged focused input nodes and original mutation IDs through resize, review, failure and dirty-discard recovery.
- The API returns explicit per-domain source status and complete authorized rows. Inventory access can receive a quantity-only material projection without internal RAP costs. Tenant checks cover linked material/location/vendor/payment children; account identifiers require account permission. Project/invoice/vendor DTOs use declared fields instead of accidental nested relation spreads. No calculation or mutation writer changed.
- Matching route skeletons cover Stock material/activity and embedded Expenses, including the project identity/navigation scaffold. Public shared controls, table/pagination, money, facts/status and the existing outer overlays remain the interaction owners; no new shared primitive or style token was introduced.

## Acceptance evidence

- Twenty actual-owner stories provide labeled synthetic complete, empty, locked, read-only, restricted, inventory-only, assigned, no-account, failed-source, native fallback, pending and loading states. Story routing supports Stok/Pengeluaran switching and refresh without leaving the preview. Compatibility action aliases fail safely and never call backend mutations.
- Bounded visual QA inspected both tabs at 1024/1280/1440px and 320/360/390/430px. One correction batch replaced mixed-unit mobile Stock aggregates with record counts and removed a mobile expense amount/helper collision. The confirmation matrix has no horizontal document overflow. Final captures: `/tmp/atria-project-operations-proof/stock-final-{width}.png` and `expenses-final-{width}.png`.
- Browser checks exercised keyboard row activation, narrow-list Back, the existing activity detail owner, Stock review/failure/dirty-discard, route-locked expense/vendor forms, and a category selector above two nested sheets. Focused Stock draft input survived 1440→390→1440 with its DOM node and value intact. Both native-pinned stories retained mobile composition at 1280px under reduced motion.
- Fresh finish reviewer returned **`disposition: ship`**, with no material fixes. Review preserved unit-safe stock facts, exact financial context, honest source failures and independent contextual detail.
- Focused read-scope tests use disposable PGlite fixtures, including >30 rows per collection, assigned ownership, tenant children, cents and source failures. Development Postgres was not used for mutation tests.

## Verification and preview handoff

- `bun run build`: pass for API, web, transitional admin, and Expo iOS/Android. Includes API declarations and TypeScript checks. Standalone web TypeScript and the nine project loading/presentation tests also passed.
- `bun run lint`: pass; one unchanged `react-hooks/exhaustive-deps` warning remains in `material-master-proposal-card.tsx:171`.
- `bun run test`: API 836 pass / 560 skipped; core 482, mobile 107, icons 4, API client 14, admin 27 pass. Web 1174 pass / one timeout in the unchanged `desktop-modal-select-dom.test.ts` (60s). The same selector test passed independently in 34.55s; its fixture does not import the new project operations code. No timeout or unrelated production code was changed. The root command stops before development-script tests on that failure; `bun run test:dev-scripts` was then run explicitly and all 15 passed.
- Scoped code/document formatting, `git diff --check`, `bun run heroui:styles:check`, and `bun run tokens:check`: pass. Global format check still reports the same 85 paths as `/tmp/atria-rap-rab-format-final.log`, with no added formatting failures. `graft build` refreshed the local graph.
- Logs are in `/tmp/atria-project-operations-{build,lint,workspace-test,select-isolated,devscripts,scoped-format,docs-format,global-format,heroui,tokens,graft}.log`.
- Visible retained Browser preview: `http://localhost:6018/iframe.html?id=features-projects-responsive-stock-and-expenses--stock-complete&viewMode=story&tab=expenses`. Stok/Pengeluaran navigation was exercised again after restart; the labeled synthetic table/detail rendered at the normal 1280px viewport. Screenshot: `/tmp/atria-project-operations-proof/preview-open-expenses.png`. Storybook6018 remains running for self-testing.
- Authenticated acceptance on development data remains a user test after login at web3004. The fixture preview cannot persist business mutations; it demonstrates the actual owners and safe failure paths without bypassing authentication or changing data.
