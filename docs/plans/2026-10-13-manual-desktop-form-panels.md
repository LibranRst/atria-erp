# Manual desktop form panels

Status: complete on 2026-10-13. Approved scope, exceptions and review policy delivered; unrelated workspace failures recorded below.

## Purpose and agreed decisions

Optimize desktop manual input for Owner, Finance, Purchasing and project-scoped users without changing their workflows or permissions. Use the existing Atria AI form composition: a wider editor/review pane beside concise context and protected actions.

Confirmed decisions:

1. Two panels apply when the form has substantial input or meaningful context. Short names/reasons and ordinary confirmations remain compact; no filler aside.
2. Scope is all manual input modal/sheets, including their edit and review stages. Dedicated full-page editors retain their own layout.
3. Existing entry → review → save/submit and confirmation steps remain. Desktop does not bypass review or introduce a new business action.

Mobile/native-pinned web remains the established one-column presentation. No independent admin app, bulk workflow, database reset, new finance calculation or AI action is introduced.

## Composition

- **Left:** grouped editable fields, document uploads, item rows and reviewed changes. Improve grouping, density and hierarchy for desktop rather than merely stretching mobile spacing. Keep errors beside their field or the relevant context/recovery control.
- **Right:** concise live draft summary, completeness/readiness, selected project/account/vendor context and relevant existing budget/stock/payment consequences. Reuse existing calculation/validation results; proposed values are explicitly draft/preview values. Unknown or failed sources must not appear healthy.
- **Actions:** use existing primary/secondary action labels, pending/disabled guards, draft sync state and reasons in the shared protected aside footer. Long context scrolls above those actions; the main pane has its existing independent bounded scroll. Avoid repeating totals/counts in several desktop locations.
- **Exceptions:** short compact edits/reasons, destructive confirmations, calendar/selection dialogs, success/detail-only panels and notification popovers keep their owning interaction contract. Full-page editors and authentication/bootstrap pages are outside this change. Password summaries expose criteria/readiness only, never passwords.
- **Responsive behavior:** desktop starts at 1024px, using existing shared wide sheet sizing and viewport gutters. Test dense item forms at this width. Layout changes retain field/draft/selection state and the existing overlay owner; mobile keeps its current summary order and bottom actions.

Atria Manrope, cool gray canvas, white grouped surfaces, ink/terracotta, capsule controls and compact HeroUI adapters remain the visual authority. No new palette, theme reset or feature-level overlay infrastructure.

## Shared ownership and reference

Reuse public `FormSheet`, `OperationalFormSheet`, `WorkflowFormSheet` with `desktopSize="wide"`, `desktopFooterPlacement="aside"` and `desktopAsideSummary`. Compose `GroupedSurface`, divided `FactRow`, `MoneyValue`, `FormSection`, `FormField`, `FormDisclosure`, existing status/feedback and `SheetFooterActions`.

Shared `BottomSheet` continues to own sizing, viewport centering, the main/aside scroll planes, focus, dismissal, body lock, portal layering and motion. The aside reserves 256px for 224px of content plus shadow gutters. Wide sheets cap at 1024px with 24px viewport clearance. Neither features nor summary content add a second focus trap, scroll container or footer owner.

Existing editable AI reference: `conversation-history-workspace.tsx` assistant preferences and `material-master-proposal-card.tsx` correction/reference forms. `DESIGN.md` already records the AI Desktop Form Panel Rule. The shared slots already support editable manual input; a new modal primitive is not needed.

## Inventory and implementation order

The factual upper bound is 55 non-AI Operational/Workflow sheet call sites across 49 feature files, plus the already-two-panel RAB export. It includes review-only, activation/matching and a mobile-only sheet branch of an existing desktop page. This is not a claim that 56 distinct editable desktop forms require conversion.

During implementation, record each actual owner as converted, already conforming, compact, read-only/outside scope or full-page/outside scope. The work is complete only when every eligible manual modal/sheet has been accounted for.

| Order | Family                       | Representative owners and context                                                                                                                                                                   |
| ----- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Pengeluaran and vendor bills | Expense entry/review, expense item editor, vendor bill entry/review, nested vendor creation; project, category, items, totals, receipt and draft readiness.                                         |
| 2     | Cash and payments            | Account, manual movement, transfer, scheduling/disbursement, invoice and client receipt; selected accounts, exact existing balance preview, outstanding amount and payment guards.                  |
| 3     | Projects and planning        | Project setup/review, budget item/allocation, Tukang/Subcon package, RAP item/revision, RAB item/source/bundle/change order; project identity, allocation/row totals and existing impact/readiness. |
| 4     | Material and inventory       | Goods receipt, adjustment, stock operation/count/transfer, opening stock, material editor/import; quantities, source/destination, current stock context, audit note and existing validation.        |
| 5     | Settings and administration  | Budget defaults/formula, thresholds, library/cost components, vendor/user/role forms, inventory defaults; selected configuration, completeness, permissions/scope and applicable locks.             |
| 6     | Remaining input surfaces     | Profile/security, reconciliation import/manual statement/exception/match and onboarding modal defaults; safe identity/security guidance, file/row counts and existing validation.                   |

