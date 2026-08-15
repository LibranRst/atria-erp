# MVP Blueprint - Project Finance & Material Control

## 1. Core Promise

MVP Atria ERP helps Dekoria control project budget, expense categories, budget usage, remaining budget, material needs, stock availability, purchase requirements, actual spending, vendor bills, and margin risk in one mobile-first internal system.

The promise is: **Project Budget Control upgraded into a real ERP with material stock visibility.**

The MVP preserves the familiar workflow:

`Project Budget Setup -> Expense Tracker by Category -> Budget Dashboard -> Category Usage -> Remaining Budget -> Margin Visibility`

and adds material control:

`Material category -> RAP / Material Plan -> Inventory Check -> Purchase Need -> Stock Movement -> Material Budget and Margin Risk`

## 2. MVP Modules

### Module 1: Existing Finance Spine

- Preserve bank accounts, cash ledger, audit logs, project costs, client payments, vendor bills, approvals, and AI OCR.
- Keep all balance-changing actions inside transactions through the existing balance mutation helper.

### Module 2: Project Budget Setup

- Uses Settings defaults seeded from the current budget workflow: 90% internal budget cap; Tukang 18%, Material 35%, Operasional 1%, Lain-lain 0.5%, and Subcon 0% of Internal Budget. The remaining 45.5% is Unallocated Buffer, not gross margin.
- Owner/finance can override ratios or allocated amounts per project.
- This is internal budget control, not the client-facing RAB.

### Module 2B: Settings Source of Truth

- Dedicated Settings area manages Budget Allocation defaults, Expense Categories, Item & Price Library, and Material Master. It is a source-of-truth workspace, not a technical database editor.
- Budget ratios are edited as human-readable percentages; Budget Allocation labels Gross Margin and Unallocated Buffer as separate values and explains that category ratios use Internal Budget. The five canonical Expense Categories stay active and code-locked — ratio editing belongs only in Budget Allocation.
- Budget settings feed new Project Budget creation.
- Expense categories feed budget, expense tracker, dashboards, reports, and AI.
- Item & Price Library stores traceable cost components and margin/provenance, then copies immutable snapshots into RAP material items, Tukang/Subcon packages, and quotation lines. Library cards show Internal Cost, Suggested Client Price, gross margin, component count, price source, and source note.
- Material Master settings feed stock/inventory readiness and material selection, showing material identity and default inventory thresholds without replacing the operational Materials page.
- Settings defaults affect newly created project budgets only. Existing project allocations remain unchanged.

### Module 3: Expense Tracker by Category

- Required category: Material, Tukang, Operasional, Lain-lain, or Subcon.
- Non-material expenses stay fast and simple.
- Material expenses can progressively link to RAP/material/stock movement.
- Tukang expenses can optionally link to Work Packages.
- Subcon expenses/vendor bills can optionally link to Subcon Packages.
- Operasional and Lain-lain stay quick and simple.

### Module 4: Budget Dashboard

- Category cards show allocated budget, actual spend, remaining budget, used percentage, and risk status: Category name (Tukang, Material, Operasional, Lain-lain, or Subcon), Budget (allocated), Actual (approved/paid spend), Remaining (allocated minus actual), Used (percentage), and Status (`SAFE`, `WATCH`, `CRITICAL`, or `OVER_BUDGET`).
- Drill-down is category-specific: Material opens material usage/RAP Material Plan and stock-control detail; Tukang opens Work Packages (area/scope, estimated cost, actual linked expense, variance, status); Subcon opens Subcon Packages (vendor/scope, estimated cost, vendor bill/expense linkage, variance, status); Operasional and Lain-lain stay simple (category, amount, description, vendor/receipt/payment context). Tukang/Subcon packages are not labeled RAP or BoQ in the primary UI.
- Material stock detail appears as supporting detail after the Material budget card, never instead of it.
- Dashboard shows total project value, total budget, consumed budget, remaining budget, projected margin, overbudget projects, and near-limit categories.

### Module 5: RAP / Material Plan

- Internal execution plan per project.
- Tracks material need by area/room, required quantity, buffer, total needed, estimated cost, source, and status.
- Locked RAP becomes the cost baseline.
- Locked RAP/package and approved RAB revisions are immutable; formal Change Order approval supersedes the prior baseline and recalculates contract/budget atomically.

### Module 5B: Tukang/Subcon Packages

- Tukang uses lightweight Work Packages for labor/scope estimates.
- Subcon uses lightweight Vendor/Subcon Packages for vendor scopes.
- These packages track estimated cost, actual linked spend, and variance without stock behavior.

### Module 6: Material Master & Inventory

