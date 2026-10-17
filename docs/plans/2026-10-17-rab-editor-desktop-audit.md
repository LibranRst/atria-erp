# RAB desktop editor audit

## Scope and direction

Audit and refine the existing canonical RAB workspace at `/projects/[id]?tab=rab`, including its item/manual-line, bundle and source-selection editor handoffs, document preview and revision/status context. Preserve Atria Operate and the accepted desktop grammar: compact Manrope, cool canvas, white owning panels, native HeroUI tables through public shared UI, capsule controls and existing modal owners.

Prioritize source unit/price/total readability, stored document order versus table sorting, bundle/member visibility and totals, exact cents, explicit edit affordances, source freshness, pending/failure/retry feedback, keyboard/focus, selection, dirty drafts and responsive continuity. The internal RAB workspace can expose permitted costing context; client preview/export must remain strictly client-safe. No invented margin, pricing formula, bulk save, automatic approval, publication or backend writer changes.

## Execution and acceptance

1. Read Graft, current product/design/sidecar/shared inventory, owner/actions and tests. Parallel read-only audits identify concrete findings before one coordinated change batch.
2. Inspect authenticated draft and approved/revision states in a separate dev-app tab. Capture incumbent user draft state; do not save/discard/navigate the user's Stock Opname or existing RAP tab. Do not mutate development business data.
3. Fix verified defects via public shared UI and incumbent hooks/forms. Keep permissions, source freezing, explicit review/approval gates, document order and export privacy intact. Use isolated real-owner mocked-action fixtures for writes, failure/retry, pending and permissions.
4. Verify desktop 1024/1280/1440 and mobile 320/360/390/430, short viewport, nested selects, native fallback, keyboard focus and drafts through resize. Inspect final settled screenshots in one bounded pass; confirm corrections once and stop polishing.
5. Run applicable focused tests, types, lint, format, scoped styles/tokens, detector and graph refresh. Keep heavy checks separate from timed DOM fixtures. Avoid a Next production build that reloads the user's unsaved form. Record existing unrelated full-suite popover timeout separately and do not claim a green whole suite without evidence.
6. Update design/surface guidance where contracts change, record acceptance/evidence and leave a real dev-app preview ready for the user.

## Completed findings and changes

| Finding                                                                                                                | Final behavior                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Draft Edit followed long context descriptions/facts and member commands stayed usable during pending work.             | The existing Edit action sits beside identity, before description; member openers use the same pending guard. No new table editor or save route.                                                                                                                                     |
| Read-only item subtotal was recomputed, and several item/bundle/preview money values rounded source cents.             | Read-only detail uses stored lineTotal. MoneyValue explicitly preserves fractional source amounts. Shared ValuePreviewStrip adds optional fractionDigits; RAB opts in while existing consumers retain defaults.                                                                      |
| Item visibility contradicted a hidden parent package.                                                                  | Effective client visibility and the item's own flag are distinct. Parent-hidden copy agrees with table/export without changing checkbox or payload.                                                                                                                                  |
| A draft bundle's shared editor checked status without its update permission.                                           | The editor also requires canManageRab; a read-only role gets the existing detail path. Server rights remain authoritative.                                                                                                                                                           |
| Failed actions lacked persistent modal feedback, emitted duplicate toasts or allowed pending intent changes/resubmits. | All six RAB editing families use existing inline error surfaces, one feedback owner, pending input/selection/action guards and new-intent feedback reset. Failure retains the draft for explicit correction/retry.                                                                   |
| Source/manual “Buang perubahan” retained abandoned input; bundle deletion closed its parent before receiving a result. | Owner callbacks restore existing initial selection helpers and empty manual defaults on explicit discard. Cancel retains edits. A failed bundle deletion keeps its parent, draft and error; only success closes it.                                                                  |
| Change Order UI claimed immediate approval/baseline change.                                                            | Copy describes the existing create → client-confirm sequence, followed by separate Owner/Finance approval. No approval call or business protocol was added.                                                                                                                          |
| Closing after desktop → mobile resize left BODY focused because the original invoker was hidden.                       | Shared optional fallbackFocusRef restores explicit logical target, then valid invoker, then business fallback. The stable labeled RAB region works across both presenters; same-presentation closes still return to the exact invoker. No feature implements visibility/focus logic. |

Reused public DesktopTable, Button, MoneyValue, ValuePreviewStrip, FormRiskNotice, shared form controls, OperationalFormSheet, FormSheet/DetailSheet and ConfirmationDialog. Only existing precision and focus interfaces were extended; no new primitive, route, stock/cash writer, pricing/export formula, schema, migration or bulk save was introduced.

