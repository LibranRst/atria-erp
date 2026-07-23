# API and Server Actions

## Standards

- Every mutation uses a Next.js Server Action.
- Every input payload is validated with Zod.
- Every mutation reads the active user session from Better Auth on the server.
- Every mutation calls `assertPermission` and project/material scoping helpers where relevant.
- Finance balance changes and stock changes run inside `db.transaction`.
- No raw SQL in application code.
- Responses use `ActionResponse<T>`.

## Existing Finance Actions to Preserve

- `submitFieldRequest`, `submitFieldRequests`, `verifyFieldRequest`, `approveFieldRequest`, `payFieldRequest`
- `submitVendorBill`, `scheduleVendorBillPayment`, `payVendorBill`
- `recordClientPayment`
- `reconcileCashTransaction`
- `getReconciliationWorkspace`, `importBankStatementCsv`, `recordBankStatementRow`
- `markReconciliationException`, `clearReconciliationException`
- `getDashboardStats`
- `processReceipt`

## Bank Reconciliation Actions

- `getReconciliationWorkspace()` returns active accounts, unmatched Atria cash records with age/exception evidence, unmatched bank mutations with exact-match suggestions, and the latest confirmed reconciliation history.
- `importBankStatementCsv(input)` accepts the canonical Atria columns `tanggal,deskripsi,dana_masuk,dana_keluar`, validates a maximum of 500 rows/1 MB, skips duplicate fingerprints, creates one import batch plus statement rows, and writes audit evidence. It never changes bank balance.
- `recordBankStatementRow(input)` creates one manual bank mutation as an explicit fallback. It uses the same account/date/direction/amount/description fingerprint as batch import.
- `reconcileCashTransaction(input)` locks both records, requires the same account, `INFLOW`/`OUTFLOW` direction, and exact amount, then atomically marks both sides reconciled and writes audit evidence. Any documented exception is cleared when a real match is confirmed.
- `markReconciliationException(input)` requires `reconcile:ledger`, a 10–1,000 character reason, an unreconciled cash transaction, and writes reviewer/timestamp/audit evidence without setting `reconciled = true`.
- `clearReconciliationException(input)` returns an exception to the ordinary unresolved queue and preserves the change in `audit_log`.

Project closing gathers cash transactions through client payments, vendor payments, and project costs. A transaction that is neither reconciled nor documented as an exception is a closing blocker. Exceptions are accepted as documented decisions but remain disclosed in the closing checklist.

## Project Budget Control Actions

Expense and vendor bill write paths are category-first. `projectBudgetCategoryId` is required. Legacy `projectBudgetItemId` may still be read from compatibility records, but active writes must store it as `null` and must not use it for budget mutation.

- `createProjectBudgetFromRatios(projectId, contractValue, ratioPresetId?)`
- `updateProjectBudgetCategoryAllocation(projectBudgetCategoryId, ratioPercent | allocatedAmount)`
- `approveProjectBudget(projectBudgetId)`
- `recalculateProjectBudgetCategories(projectBudgetId)`
- `getProjectBudgetDashboard(projectId)`
- `getOwnerBudgetDashboard()`

These actions use canonical `project_budgets`, `expense_category`, `project_budget_categories`, `project_expenses`, and `project_profitability_snapshots` tables. Legacy `project_budget`, `project_budget_item`, and `project_cost` remain compatibility sources during migration.

The legacy mutation exports `createProjectBudget`, `createBudgetItem`, `submitBudgetForApproval`, `approveBudget`, and `rejectBudget` are disabled compatibility endpoints. They return `FORBIDDEN`; new UI and integrations must use the canonical category-based actions above.

`createProjectBudgetFromRatios` reads the active Budget Allocation Setting. Code constants are fallback/seed defaults only.

## Settings Actions

