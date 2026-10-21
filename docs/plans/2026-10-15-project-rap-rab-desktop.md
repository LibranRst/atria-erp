# RAP and RAB desktop workspaces

## Scope and direction

Continue the accepted Projects desktop redesign with RAP and RAB at canonical project-detail URLs, at >=1024px. This is an extension of the established Atria Operate system: compact Manrope, cool canvas, white grouped owners, native shared HeroUI tables, capsule controls and restrained ink/terracotta. Keep mobile/native composition and existing business workflows authoritative.

RAP presents the actual Material / Tukang / Subcon / Review setup progression and the locked internal plan with compact source facts, complete searchable tables and contextual item/package detail. Show quantities with their own units; never aggregate unlike units into a purchase quantity. RAB presents the actual client estimate, document order, items/bundles, revision/baseline/source freshness and existing approval/change-order/export actions. The desktop workspace is internal; exported RAB remains strictly client-safe.

Use public DesktopTable, desktopTablePage, DesktopTablePagination, SegmentedTabs, SearchInput/FilterSelect, GroupedSurface.desktopPanel, MoneyValue, statuses, FactRow, PageState and existing shared outer form/detail sheets. Complete authorized collections filter/sort before 10/25/50 pagination; preserve query/hash and deterministic ordering, reset page after controls change. >=1280px may pair a native table with independent context; narrower desktop uses first-click detail and Back, with no hidden fallback highlight. Table presentation sort never changes RAB document order or export content.

## Ownership and safety

Keep manager hooks, forms, source selection, item editors, bundle membership, revision reasons, pending state, export and single portal/focus/dismissal owners stable through resize. Defer incoming source replacement while a workflow is open or pending. Reuse actions, validators, calculations and protected API reads. No new bulk action, money/stock mutation, automatic approval, migration, database reset/seed, auth bypass or deployment.

Audit source completeness, permission/project/tenant boundaries and client-safe export before widening presentation. Backend changes, if a concrete read defect requires them, remain in API; shared pure types/calculations remain in core. Do not duplicate finance/material calculations in new presenters.

## Implementation and acceptance

1. Inspect RAP/RAB owners, setup/locked/revision states, DTOs, existing editors/export and shared UI stories/tests.
2. Build RAP and RAB desktop presenters and matching structural loading, preserving the existing mobile branch and outer workflow owners.
3. Provide safe labeled fixtures for complete, empty, read-only, draft/locked/approved/revision, bundle/hidden/stale source, cents/long copy and pending/error states.
4. Verify complete filtering/sorting/pagination, exact contextual facts, visible selection, editor/source/bundle/revision/confirmation behavior, client-safe export and draft/focus stability through resize.
5. Batch desktop 1024/1280/1440 and mobile 320/360/390/430 visual QA, native fallback, keyboard/nested overlays/reduced motion. Apply a bounded fix pass, fresh finish review and scoped documentation.
6. Run appropriate TypeScript, workspace tests/build/lint, scoped HeroUI/token/format checks and graph refresh. Record pre-existing failures separately. Use fixtures/disposable databases, never development data mutation.

## Status

Implementation, responsive QA and finish review completed. Existing web3004/API3001 remain available; the user's browser is at login. Visual evidence therefore uses isolated, explicitly labeled synthetic stories with failing mutation facades, never an authentication bypass or development database mutation.

### Shipped behavior

- RAP keeps the actual Material/Tukang/Subcon/Review progression and locked plan, with a divided cost band and three complete collections. The Material purchase summary counts records, never quantities across unlike units. Context retains canonical supplied stock/need/reserved/used facts and exact amounts. Quantities use Indonesian formatting with their source units; source labels are translated.
- RAB keeps client pricing, bundles, members, inherited hidden-bundle visibility, baseline/revision/source freshness and existing document/change-order/history operations distinct. Default table order follows the stored document; view sorting/filtering does not mutate source arrays or exports. Package total is counted once. Exact context preserves cents.
- Each complete collection filters/sorts before controlled 10/25/50 pagination and keeps its own URL parameters, unrelated query and hash. Narrow desktop uses the first row action and Back; wide desktop highlights only visible actual context. Independent 18rem context never stretches neighboring section spacing.
- Reused public DesktopTable, desktopTablePage, DesktopTablePagination, SegmentedTabs, SearchInput/FilterSelect, GroupedSurface.desktopPanel, MoneyValue, statuses, FactRow, PageState, buttons and existing outer sheets. New feature presenters compose those contracts; no shared interaction infrastructure was duplicated.
- The actual manager, hooks, forms and export/approval/history owners remain stable. Manager and ProjectTabs source snapshots defer updates during open or pending workflows. After an adopted new revision closes its picker, selection IDs reconcile with cloned sources instead of reusing stale IDs. Existing project/tab keys may reset a genuinely adopted new revision only after the reviewed workflow closes.
- Route loading recognizes `tab=rap` and `tab=rab`, composes identity/navigation with the matching planning skeleton and retains mobile loading. A browser-detected RAB skeleton row/column ID collision was fixed with separate key namespaces.
- The existing mobile composition is retained. One observed fit defect was corrected: the RAB export control now occupies its own row so it cannot cover the primary amount at 320px. Inherited small text/eyebrows and the unsupported mobile margin display based on a 90% cost assumption were not canonized; the new desktop does not reproduce that margin calculation.

