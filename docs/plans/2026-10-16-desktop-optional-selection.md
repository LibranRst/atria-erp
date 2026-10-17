# Optional row selection across desktop workspaces

## Scope

Apply the approved `/approvals` behavior to every contextual desktop table in unified `apps/web`: start unselected, choose a row through pointer/keyboard, and activate the selected row again to clear its selection and detail. With no detail selected, the table uses the available width. Preserve native narrow list/detail/Back, explicit selection through resize, pending guards, source freshness and existing dirty-draft/discard ownership.

Reuse the existing public DesktopTable `onRowSelectionChange(row | null)` native HeroUI/React Aria contract. Remove feature and owner-level first-row fallbacks; do not implement per-feature toggle/focus infrastructure. Row commands that open a route, editor or protected modal remain commands and already start without selected context. Multirow review inclusion, checkbox selections and editable review expansion keep their existing business meaning. No data, permissions, calculation, writer or bulk-workflow change.

## Inventory and work allocation

- Projects: portfolio, overview/budget categories, Margin, RAP, RAB, project stock/material movements and invoices/receipts. Embedded Pengeluaran shares the Expense owners below.
- Expenses and Reconciliation: field claims, vendor bills/payments, bank/cash/history context; retain recent loading-continuity and validation fixes.
- Material and Settings/Administration: inventory, needs and activity; roles and user/vendor editors require existing draft-close guards. Inspect catalog/settings row commands separately.
- Dashboard, Profile, Onboarding and shared inventory audit: account context and any remaining selection owners; navigation/editor commands retain their interaction contract. Approvals remains the reference.

## Verification

1. Record all production DesktopTable/selectedRowKey/onRowAction consumers and distinguish context selection, row command, static data, skeleton and review inclusion.
2. Extend existing behavioral fixtures for empty initial selection, pointer/Enter/Space select-clear, another row, narrow Back, resize, source/filter changes, and dirty/pending protections as applicable. Never reset/seed or mutate the development database for QA.
3. Run the relevant feature/shared suites, TypeScript, lint, formatting, scoped HeroUI styles and token checks; preserve unrelated work and record existing failures separately.
4. Use the real dev website for representative routes including Reconciliation, Expenses, Material, Dashboard, Project and Settings; check desktop 1024/1280/1440px and mobile 320/360/390/430px/native fallback in bounded passes. Retain a canonical dev page for the user.
5. Update DESIGN, its sidecar and relevant surface briefs to make explicit optional selection the desktop rule, then refresh Graft and perform a bounded independent review.

## Status

Completed. Plan was saved before executable edits. All 16 remaining contextual selection sites now reuse the approved optional-selection contract. No first-row selection fallback remains in those presenters/owners.

## Consumer audit

The exhaustive inventory contains 17 contextual DesktopTable selection sites across 14 production files (16 migrated plus the approved Approvals reference). They share native nullable selection; invoice/receipt and bank/cash/history views reuse their corresponding collection presenters. Dashboard account/approval tables, Profile access, Onboarding opening-stock batches, Settings library/material catalog, RAP setup/package rows and RAB revision/editor rows open existing routes or protected overlays and never fabricate an initial context selection. Administration user/vendor/role editors also begin closed/unselected and retain their guarded close/discard owner. Static, skeleton and multirow review tables have no contextual row selection to migrate.

## Results and evidence

- Projects: all eight contextual presenter bindings migrated, including overview/Margin category-close callbacks and explicit-only RAP/RAB model helpers. Existing portfolio/payment/stock/Margin owners retain their guarded drafts and actions. A new real HeroUI ten-scenario DOM matrix covers empty initial selection, pointer/keyboard clearing, narrow Back, resize and applicable pending guards. Forty-two model/render tests and the existing owner regressions passed.
- Expenses/Reconciliation: four expense bindings and the generic three-view reconciliation table use nullable selection. Vendor pending state reaches its table owner; deselection clears stale reconciliation detail. Twelve scoped tests passed with tab continuity, source errors/retry, refresh selection, exact amounts and pending/resize coverage retained.
- Material: inventory, needs and activity presenters have no automatic context fallback; pending/open activity workflows retain their guards. Thirteen scoped tests passed, including actual input filtering, source removal, pointer/Enter/Space, resize and pending behavior. Settings/Administration editor commands were audited and their protected dismissal left intact.
- Live dev checks: Reconciliation, field expenses, Material inventory, portfolio, project Budget, Margin, invoice, RAP, RAB and project stock all began unselected and completed select-clear cycles. Dashboard accounts, Settings allocations and internal-team command tables were also initially unselected. No development match, approval, payment, import or stock mutation was performed.
- Desktop 1024/1280/1440px selection/clear and narrow Back passed; mobile 320/360/390/430px and native fallback retained their composition with no document horizontal overflow. Viewport overrides were reset. Proof is in `/tmp/atria-desktop-optional-selection-2026-10-16/`; `final-unselected.png` is the retained canonical `/reconciliation` dev preview.
- Full `bun run test` passed: 2,687 tests, zero failures; 560 existing live-integration skips. Breakdown: API 837, core 486, web 1,197, mobile 107, icons 4, API client 14, transitional admin 27 and dev scripts 15. Tests used the workspace's safe preloads; no database reset/seed was run.
- Full build passed for API, web, transitional admin and Expo iOS/Android. Next output used `.next-selection-build`, preserving the running dev instance. Final web TypeScript passed after correcting new fixture nullability with runtime narrowing; no `any` or casts were introduced.
- Workspace lint passed with the existing `accept` effect-dependency warning in `material-master-proposal-card.tsx:171`. Scoped HeroUI style and token checks passed. All touched files passed scoped formatting; global formatting still reports the same 83 existing paths. Logs: `/tmp/atria-desktop-optional-selection-{tests,build,lint,format}.log`.
- Independent bounded review found no remaining actionable defect in Projects/Material; command-only rows and business review inclusion retain their meaning. DESIGN, its sidecar and relevant surface briefs now define explicit optional row selection. Graft was refreshed after source changes.