- `getSettingsOverview()`
- `getSettingsHubOverview()`, `getBudgetSettings()`, `getExpenseCategorySettings()`, `getItemLibrarySettings()`, `getMaterialSettings()`
- `updateBudgetAllocationDefaults(input)` (atomic aggregate save; enabled category total must be `<= 1`)
- `updateBudgetAllocationSetting(input)`
- `updateBudgetAllocationCategoryRatio(input)`
- `updateExpenseCategorySetting(input)`
- `getItemPriceLibrary(input?)`
- `createItemPriceLibraryItem(input)`
- `updateItemPriceLibraryItem(input)`
- `archiveItemPriceLibraryItem(input)`
- `setItemPriceLibraryItemActive(input)`
- `getPricingTemplates(includeInactive?)`
- `upsertPricingTemplate(input)` (atomic template + cost components + audit)
- `updateMaterial(input)`
- `updateMaterialInventoryDefaults(input)`
- `archiveMaterial(input)`
- `createMaterialWithInventoryDefaults(input)` (transactional master + location defaults + audit log)
- `updateMaterialSettingDefaults(input)`
- `setMaterialActive(input)`

Settings actions are Zod-validated and RBAC-protected:

## Development Account Simulation

- `getDeveloperAccountSimulationState()` reads the env/readiness gate and eligible active staff accounts.
- `startDeveloperAccountSimulation({ targetUserId, context })` changes the current Better Auth session's effective user after locking the session. `GENERAL` requires completed onboarding, complete staff roles, and permanent target password. `ONBOARDING_SETUP_REVIEW` is restricted to an active Finance Admin and intentionally permits a temporary-password target during setup.
- `stopDeveloperAccountSimulation({ context })` restores `session.userId` from `session.developerActorUserId`. Restore remains callable for an existing simulation even when the feature flag is later disabled.

The feature requires `ATRIA_DEV_ACCOUNT_SWITCHER_ENABLED=true` and is hard-disabled when `NODE_ENV=production`. Start/stop operations are transactional and audited. No password is read, reset, or bypassed.

## Owner Onboarding Control Room

- `advanceOwnerOnboardingStep({ stepId, disposition, initialStockDecision? })` atomically records the reviewed/skipped disposition and destination step in one transaction and audit entry.
- `completeOwnerOnboarding()` recomputes every hard readiness gate server-side and rejects completion while a blocker or pending opening-inventory batch exists.
- `getOnboardingReviewState()` exposes only pending setup opening batches to a Finance Admin with `approve:opening_inventory`.
- `decideInventoryOpening(input)` remains the only approval/rejection write path for both operational approvals and restricted Onboarding Review. Maker-checker cannot be bypassed by the submitting Owner.
- Owner and Finance Admin can manage budget settings, expense categories, item library, and material settings.
- Purchasing can manage material settings only.
- PM/Designer/Sales have no Settings mutation access in v1.

## New Material-Control Actions

- `createMaterialCategory`
- `createMaterial`
- `updateMaterial`
- `getMaterialInventory`
- `recordStockIn`
- `reserveMaterialForProject`
- `useMaterialForProject`
- `returnMaterialFromProject`
- `adjustMaterialStock`
- `getMaterialShortages`
- `postGoodsReceipt`

## New RAP/RAB Actions

- `advanceProjectRapSetup`, `setProjectRapScopeSkipped`, `markProjectCategoryPlanItemDraft`, and `finalizeProjectInternalPlan` persist and audit the guided internal-plan lifecycle.
- `voidRabRevision({ rabEstimateId, reason })`: transactionally marks an unapproved revision `VOID`, cancels a linked open Change Order, and writes audit records without changing the approved financial/material baseline.
- `createProjectRap`
- `createProjectRapItem`
- `submitRapForReview`
- `lockProjectRap`
- `generateRabFromRap`
- `generateRabFromSelectedSources`
- `updateRabEstimateItem`
- `approveRabEstimate`
- `copyPricingTemplateToRap`, `copyPricingTemplateToCategoryPlan`
- `createRapRevision`, `createCategoryPlanRevision`, `refreshRabLinkedSources`
- `createProjectChangeOrder`, `confirmChangeOrderClient`, `approveProjectChangeOrder`
- `reallocateProjectBudget`
- `getProjectClosingChecklist`, `completeProject`
- `generateClientInvoiceSchedule`

## Tukang/Subcon Package Actions