### Permissions and read audit

Existing writers remain authoritative and unchanged. UI capabilities now mirror their actual independent rights: RAP creation uses `create:rap`, Material updates use `update:rap`, package/setup operations use `update:budget`, and finalization uses `lock:rap`. Revision choices only expose the permitted Material/package scope. RAB creation uses `create:rab`, editing/refresh/bundling/void/client confirmation use `update:rab`, and approval uses `approve:rab`. Approval alone does not imply edit rights. Restricted planning tabs render explicit access states.

The detail read already returned complete collections. Its planning payload now applies `view:rap`/`view:rab`, existing tenant and assigned-project fences to nested RAP/RAB rows, material/vendor/inventory context, bundle membership and linked Change Orders. A budget-only role receives no internal planning payload. Canonical finance snapshots, including approved RAB value, remain available through the existing budget read. No schema, mutation, financial/material formula or cash/stock behavior changed.

### Evidence and acceptance

- 24 actual-manager stories cover complete/draft stages/locked/skipped/empty/approved/revision/stale sources, read-only/editor/approver, pending, native fallback and loading. Fixtures include 36 mixed-unit materials, 15 Tukang and 12 Subcon packages, 36 RAB lines, bundles/members/hidden lines/manual/service-fee and history. Initial RAB creation uses a locked RAP with real candidate rows. Fixture stock facts are generated by the canonical projection helper over synthetic movements.
- Browser confirmed desktop 1024/1280/1440 and mobile 320/360/390/430 with no horizontal document overflow. Both native-pinned stories keep the single-column mobile composition at 1280px. A transient Hook Refresh queue error during implementation disappeared on fresh navigation; final captures and owner tests render normally.
- Actual browser interactions covered keyboard first-click detail, Back, full-source pagination, search resetting page and retaining URL controls, sorting, nested RAP dropdown choice, RAP editor and RAB bundle input/focus through desktop/mobile resize, dirty dismissal, source choice retention, existing export preview, reduced motion and pending-action handoff through resize. Failing fixtures retain drafts and restore available actions after completion.
- Client preview showed exact client prices and bundle totals; internal notes/cost fields and hidden alternatives were absent. Existing printable/Excel regression tests also cover private-field exclusion and cents.
- Actual-owner DOM regression covers reviewed RAP/RAB IDs, original mutation targets, same input DOM/drafts, source selection, pending failure, cloned source IDs, incoming null/new revisions and adopting the replacement only after close. The earlier budget-owner source-freeze regression still passes with an explicit RAP-view permission.
- Fresh finish reviewer: **disposition: ship**, no material fixes. The shipped documenter added a scoped Project Planning Desktop Workspace rule, sidecar metadata and Projects brief ownership without replacing existing product/design commitments.
- Valid evidence: `/tmp/atria-rap-rab-proof/rap-final-{1440,1280,1024,430,390,360,320}.png`, equivalent `rab-final-*`, `rab-loading-final.png`, draft/revision/stale/empty and native captures. `rab-export-preview.png` and `rap-editor-proof.png` record actual outer owners. Early `rap-320.png` captured the transient HMR error and is superseded.

### Verification

- `bun run build` passed API, web, transitional admin and Expo iOS/Android, including TypeScript/declaration gates. A subsequent web rebuild also passed after the loading fallback correction.
- The first full test run exposed a genuine loading-boundary regression: Next search params were absent during the existing server-rendered loading test. The shared URL hook now accepts that unavailable context and uses its existing empty-query fallback. Nine loading/presentation tests passed after correction, including explicit RAP/RAB native table column/row scaffolds. The capability-refresh fixture now grants `update:rap` explicitly to exercise the existing Material writer's actual edit right.
- Application suites passed: icons 4, core 482, mobile 107, API 835, API client 14 and admin 27. API skipped 560 live/disposable-Postgres integration cases without `ATRIA_TEST_DATABASE_URL`; planning-read/security coverage uses disposable PGlite fixtures.
- Final full web rerun: **1,164 pass / 1 timeout** across 1,165 tests. The remaining unchanged ContextPopover DOM test exceeded its 30-second deadline in both suite runs; an isolated rerun passed in 7.85 seconds. No ContextPopover production/test code or timeout was changed. Thus the aggregate web command is not reported as fully green. All new planning, permissions, export, fixture, source-freeze and corrected loading tests passed.
- Development-script suite passed all 15 tests. No process preset change was required.
- Workspace lint passed with the existing AI Material Master effect-dependency warning; final URL-hook/capability-fixture scoped lint also passed. Scoped HeroUI styles and native token checks passed.
- Global format check retains the same 85 existing warnings, with no new warning paths relative to the prior Projects baseline. One owned API fixture warning was formatted before the final check. All touched source, fixtures, plan, DESIGN, sidecar and brief passed scoped Prettier; scoped diff whitespace checks passed. No global formatting sweep was applied.
- Graph refresh completed after executable changes. Temporary Storybook and browser preview resources were cleaned up; canonical API3001/web3004 remain available.
