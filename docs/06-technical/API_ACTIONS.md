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
- `createProjectBudget`, `createBudgetItem`, `submitBudgetForApproval`, `approveBudget`, `rejectBudget`
- `submitFieldRequest`, `submitFieldRequests`, `verifyFieldRequest`, `approveFieldRequest`, `payFieldRequest`
- `submitVendorBill`, `scheduleVendorBillPayment`, `payVendorBill`
- `recordClientPayment`
- `getDashboardStats`
- `processReceipt`

## Project Budget Control Actions

Expense and vendor bill write paths are category-first. `projectBudgetCategoryId` is required; legacy `projectBudgetItemId` is optional detail linkage for BoQ compatibility.
- `createProjectBudgetFromRatios(projectId, contractValue, ratioPresetId?)`
- `updateProjectBudgetCategoryAllocation(projectBudgetCategoryId, ratioPercent | allocatedAmount)`
- `approveProjectBudget(projectBudgetId)`
- `recalculateProjectBudgetCategories(projectBudgetId)`
- `getProjectBudgetDashboard(projectId)`
- `getOwnerBudgetDashboard()`

These actions use canonical `project_budgets`, `expense_category`, `project_budget_categories`, `project_expenses`, and `project_profitability_snapshots` tables. Legacy `project_budget`, `project_budget_item`, and `project_cost` remain compatibility sources during migration.

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