- Material master stores category, name, specification, brand/code/color, unit, default vendor, and active flag.
- Inventory stores current, reserved, available, minimum/buffer stock, location, average cost, and last purchase price.
- Goods Receipt is the physical stock-in event and remains separate from vendor payment.
- Stock usage/return is recognized in profitability at average cost even when no current-period cash moves.
- Materials uses fixed tabs Overview, Inventory, Needs, and Activity, providing global stock operations, search/filter, grouped location inventory, approval cards, and movement/receipt history.

### Module 7: Closing & Final Profitability

- Completion is blocked by unpaid/mismatched client invoices, outstanding vendor bills/payments/expenses, open RAB or Change Order, unresolved stock reservations, or unsynchronized budget.
- Successful closing writes a final snapshot with realized margin and cash position as separate values.

### Module 7: Stock Movement

- Supports `STOCK_IN`, `STOCK_OUT`, `RESERVE`, `USE`, `RETURN`, `TRANSFER`, `ADJUSTMENT`, and `WASTE`.
- Movements can link to project, RAP item, material, vendor bill, expense, and actor.
- Stock-changing actions must write audit logs.

### Module 8: Vendor Purchase Tracking

- Vendor bills connect to project and budget category.
- Material vendor bills can link to material/RAP when relevant.
- Vendor bills can represent material purchases or payable commitments.

### Module 9: Client-Safe RAB Estimate

- RAB can be generated from selected RAP Material items, Tukang Work Packages, Subcon Packages, and manual client-safe lines.
- Generated rows must be editable before sending to client.
- Client preview never exposes internal cost, margin, markup, vendor notes, or internal notes.

### Module 10: Owner Dashboard

- Owner sees budget condition, category usage, actual cost, remaining budget, material shortage, leftover/reusable stock, vendor bills due, margin risk, and urgent actions.
- AI CFO briefing is deferred and is not part of the current Dashboard experience; Ringkasan must not reserve empty space or expose a briefing shortcut.
- **Dashboard Order (Ringkasan)**: (1) financial position — cash available, open receivables, open payables, obligations due within seven days, active-project budget usage, remaining budget, and projected margin; (2) at most three role-ranked priorities; (3) at most three risky active projects; (4) nearest due documents and material-attention previews; (5) three recent cash changes. Portfolio budget values include `ACTIVE` projects only; cash and open receivable/payable balances stay company-wide; outstanding balances are invoice/bill value minus posted payments with `VOID` records excluded. Owner priorities are approval and margin/project risk; Finance Admin priorities are overdue payables, overdue receivables, and operational finance work; material shortage stays supporting context after budget/finance risk.
- **Dashboard tabs**: Persetujuan is an Owner-only decision queue ranked by budget impact, due date, waiting age, and amount (rejection requires a reason). Budget compares portfolio/project actuals against budget and target margin against projected margin. Jatuh Tempo groups open documents into Terlambat, Hari Ini, 7 Hari ke Depan, and Berikutnya using Asia/Jakarta calendar days. Rekening shows total cash, near-obligation coverage, account status, and recent reconciliation context (mutations stay in the account detail sheet). Material shows shortage/low-stock risk, receipt reversal requests, and recent waste/adjustment context without replacing the Materials page.
- **Project Overview order**: (1) compact project identity (client, status, financial health, Detail sheet); (2) one financial health card on remaining internal budget and used percentage; (3) readiness cards for RAB, RAP, Material, and Tagihan; (4) at most three project blockers/actions; (5) up to five compact category rows, each opening full financial detail and a contextual module action.

## 3. Role-Based Value

- Owner: 30-second view of project value, category budget usage, finance/material health, margin risk, and urgent approvals.
- Finance/Admin: project budget setup, category expense input, vendor bills, payment status, receipt proof, and dashboard control.
- Purchasing/Material: material needs, stock availability, reservations, stock movement, shortages, and leftover handling.
- Project Team: project material readiness, shortage, reserved, waiting purchase, and used/leftover status.

## 4. Daily Workflows

- Owner opens Dashboard, reads the financial position and ranked actions, then reviews approvals, budget risk, due documents, accounts, or material attention through the Dashboard tabs.
- Finance/Admin records expenses by category, verifies payment status, links material/RAP only when relevant, and watches budget/margin risk.
- Purchasing checks Need to Buy, reserves available stock, records stock in from purchases, marks stock used, and returns leftover material.
- PM checks project material readiness and inputs field expenses without filling unnecessary material details when the expense is operational.

## 5. Launch Criteria

- Project Budget Setup, Settings, Expense Tracker by Category, Budget Dashboard, RAP, Material Master, Inventory, Stock Movement, Vendor Bills, and RAB Estimate have usable MVP screens.
- Category budget cards show allocated, actual, remaining, used percentage, and risk badge.
- Stock movement math is tested for reserve/use/return/adjustment/waste.
- Existing finance tests remain green.
- Lint/build are clean.
- RAB preview is verified to hide internal cost and margin fields.
