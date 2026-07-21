# Mobile-First UI/UX Guide

For the active visual grammar established by Dashboard and Expenses, read `docs/05-ui-ux/MAIN_SURFACE_DESIGN_LANGUAGE.md`. This guide defines workflow priorities; the main-surface guide governs page hierarchy, density, surfaces, rows, tabs, values, loading states, and visual acceptance.

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

- Start with the current position or workload, then attention, next actions, and drill-down detail.
- Use one focal summary only when the page has a genuinely dominant state.
- Group repeated rows inside one soft surface with dividers. Use individual cards only for independent interactive units.
- Use contextual indicators for category budget status; do not place the same progress bar under every value.
- Use bottom sheets for quick expense, stock in, reserve, use, and return actions.
- Avoid wide tables on mobile. Use grouped rows, comparisons, timelines, or domain-specific cards instead.
- Keep effective touch targets at least 48x48px, including visually compact icon and text actions.
- Keep primary monetary values on one line with tabular numerals and an exact secondary value when needed.
- Every main route needs a structural skeleton that mirrors its final content instead of a centered spinner or generic loading card.
- Changing a horizontal tab or filter may auto-center that control, but it must not scroll the document vertically or collapse the page enough to move the user's reading position.

## Canonical Main-Surface Pattern

Dashboard (`/ledger`) and Expenses (`/expenses`) are the current reference implementations. They establish:

- compact one-column composition inside the fixed `max-w-md` shell;
- a clear focal or workload summary followed by concise sections;
- grouped white/translucent surfaces with soft depth and internal dividers;
- compact semantic icon tiles, scan-friendly rows, and restrained status treatments;
- small capsule section actions with a 48px effective touch area;
- shared segmented tabs that scroll horizontally without moving the page;
- compact/full financial value pairs that remain readable at 320–430px;
- route-specific skeletons that preserve the final layout footprint.

Copy the design grammar, not the exact arrangement. Approval remains a decision queue, due dates remain a timeline, accounts retain their configured gradient identity, and material views remain quantity/risk oriented.

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
- The Owner/Finance Dashboard is a financial-first control center with Ringkasan, Persetujuan (Owner), Budget, Jatuh Tempo, Rekening, and Material tabs. Ringkasan shows no more than three role-ranked priorities and three risky projects; detail tabs use compact grouped rows and progressive disclosure.
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
- AI Finance & Material Brief (deferred; not shown in the current Dashboard)
- Settings: Budget Allocation, Expense Categories, Item & Price Library, Material Master

## Category Budget Card Pattern

Each Project Budget Detail screen must show category budget status before material drill-down. It may use a grouped row, comparison surface, or independent card according to interaction needs:

- Category name: Tukang, Material, Operasional, Lain-lain, or Subcon.
- Budget: allocated amount.
- Actual: approved/paid spend.
- Remaining: allocated minus actual.
- Used: percentage with a contextual threshold or usage indicator when it adds meaning.
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