- `createProjectCategoryPlanItem`
- `updateProjectCategoryPlanItem`
- `deleteProjectCategoryPlanItem`
- `markProjectCategoryPlanItemActive`
- `getProjectCategoryPlanItems`

These actions create lightweight internal package plans only for `TUKANG` and `SUBCON`. Material remains in RAP Material Plan. Operasional and Lain-lain remain fast expense categories.

## Required Validation Rules

- UUID fields must be validated.
- Quantities must be positive for stock in/reserve/use/return and non-zero for adjustments.
- Monetary fields must be non-negative unless explicitly representing a discount.
- Stock movement notes are required for `ADJUSTMENT` and `WASTE`.
- `createStockTransfer` posts paired source/destination movements transactionally using source average cost.
- `createInventoryLocation` creates an active location and zero-stock defaults for every active material so transfer destinations are immediately valid.
- `saveStockCount`, `submitStockCount`, `approveStockCount`, and `rejectStockCount` enforce the dual-control physical-count lifecycle.
- `requestGoodsReceiptReversal`, `approveGoodsReceiptReversal`, and `rejectGoodsReceiptReversal` preserve immutable receipt history and use compensating movements.
- Focused Material Operations reads return inventory, shortage, movement/receipt history, approvals, and role capabilities.
- RAB estimate preview output must be projected through a client-safe DTO that excludes internal cost and margin fields.
- Expense category must be one of `MATERIAL`, `TUKANG`, `OPERASIONAL`, `LAIN_LAIN`, or `SUBCON`.
- Material/RAP/stock IDs are valid only when the expense category is `MATERIAL`.
- `projectCategoryPlanItemId` is valid only when the expense category is `TUKANG` or `SUBCON`, and must belong to the same project and budget category.
- Quotation generation may combine selected RAP Material items, selected Tukang/Subcon packages, and manual client-safe rows.
- Budget ratio percentages must be between 0 and 1, and allocated amounts must be non-negative.

## Transaction Rules

- `recordStockIn`: increases `material_inventory.current_stock`, updates cost context, inserts `stock_movement`, writes `audit_log`.
- `reserveMaterialForProject`: checks available stock, increases `reserved_stock`, inserts movement, writes audit.
- `useMaterialForProject`: decreases stock/reservation, inserts movement/audit, and creates non-cash project cost for standalone stock use without duplicating direct-use expense.
- `returnMaterialFromProject`: increases stock, inserts movement/audit, and creates a non-cash cost reversal.
- `adjustMaterialStock`: changes stock only with note and permission, inserts movement, writes audit.

## Expense and Vendor Bill Links

Canonical `project_expenses`, legacy `project_cost`, and `vendor_bill` may optionally link to `material_master`, `project_rap_item`, and `stock_movement`. These links must not be required for non-material operational expenses and must be rejected when the category is not `MATERIAL`.

Tukang/Subcon expense and vendor bill flows may optionally link to `project_category_plan_item`. Operasional and Lain-lain should not expose package selectors in v1.

## Dashboard Read Models

- `getProjectBudgetDashboard` returns contract value, internal budget, actual cost, remaining budget, used percentage, projected margin, and category usage cards.
- `getOwnerBudgetDashboard` returns portfolio totals, category totals, risky projects, near-limit categories, material shortage, reusable stock, due bills, and recent expenses.

### Finance Metric Contract

- `actualAmount` is the committed/approved project-cost baseline used for budget control. It is not a cash-basis metric.
- `paidAmount` is the amount disbursed for that category. It is the cash-out metric.
- Client invoice totals, client payments, vendor bill totals, and completed vendor payments remain separate read-model inputs. A surface must label a cash metric as cash collected/cash paid and must not call it net profit.
- A cash transaction written by an internal action starts with `reconciled = false`. Reconciliation fields may be set only after an imported bank-statement row is matched and approved.
- `reconciled = true` requires a matched `bank_statement_row`. A documented exception uses `reconciliation_exception_reason`, `reconciliation_exception_at`, and `reconciliation_exception_by_id`; it never impersonates a bank match.
- A non-empty bank reference is unique per bank account. Reusing it must fail safely without creating another cash movement.
