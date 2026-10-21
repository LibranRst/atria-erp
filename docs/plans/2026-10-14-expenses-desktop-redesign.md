# Pengeluaran desktop redesign

Date: 2026-10-14. Status: implemented and verified. Final finish-review disposition: **ship**.

## Approved scope and structure

The user approved the recommended Pengeluaran desktop redesign: compact toolbar, native HeroUI table, contextual detail on the right, and matching skeleton/empty/error states. Also align the Settings allocation explanation with its heading. Inherit the current Atria Dashboard/Settings language (Manrope, cool canvas, white desktopPanel owners, native 20px tables, compact capsule controls and shared motion). This is a precisely specified extension of the established workspace; no identity/concept tournament is needed.

The canonical `/expenses` route includes Pengeluaran Lapangan and Tagihan Vendor, with tagihan/pembayaran peer views. Adapt all these route views at >=1024px; existing mobile/native-pinned and embedded project composition remain authoritative. At >=1280px use list + contextual detail columns; narrower desktop has list/detail progression without squeezing table columns. Keep the page header and meaningful tab summary compact, use inline search/project/category/status/date controls appropriate to each collection, sort/filter the full authorized data before 10/25/50 pagination, and preserve stable row/draft/overlay owners through resize. Hide no legitimate existing action or draft recovery workflow.

## Data and ownership

The existing API loader reads complete cost, bill and payment collections and applies the current cost/domain/project scope and bank redaction. Reuse these DTOs, finance calculations, access predicates, HTTP facades, hooks and Server Actions. No new backend query, migration, finance/material formula, ledger/stock mutation or development seed is required. Only present provided facts; do not fabricate invoice dates, receipt statuses, canonical budget amounts or approval identities absent from the DTO.

Public shared UI remains authoritative: DesktopTable, DesktopTablePagination, SegmentedTabs, SearchInput/FilterSelect, GroupedSurface.desktopPanel, MoneyValue, status, tooltips and shared overlay wrappers. No feature Hero imports, new table/selection/focus/overlay infrastructure or bulk finance actions. Field verification/disbursement and vendor scheduling/disbursement keep their existing permission guards, explicit handlers and modal/recovery owners. Main manual-entry/OCR drawers already have their two-panel contract; preserve it and expose their existing route actions.

## Work allocation

- Root: Settings alignment, ExpenseList route/header/navigation integration, URL intent, responsive skeletons, safe complete-page stories, docs and QA.
- Field presenter: Pengeluaran Lapangan desktop comparison band, toolbar, native full-result table/pagination and purpose-built fact/action detail. Preserve mobile/project lists and FieldClaimRow/history and parent operation callbacks.
- Vendor presenter: tagihan/pembayaran desktop toolbar, native full-result table/pagination and detail using existing totals/status/operation hooks. Preserve mobile/project cards and sheets.
- Read/data/fixture audit: validate supplied collections, action/access/scoping invariants and support isolated representative fixtures without database mutations.

## Acceptance

Use representative populated, empty and limited-permission fixtures; no real verification/payment/save. Cover both tabs and vendor subviews, toolbar filters, sorting across pages, truthful totals, status/history, row selection, receipt opening and existing action entry points. Verify overlays/draft recovery and resize, keyboard/focus, reduced motion and native fallback. Inspect desktop 1024/1280/1440 and mobile 320/360/390/430 in one batched pass, fix findings in one batch and confirm once. Check alignment of Settings explanation with the heading.

Run meaningful scoped/full web tests, TypeScript, lint, scoped format, build and HeroUI/token/diff checks. Record existing unrelated failures separately. Update the Expenses surface brief and built design contract; refresh Graft. Clean task-owned QA resources while keeping user browser/dev services intact.

## Implemented result

Standalone Pengeluaran Lapangan and Tagihan/Pembayaran Vendor now use compact comparison bands, contextual filters, native shared tables and 10/25/50 pagination. Sorting and filtering run over the complete authorized collection before paging. Shared presenters retain selection and control state above responsive composition; focused controls and open overlays keep their presentation while resizing. Empty and filtered-zero collections use the full workspace width; a detail column exists only with actual selected context.

Field rows combine description with one concise project/requester line; full supplied facts remain in the detail panel. New desktop money presents compact primary values with exact fractional rupiah in accessible labels/tooltips/detail. Draft recovery is a compact disclosure with truthful loading, failure/retry and empty behavior. Read request sequencing prevents stale draft responses replacing newer data. Existing forms, confirmation, verification, scheduling, disbursement, activity detail and receipt owners remain authoritative.

The toolbar exposes manual entry and Scan nota through the existing global expense form. Receipt intent changes its introductory guidance without overwriting drafts or submitting/uploading automatically. Vendor-only permissions land on the available peer view; field history/rejected deep links parse correctly. No backend mutation, schema, budget/margin calculation, ledger/stock behavior or database seed changed. Mobile/project workflow composition is retained; touched header typography follows existing public type tokens.

Settings allocation explanation uses the same inset as its heading. Actual browser measurements at 1280px: both left edges are 236px.

## Verification and evidence

