# Phase 4 — Project, Budget, RAP/RAB, and Settings Forms

## Outcome

- Project create/edit is recoverable, explicitly reviewed, protected from accidental close, and only exposes safe status transitions.
- Budget, RAP, and RAB repeated inputs are compact until edited, show immediate calculated impact, and require an explicit review or confirmation before business-status changes.
- Settings forms use the same visible-label, validation, dirty-guard, and centered-confirmation patterns as operational forms.
- Existing RBAC, project scoping, Drizzle transactions, audit logs, project-closing rules, category budget workflow, and client-safe RAB boundaries remain unchanged.

## Audit findings

### Project

- Create/edit relies on component state only; close or reload loses work.
- Create submits directly from the long form without a review of client, PM, timeline, or initial status.
- Project success is a generic sheet and repeats two equivalent navigation actions.
- Edit exposes `COMPLETED` even though the server correctly requires Project Closing Checklist.
- Date order and cover-file constraints are not explained before submit.

### Budget

- Item creation is always expanded and mixes legacy RAB/BoQ vocabulary with Project Budget.
- Draft submission and Owner approval execute directly from inline buttons without a concise impact confirmation.
- Rejection reason is rendered inline instead of using the shared centered decision modal.
- Existing status guards are useful and remain the source of editability.

### RAP/RAB

- Material, package, bundle, source, and revision editors remain bottom sheets because they are data-entry surfaces, but their status-changing actions need explicit centered confirmations.
- Repeated items need compact summaries and calculations before save.
- Approved/void records remain immutable; correction continues through revision/change-order/void workflows.
- Client-facing RAB review must continue excluding internal cost, margin, vendor, stock, RAP notes, and other internal fields.

### Settings

- Material and price-library forms have useful defaults but close immediately even when dirty.
- Budget allocation changes need a before/after review because they become defaults for future projects.
- Archive/reactivate already uses the shared centered confirmation pattern and remains unchanged.

## Implementation slices

1. Project create/edit: local recovery, smart defaults, dirty guard, prepare/review/final submit, safe status options, upload validation, and durable success actions.
2. Project Budget: compact add-item editor, live subtotal, submit/approve/reject decision modals, and consistent Project Budget vocabulary.
3. RAP/RAB: compact repeated-item summaries, contextual fields, explicit status-change confirmations, and client-safe review verification.
4. Settings: local recovery or dirty guard for short forms, allocation review, contextual fields, and centered destructive confirmation.

## Minimal verification

- Run strict TypeScript once after the slice is complete.
- Run ESLint only for changed files.
- Run focused project/budget/RAP/RAB/settings unit tests; do not run the full suite or production build unless focused checks reveal a cross-module problem.
- Use `git diff --check`; browser QA is limited to the highest-risk Project and Budget mobile flows.

## Implementation record

- Project create/edit now has immediate local recovery, a sole-PM safe default, date and cover validation, a review step, a centered unsaved-change decision, durable success actions, and UI/server guards for immutable completed or cancelled projects.
- Project Budget now uses a compact add-item entry point, live subtotal feedback, consistent Project Budget vocabulary, and centered decisions for submit, approve, reject, and dirty close.
- RAP/RAB editors remain sheets only where users enter or inspect data. RAB approval and bundle dismantling now use centered confirmations, while approved records continue through revision/Change Order workflows and client-safe validation remains unchanged.
- Budget allocation, category, material, inventory, and price-library Settings now distinguish data-entry sheets from centered confirmations, protect dirty edits, and preview the future-project impact of allocation changes.
- Verification completed with `git diff --check`, targeted ESLint for the changed Phase 4 files, strict TypeScript, and 25 focused tests across project recovery, RAP/RAB calculations and selection, client-safe validation, and Settings validation. The full suite, production build, and browser QA were intentionally not run for this slice because focused checks found no cross-module issue.

## Full-suite and browser-QA remediation

The later full browser pass found that several earlier edits targeted a legacy Project Budget component that is no longer rendered, while active Project, RAP/RAB, and Settings editors still inherited the icon-only `SheetActionButton` pattern. The remediation therefore targets reachable surfaces rather than extending the legacy budget editor:

1. Move the primary submit action in `OperationalFormSheet` from the header icon into a keyboard-safe, safe-area footer with a complete action label.
2. Reorder Project identity fields so Project Manager is part of required setup, then hide optional cover, dates, location, area, type, and notes behind explicit progressive disclosure for new projects.
3. Migrate active RAP material, Tukang/Subcon package, internal revision, RAB source/manual-item, and Change Order entry sheets to the shared labeled footer action.
4. Migrate Category and inventory-default Settings editors away from header check icons and finish operational Bahasa Indonesia copy on the touched form surfaces.
5. Repeat browser checks at 320, 390, and 430 px, including dirty close and centered confirmations. Do not create, approve, post, or otherwise mutate final finance/stock records during visual QA.

