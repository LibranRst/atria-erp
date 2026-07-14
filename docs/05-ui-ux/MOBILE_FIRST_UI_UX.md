# Mobile-First UI/UX Guide

## Product Feel
The app should feel calm, premium, operational, and trustworthy. It must not feel like a dense spreadsheet or generic admin dashboard.

It should feel like: **Project Budget Control upgraded into a real ERP with material stock visibility.**

The workbook is source material for category logic and familiar workflow only. Do not use "Excel" as a visible screen label, section title, navigation item, badge, or empty-state copy.

## Mobile Priorities
- Owner understands project value, budget, consumed budget, remaining budget, category usage, margin risk, and material issues within 30 seconds.
- Finance/Admin inputs expenses quickly.
- Purchasing records stock movement without confusion.
- Project team sees material readiness without asking through chat.

## Navigation
Mobile navigation should prioritize:
- Dashboard
- Projects
- Materials
- Add Expense / Stock Action
- Settings for Owner, Finance Admin, and Purchasing
- Profile

Role filtering can hide destinations that are irrelevant or forbidden.

## Screen Patterns
- Use readable cards and progressive disclosure.
- Use cards, progress bars, percentage indicators, and badges for category budget status.
- Use bottom sheets for quick expense, stock in, reserve, use, and return actions.
- Avoid wide tables on mobile. Use grouped cards instead.
- Keep touch targets at least 44x44px.

## Settings Pattern
- Settings is a source-of-truth workspace, not a technical database editor.
- Use clear sections: Budget Allocation, Expense Categories, Item & Price Library, Material Master.
- Budget ratios should be edited as human-readable percentages.
- Settings stays inside the fixed `max-w-md` application shell at every viewport. Do not use `sm`, `md`, or `xl` layout changes inside this workspace because viewport breakpoints can create desktop arrangements inside the narrow container.
- Module navigation follows Project Detail horizontal pills. Only tab and filter strips may scroll horizontally.
- Financial summaries use compact 2×2 metrics with a shortened primary value and wrapped full value underneath. Do not use large snap-card carousels for Settings metrics.
- Forms, lists, headers, and filter containers remain single-column. Create/edit interactions always use a centered mobile bottom sheet rather than switching to a desktop side drawer.
- Budget Allocation must label Gross Margin and Unallocated Buffer as separate values and explain that category ratios use Internal Budget.
- Keep the five canonical Expense Categories active and code-locked; ratio editing belongs only in Budget Allocation.
- Material Master settings should show material identity and default inventory thresholds without replacing the operational Materials page.
- `/materials` uses fixed mobile tabs Overview, Inventory, Needs, and Activity. It provides global stock operations, search/filter, grouped location inventory, approval cards, and movement/receipt history without desktop breakpoints.
- Global action forms use bottom sheets; stock value uses compact 2×2 metrics and short/full financial values.
- Role badges should make edit/read-only state obvious.
- Library cards show Internal Cost, Suggested Client Price, gross margin, component count, price source, and source note. Cost-component editing remains one-column in the bottom sheet.
- Project forms offer `Gunakan template Library` and explain snapshot behavior.
- Approved RAB screens expose revision/Change Order actions instead of editable approved rows.
- Draft RAP uses a guided Material → Tukang → Subcon → Review builder. Locked RAP uses a compact summary with Material/Tukang/Subcon filters instead of stacked setup sections.
- RAP material and package lists use compact rows; stock, cost, variance, notes, and actions open in labeled bottom sheets.
- The RAB tab uses compact client-safe item cards; source selection, line editing, manual items, bundles, Change Orders, and revision cancellation open in labeled mobile bottom sheets.
- Every RAB form control has a persistent visible label. Placeholders are examples only and never replace labels.
- Project pages share the fixed mobile workspace rule: no viewport breakpoint may turn forms/cards into desktop layouts inside `max-w-md`.
- The Owner/Finance Dashboard is one financial-first flow without Budget/Stock/Activity tabs. It shows no more than three role-ranked priorities, three risky projects, five compact category rows, and five recent transactions.
- Project Overview uses a compact identity header, one financial health summary, RAB/RAP/Material/Tagihan readiness, no more than three blockers, and compact category rows whose full values open in a bottom sheet.

## Core Screens
- Owner Dashboard
- Project Budget List
- Project Budget Detail
- Project Budget Setup
- Category Budget Usage
- Project RAP / Material Plan
- Add RAP Material Item
- Tukang Work Packages
- Subcon Packages
- Material Master
- Material Inventory
- Material Detail
- Stock Movement History
- Stock In
- Reserve Material for Project
- Use Material for Project
- Leftover Stock
- Material Shortage / Need to Buy
- Expense Tracker
- Add Expense
- Vendor Bill / Purchase
- Project Profitability
- RAB Client-facing Estimate
- Generate RAB from RAP
- AI Finance & Material Brief
- Settings: Budget Allocation, Expense Categories, Item & Price Library, Material Master

## Category Budget Card Pattern
Each Project Budget Detail screen must show category cards before material drill-down:
- Category name: Tukang, Material, Operasional, Lain-lain, or Subcon.
- Budget: allocated amount.
- Actual: approved/paid spend.
- Remaining: allocated minus actual.
- Used: percentage with progress bar.
- Status: `SAFE`, `WATCH`, `CRITICAL`, or `OVER_BUDGET`.
- Drill-down: Material opens material usage; other categories open filtered expenses.

Example:
```text
Material
Budget: Rp87.500.000
Actual: Rp81.000.000
Remaining: Rp6.500.000
Used: 92%
Status: WATCH
Action: View Material Usage
```

Material stock cards must appear as supporting detail after the Material budget card, not instead of the budget card.

## Category Detail Pattern
- Material opens RAP Material Plan and stock-control detail.
- Tukang opens Work Packages: area/scope, estimated package cost, actual linked expense, variance, status.
- Subcon opens Subcon Packages: vendor/scope, estimated package cost, vendor bill/expense linkage, variance, status.
- Operasional and Lain-lain stay simple with category, amount, description, vendor/receipt/payment context.
- Do not label Tukang/Subcon packages as RAP or BoQ in the primary UI.

## Client-Facing RAB UX Rule
Client-facing RAB preview must only show client-safe labels, descriptions, quantities, units, prices, totals, discounts, and notes intended for the client. It must not show internal cost, margin, markup, stock availability, vendor note, or internal note.

Quotation generation should let users select source rows from RAP Material Plan, Tukang Work Packages, Subcon Packages, and manual client-safe lines before creating the draft.