Keep existing full-page library/template editors outside the modal migration. Preserve the established wide RAB export rather than replacing it.

## Workflow constraints

- Expense item entry requires a selected project with available budget categories. The initial blank item, duplicate and add actions must share that prerequisite and explain what is missing; an already-open item editor must describe unavailable categories instead of presenting an inert selector. Verify both missing-project and empty-budget states, then category selection within the real nested desktop sheets and mobile presentation using isolated fixtures.
- Expense/vendor bill hybrid drafts, OCR warnings, item ordering/undo, offline sync, conflicts, dirty close and project-change guards remain with their existing owners.
- Material procurement/receipt and payment remain distinct. A bill/material summary must not imply that procurement alone consumed budget or moved cash. Reservation/use do not imply payment.
- Account/transfer/payment previews use their existing calculations and server validation. Existing review, insufficient-funds, overpayment, approval and reconciled immutability rules remain authoritative.
- Allocation limits and mandatory audit reasons remain. RAB preview/export stays client-safe; internal cost/margin/vendor notes must not enter client output.
- Role/system locks, live permission checks and assigned-project scope remain. Permission loss removes access immediately, even while a draft/overlay is open.
- Existing `discard`, `confirm`, `preserve` and `managed` dismissal policies and presence-retained entities remain. Header X, backdrop and Escape follow the same policy; pending actions cannot be repeated.
- Loaders/actions/DTOs retain public signatures. This redesign uses existing data and typed facades; no business rule moves into a layout component.

## Validation and completion

Use representative fixture data and empty/error/pending cases without resetting development data. Cover short/long names, multiple expense categories, dense item lists, unavailable context, draft sync/conflict, permission restrictions and validation failures.

- Verify eligible families against the migration matrix, including entry/review/back/edit/close and existing submit associations.
- Verify desktop at 1024/1280/1440px and mobile at 320/360/390/430px, native `surface=mobile`, resize with dirty input/open selections, nested overlays, keyboard/focus restoration and reduced motion.
- Confirm primary actions stay visible while either pane scrolls, amounts do not wrap, and there is one focus/dismissal owner.
- Run workspace TypeScript, tests, lint, scoped format, web build, HeroUI scoped style and token checks. Record unrelated failures separately. Financial/material mutation tests use a disposable test database when required.
- Update plan status/matrix, DESIGN, its sidecar, relevant surface briefs and representative shared/feature stories to the delivered behavior.

## Source references

- Public UI inventory: `apps/web/components/ui/index.ts`.
- Shared wrappers: `apps/web/components/ui/form/guided-form.tsx`.
- Geometry/aside/footer: `apps/web/components/ui/overlay/bottom-sheet.tsx`, `sheet-footer-actions.tsx`, `semantic-sheets.tsx`.
- Initial manual reference: `apps/web/features/expenses/components/forms/expense-form.tsx`, `vendor-bill-form.tsx`.
- Existing editable AI reference: `apps/web/features/ai-chat/components/conversation-history-workspace.tsx`, `proposal-cards/material-master-proposal-card.tsx`.
- Existing client-safe export: `apps/web/features/projects/detail/components/rab/rab-export-drawer.tsx`.

## Delivered owner matrix

The exhaustive current-source audit accounts for all 55 non-AI Operational/Workflow call sites: **44 converted and 11 retained exceptions**. The sole direct manual `FormSheet`, RAB export, already conforms. Five compact name/reason dialogs remain compact. No additional manual `GuidedFormSheet`, `ConfirmationSheet` or raw `BottomSheet` owners were found.

| Family                                       | Converted owners                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expenses/payments (6)                        | ExpenseForm; ExpenseLineEditor; VendorBillForm; FieldDisbursementSheet; VendorSchedulePaymentSheet; VendorDisbursePaymentSheet                                                                                                                                                                                                                             |
| Accounts/cash (3)                            | AccountFormSheet; MovementSheet; TransferSheet                                                                                                                                                                                                                                                                                                             |
| Projects (15)                                | ProjectDrawer; ProjectReviewSheet; BudgetItemForm; ProjectOverview allocation editor; ClientInvoiceForm; ClientPaymentSheet; CategoryPlanFormDrawer; RapMaterialFormDrawer; InternalRevisionDrawer; RabSourcePickerDrawer; ManualRabLineDrawer; RabItemEditDrawer editable branch; RabBundleDrawer editable branch; ChangeOrderDrawer; StockOperationSheet |
| Material/settings (11)                       | GoodsReceiptSheet; EmergencyAdjustSheet; ProjectMaterialOperationSheet; StockCountSheet; material TransferSheet; OpeningInventoryEntryForm sheet branch; MaterialEditorSheet; MaterialImportSheet; LibraryCostComponentSheet; SettingsBudgetSettingsManager formula editor; ApprovalControlManager                                                         |
| Administration/onboarding/reconciliation (9) | AdministrationUserEditorSheet; AdministrationVendorEditorSheet; VendorCreateSheet; RoleCreateSheet; RoleEditorSheet; OnboardingBudgetDefaultsSheet; reconciliation import, manual statement and matching owners                                                                                                                                            |