- Populated claims, bills and payments inspected at desktop 1024/1280/1440 and mobile 320/360/390/430; document width stays within every viewport. Desktop tables retain internal containment. Three structural skeletons and native-pinned presentation also verified.
- Representative isolated fixtures contain 36 claims, 30 vendor bills/payments, scoped projects and valid drafts. Read-only, assigned scope, vendor-only, empty, source failure and draft loading/failure scenarios verified. Fixture writes return explicit errors and cannot contact the development backend. Actual `/expenses` integration read checked separately; its supplied field collection was empty for the current QA actor.
- Browser interactions verified category/month filtering, full-result numeric sorting resetting to page one, next page, 25 rows, truthful zero totals, keyboard history tabs, reduced motion, smaller-desktop detail/back, receipt overlay/Escape, and guarded action entry points. Vendor bank selection and nested expense project/item/category selection work. Input and chosen bank survive resize; dismissal returns to the existing draft confirmation owner. No real payment, verification, upload or save was performed.
- Final Expenses suite: **47 passed**, plus **5 explicit Storybook fixture tests**. Full web suite: **1,111 passed**. Development preset/token scripts: **15 passed**. API, web and mobile TypeScript and full workspace build pass; final web rebuild after the context-layout fix passes. Workspace lint passes with its pre-existing material AI proposal effect dependency warning. Touched-file format, scoped HeroUI styles, token synchronization and diff checks pass. Design detector returned no findings.
- `bun run test` had one unrelated API PDF rasterization subprocess failure (`pdf-pages.test.ts`, limits case) during the concurrent workspace run. A subsequent isolated run passed all six PDF cases. The overall initial command therefore retains a failed result; it is not reported as a fully green workspace test run. Live Postgres suites remain skipped without a disposable test database.
- Repository-wide format check reports **86 existing files** outside this task's touched files. Do not format unrelated work. The unchanged mobile field summary can crowd its exact total/support text at 320px with large fixture amounts; recorded as incumbent behavior outside this desktop redesign.

Proof captures are under `output/qa/2026-10-14-expenses/`: populated claims at 1440, vendor bills at 1280, full-width empty claims and settled native fallback. Complete viewport/state captures and command logs are also in `/tmp/atria-expenses-proof/` and `/tmp/atria-expenses-*.log` for this local run.

## Finish review

A separate fresh reviewer used the shipped degraded reviewer contract because no dedicated reviewer definition is included in this skill installation. Its five-section review found the established identity, populated composition, structural loading and scoped mobile preservation consistent. Its sole material fix was the reserved empty detail column. Field and vendor owners fixed this in one batch, then the same reviewer scored final recaptures:

| Material fix                                                                                                     | Final score | Disposition |
| ---------------------------------------------------------------------------------------------------------------- | ----------- | ----------- |
| Remove reserved empty detail column in claims/bills/payments and filtered-zero results; preserve populated aside | resolved    | **ship**    |

Native fallback pill geometry/contrast is confirmed in the settled capture; initial CDP captures caught an incomplete painted animation frame. No shared tab change was needed. The built Expenses contract is recorded in DESIGN.md, its sidecar and the skill-generated Expenses surface brief. Task-owned Storybook/browser QA resources are cleaned; user services and tabs are preserved.

## Follow-up: responsive active row and detail actions

The user clarified that native active highlighting should remain. The bug is fallback first-row selection below 1280px while the right detail panel is hidden. Revert the temporary plain-selection appearance override and keep native HeroUI selection styling. The shared viewport store derives whether the right aside is visible; only then do the three standalone desktop Expenses tables receive the context row as native selection. The narrow list receives empty native selection, so its first row can open detail on one click. Explicit selection/context stays in its existing owner across resize; no resize effect resets IDs. Vendor bill/payment footer actions retain the requested two columns from 512px actual owning-panel width and one column in the 288px aside; guarded single actions fill the row. Verify narrow initial/Back selection, first-row single click, wide highlight with context and resize, plus existing checks, without financial mutations.

The previous footer verification remains valid: at 1024px both actions share the same y-position and equal 364px widths; at 1280px the aside uses equal 256px buttons stacked with 8px gap. Full-width bill actions follow the same container contract. The actual user's payment detail also shows both actions at the same y-position with equal 424.5px widths. Proof: `output/qa/2026-10-14-expenses/payment-actions-1024.png` (current user's full-page detail capture; filename retains the initial test viewport). Native row-selection correction and its regression results are recorded below after verification.

Responsive selection correction verified: narrow bill/payment lists have zero selected rows and zero current-row annotations; one click on the first row opens detail, and Back returns an unselected list. At 1280px the visible right context restores one native highlighted/current row. Choosing a nonfirst bill and narrowing preserves the same detail identity, while Back clears only the existing explicit selection. React Aria's nested row collection now receives its selection/review dependencies so cached cell annotations cannot remain stale after resize or Back; collection keys and form owners stay stable. The actual-presenter DOM regression covers field claims, bills and payments at 1093/1280/1440px, with no API/database calls. All 57 scoped tests pass; TypeScript, scoped lint/format, regenerated styles, token and diff checks pass. Proof captures: `narrow-list-no-active-row.png` and `wide-active-context.png` under the same QA output directory. The native highlight and two-column full-detail footer are both retained.