## Structural UI rework after browser review

Browser review showed that moving the CTA alone did not make the active Phase 4 forms match the mature Phase 1–3 workflow. The remaining forms still exposed database-shaped field stacks, repeated summaries, and legacy cards. Before final verification:

1. Recompose Project identity and client selection with the shared section hierarchy, a clear existing/new-client mode, compact optional disclosure, and a preview-oriented review step.
2. Recompose RAP material and Tukang/Subcon package entry into source, identity/scope, and quantity/cost sections. Keep calculated need-to-buy and estimated cost visible while editing.
3. Recompose RAB source, manual line, item edit, and bundle entry with compact source selection, progressive manual entry, client-safe context, and live value previews.
4. Recompose Material Master and Item & Price Library Settings into logical sections; hide advanced/source/default inventory fields until relevant and remove legacy bordered form cards.
5. Use only shared `FormSection`, value/risk preview, fully rounded inputs/actions, footer CTA, centered confirmation, and Atria motion tokens on migrated surfaces.

## Final verification result

- Active data-entry shells open expanded for long forms, preserve natural height for short forms, remain draggable, and keep their safe-area footer visible without covering the first actionable inputs.
- Project create was checked at 320 px; RAP revision and Material Master at 390 px; RAB source selection and Library Item & Harga at 430 px; Category at 320 px; and Alokasi Budget at 390 px.
- Centered dirty/destructive/status confirmations remain implemented through `ConfirmationModal`; `ConfirmationSheet` is now only a compatibility wrapper that renders the same centered modal, not a drawer.
- Browser console verification returned zero errors. Visual QA did not submit, approve, create, post, or mutate final project, finance, or inventory records.
- `git diff --check`, strict TypeScript, ESLint, all 129 tests in 28 files, and the Next.js 16.2.9 production build passed. The build reports expected dynamic-route notices when authenticated routes read cookies, then completes with those routes correctly marked dynamic.

## Corrective UI pass — adaptive drawers and Settings editing surfaces

The expanded-by-default remediation made long forms reachable, but it also forced short and medium drawers to fill the viewport and left several Phase 4 surfaces visually inconsistent with the Expense flow. This corrective pass replaces that workaround with the following stable rules:

1. Bottom sheets open at their measured natural height, up to the available visual viewport. Short content does not scroll; overflowing content opens full-height and scrolls only inside the body. Medium drawers can still be dragged between natural and full height.
2. Phase 4 form footers use the same single operational status sentence as Expense. Rich calculations stay inside the form, while repeated editable items use compact completeness rows.
3. Existing/new client and other true mode switches reuse the shared `SegmentedTabs`; selectors remain selectors when they choose business data rather than UI modes.
4. Optional form areas reuse one shared disclosure pattern with a visible icon, filled-count summary, motion tokens, and a clear expanded state.
5. Category, Material Master, Item & Price Library, inventory defaults, Budget Allocation, and Settings filter controls are recomposed as one form system. Settings navigation, module headers, RBAC, Server Actions, and persisted business contracts remain unchanged.

Verification for this corrective pass must include drawer sizing unit tests, strict TypeScript, ESLint, the full Bun test suite, production build, and browser QA at 320, 390, and 430 px without submitting final business mutations.

## Corrective UI pass — verification result

- The shared drawer calculation is covered for short, medium, long, and keyboard-reduced viewports. Browser QA confirmed a medium RAP drawer opens at its 663 px natural height, expands to the 8 px viewport inset, returns to natural height, and switches to full-height with an internally scrollable body at a 600 px viewport.
- Project client mode and operational disclosure were verified at 320 px; Material Master, Budget Allocation, RAP revision, and RAB source selection at 390 px; Library Item & Harga and its nested component editor at 430 px. Category editing was also checked at 320 px.
- Library validation no longer marks untouched required fields invalid on first open. Footer copy still explains the next required action without presenting a premature error state.
- Browser console checks returned zero errors and zero warnings. QA did not save, submit, approve, post, or otherwise mutate project, finance, budget, or inventory records.
- `git diff --check`, strict TypeScript, full ESLint, all 133 tests across 29 files, and the Next.js 16.2.9 production build passed.