Retained exceptions: reconciliation audit reason, inventory defaults, mobile-only library template sheet, three category name/description editors, opening-stock batch detail/reversal reason, profile photo/name, password, inventory location naming, and project activation confirmation. Existing page editors, read-only detail/locked branches, selection/calendar/success overlays, confirmations and five compact name/audit/rejection dialogs retain their own contracts.

## Implementation notes

- Reused existing wide/aside sheet slots, grouped controls/surfaces, footer actions and motion/focus/dismissal owners. Extended shared `FactRow` with opt-in `layout="stacked"`; inline defaults stay unchanged. Narrow manual aside labels/values no longer break awkwardly across letters.
- Draft totals and monetary projections reuse existing values. Sidebar money keeps cents through shared `MoneyValue` when present. Expense item budget/stock contexts have a compact aside composition; mobile retains its established cards.
- Reference failures now distinguish unavailable selected records from empty selection. Unread/reading/failed import sources never claim a validated zero; a successfully read preview with all rows removed remains a valid zero. Readiness follows real source resets and preserves existing submit gates.
- Reconciliation desktop import preview reuses public `DesktopTable`; mobile preview remains its incumbent layout. Shared UI dismissal architecture checks now inspect JSX attributes through TypeScript AST, including nested aside JSX, while still rejecting an owner without explicit policy.
- Added safe responsive stories for Account, Material and Role, plus Project review; registered them in Storybook. Fixture callbacks do not persist financial/material data.

## Verification evidence

- Browser QA: Account entry/review, Material, Project review, Role and actual reconciliation manual input verified at 1024/1280/1440 and 320/360/390/430. Actual viewport dimensions were checked; temporary per-tab emulation was used where browser-scoped viewport overrides did not reach a later-created tab.
- Draft text and focused control identity survived desktop/mobile resize in Account and Material fixtures. Nested Material selection Escape closed only the selection and restored trigger focus. Primary actions stayed within the sheet, with no document horizontal overflow. Native fallback remained one column at 1440. Empty and pending Material guards were verified, as was reduced-motion disclosure.
- Import caller DOM regression verifies unread → CSV read → remove final row (valid zero) → reopen/unread → failed read. Targeted budget-context tests verify cents and a negative remainder, plus a known zero remainder.
- API/web/mobile typechecks and web production build passed after concurrent API declaration errors were corrected outside this task. Scoped lint/format and HeroUI/token checks passed. Workspace lint passed with one existing AI effect warning.
- The consolidated workspace test attempt had 1004 passing web tests and 9 unrelated API failures: 6 timeout/integration-related failures (disposable integration/architecture/PDF checks) and 3 current AI classifier/tool-registry assertions associated with concurrent financial-history work. API source was not edited for this UI task. Repository format check reported 91 unrelated files; changed files use scoped formatting.
- Screenshots and temporary QA logs: `/tmp/atria-manual-form-panels/` and `/tmp/atria-form-panels-*.log`. No development data reset, finance/material commit or notification read mutation was performed during browser QA.

Final web-suite rerun: **1006 passed, 0 failed across 202 files**. Final web build passed. Temporary viewport/media overrides were restored, QA tabs closed and the task-only Storybook server stopped; the user web/API processes remained running.

## Follow-up: expense category prerequisite

The initial blank expense item could open before a project was selected, unlike the Add action. Its category collection was empty, so React Aria correctly declined to open the Select. Item edit, Add and Duplicate now share the selected-project/available-category prerequisite with an associated visible explanation. Existing open editors show unavailable category feedback, and a missing/stale selected category cannot enable Save. Draft data, backend rules and shared selection/overlay owners remain intact.

- Captured a failing DOM regression before the fix. It now covers missing project and empty categories on mobile/desktop, all five real HeroUI options inside two nested WorkflowFormSheets, local category selection without saving, and recovered stale-category save prevention.
- Safe Storybook fixtures exercise the real ExpenseItemsSection and ExpenseLineEditor with in-memory data and isolated warehouse actions. Browser category choices and selection passed at 1024/1280/1440 and 320/360/390/430, without horizontal overflow. Escape closed only the dropdown and restored trigger focus. Focused draft text/control identity and the selected category survived resize; native fallback retained the prerequisite at desktop width. The original development form displayed the corrected project-first guidance without editing its draft.
- Final checks: **1007 web tests passed across 203 files**, API/web/mobile typechecks, workspace lint, web production build, scoped format, HeroUI scoped-style/token checks and diff check passed. Workspace lint retains the existing AI effect dependency warning documented above.
- Browser proof and logs: `/tmp/atria-category-fix/` and `/tmp/atria-category-*.log`. No development database writes or reset were used for this verification.