## Actual dev-app verification

Used the authenticated Owner session at port 3004: Brawijaya's RAB draft, 12 root rows and 34 bundle members, plus Menteng's approved RAB and source picker. No RAB create/save/approve/void/delete, revision generation, stock/cash action, upload, download or share was executed in the dev app.

- Page layout at 1024/1280/1440 and mobile 320/360/390/430 has no document overflow and starts unselected. Desktop tables become the incumbent mobile composition below the breakpoint.
- Selected Pantry context exposes Edit near identity and exact Rp 11.828.542,55 / Rp 106.456.882,95. The same existing package editor shows matching fractional amount in its main preview and aside.
- A locally modified package name and its unit selector survived all seven widths plus 1024×600. All dialog/listbox bounds remained inside the viewport. The selected existing unit could be chosen; QA name edits were restored and closed without saving.
- Live desktop-open → 320px clean-close focuses the visible RAB proyek region. At 1024px selected context focuses Back; keyboard Back restores the exact Pantry row and clears selection.
- Live Source discard restored 37 initial sources after temporarily deselecting one. Live Manual discard reopened with an empty name. These were local test intents, without invoking generation or save.
- Approved Menteng shows revision/export actions, no Edit controls. Its revision source picker was inspected and closed without creating a revision.
- Sorting the table by price placed the standalone countertop package first; client preview retained its Kitchen group before that standalone package. The hidden “Opsi dekorasi tambahan” row was absent from preview. Existing source order/grouping, bundle totals and client-safe projection remain unchanged.

Evidence directory: `/tmp/atria-rab-editor-audit-2026-10-17/`, including page/editor matrices, context-final-1440.png, editor-select-final-320.png, export-preview-final-1440.png and export-order-visibility.json. Failure/pending/custom-role/hidden-parent cases use real-owner fixtures with mocked HTTP actions; they were not simulated by changing development records or grants.

## Draft preservation

The user's existing Stock Opname and RAP tabs were captured before edits. Shared sheet hot reload reset the open Stock Opname to a fresh blank local form. Root restored the original document/note through normal UI and selected the original location. Its eight quantities already matched. All 10 field values, location, two original overlay layers and original 1499×954 viewport were verified exactly after restoration. No save, discard, review/post or navigation was performed on that user-owned workflow. This restoration is distinct from the earlier RAP task, where no restoration was needed.

## Verification

- Combined web regression: **58 passed, 0 failed, 261 Bun assertions across 14 files**. Includes actual RAB context/editor ownership, all six editing families, pending selection/submission races, failure/retry, discard/reopen, failed bundle removal, same/cross-presentation focus, shared nested selections, RAP source freezing and direct editing, import boundaries, document/export privacy, cents and order.
- Core workspace: **487 passed, 0 failed, 1,774 assertions across 94 files**.
- Scoped Impeccable detector: no findings. Source-only/DOM fixtures use mocks; no database reset or business writes.
- API/web/mobile TypeScript, workspace lint, global format, tokens/scoped HeroUI styles and graph refresh passed. Three integration type errors were repaired locally (the preview's 0/2 digit contract, a nullable item callback guard and the string-only void-reason setter). The six-editor fixture passed again after those guards (9.89s), and scoped lint/format for the repaired files remained clean.
- The whole workspace suite was not rerun for this bounded change. Its previously recorded unrelated ContextPopover child-lifecycle timeout is not claimed resolved. No Next production build is run while the restored user draft remains open; TypeScript, generated-style checks and actual development compilation cover this presentation scope without forcing another reload.

Native fallback at 1440px also retained the 448px mobile shell without visible desktop tables or horizontal overflow. Final screenshot evidence includes rab-final-1024.png, rab-final-320.png and native-fallback-final-1440.png. Independent read-only finish review: **SHIP**, no material blockers; compact read-only bundle amounts intentionally retain exact title/accessible values through the shared money contract.

Validation logs: `/tmp/atria-rab-editor-regression.log`, `/tmp/atria-rab-editor-core-tests.log`, `/tmp/atria-rab-editor-web-types.log`, `/tmp/atria-rab-editor-api-types.log`, `/tmp/atria-rab-editor-mobile-types.log`, `/tmp/atria-rab-editor-lint.log`, `/tmp/atria-rab-editor-format.log`, `/tmp/atria-rab-editor-style-check.log` and `/tmp/atria-rab-editor-detector.json`.

Status: **complete — ship**. The real development RAB preview remains available with no selected row, open editor or unsaved QA intent. The user's restored Stock Opname values/location/two layers and original RAP URL remain preserved; no business records were written.
