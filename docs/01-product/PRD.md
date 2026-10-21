# PRD - Dekoria Project Finance & Material Control System

## 1. Product Overview

Paduna Build is Dekoria's internal Project Finance & Material Control System for interior design and build work. The app upgrades the current workbook-informed Project Budget workflow into a structured system for project budget control, category expense tracking, remaining budget, gross/margin visibility, RAP material planning, inventory visibility, vendor bills, stock movement, project profitability, and owner-readable AI summaries.

The product promise is: **Project Budget Control upgraded into a real ERP with material stock visibility.**

The app remains mobile-first because owners, project teams, purchasing, and finance staff need to use it from the field. Desktop is supported for heavier administration, but mobile must be a first-class experience.

## 2. Main Business Problem

Dekoria can already track project value, budget, category spend, remaining budget, and dashboard summaries in a finance spreadsheet pattern. That familiar flow must remain core. The weakness is that category tracking, especially Material, is not structured enough to connect expenses to material needs, stock, usage, leftover, and margin risk.

The owner and finance team can see money going out, but cannot easily answer:

- what material was bought;
- what material is still in stock;
- what material is reserved or used for a project;
- what material is leftover and reusable;
- what material needs to be purchased;
- which project is over material budget;
- which expense is connected to a material or RAP item;
- how material usage affects project margin.

## 3. Product Promise

Preserve the familiar flow:

`Project Budget Setup -> Expense Tracker by Category -> Budget Dashboard -> Category Usage -> Remaining Budget -> Project Margin`

Improve it into:

`Project Budget Setup -> Expense Tracker by Category -> Budget Dashboard -> Material Detail & Stock Control -> Margin Risk`

Material tracking is attached to the Material category. It must not replace Tukang, Operasional, Lain-lain, Subcon, gross, or remaining-budget controls.

## 4. In Scope MVP

1. Project Budget with category allocation from Settings defaults
2. Expense Tracker by category
3. Budget Dashboard and category usage cards
4. RAP / Material Plan per Project
5. Material Master
6. Stock Inventory
7. Stock Movement
8. Vendor Bills / Purchase Tracking
9. Owner Finance & Material Dashboard
10. Client-facing RAB Estimate based on RAP when useful
11. AI Finance & Material Brief (deferred; no active Dashboard surface or pipeline)
12. Cash ledger, bank-statement import, reconciliation history, documented exceptions, and project-closing reconciliation control

## 5. Supporting Modules

Existing project management, users/roles, dashboard, media handling, design/project workflows, sales/leads, content readiness, AI summaries, auth/permissions, reusable components, and layout structure should be preserved when useful. They are supporting modules behind the finance/material-control MVP.

## 6. Out of Scope MVP

- Full accounting, tax, journal-entry UI, payroll, HR, and complex financial closing.
- Barcode-heavy warehouse system, FIFO/LIFO accounting valuation, manufacturing, or production planning.
- External vendor/client portal login.
- Automatic fund disbursement or important material mutation triggered only by AI.
- Direct host-to-host bank feeds, automatic bank login, and automatic approval of suggested reconciliation matches.

## 7. Core Concepts

- Project Budget: ERP internal budget with project value, approved RAB value, total internal budget, consumed budget, remaining budget, used percentage, category allocation, target gross, and projected margin.
- Expense Categories: `MATERIAL`, `TUKANG`, `OPERASIONAL`, `LAIN_LAIN`, and `SUBCON`.
- Settings: source of truth for budget allocation defaults, expense category master data, item/price library, and material master data.
- Default Ratios: seeded with internal budget cap 90% of contract value. Tukang 18%, Material 35%, Operasional 1%, Lain-lain 0.5%, and Subcon 0% are percentages of Internal Budget. Their 54.5% total intentionally leaves a 45.5% Unallocated Buffer. Target Gross Margin is a different calculation: Project Value minus Internal Budget. Owner/Finance may update defaults in Settings; changes apply to new project budgets and do not rewrite existing projects.
- Category Budget Usage: allocated budget, actual spend, remaining budget, used percentage, and risk badge per category.
- Item / Price Library: reusable project templates with cost-component breakdown, provenance, effective date, vendor context, pricing mode, and target gross margin. Copying creates a project snapshot; later Library edits do not rewrite existing project scope.
- RAP: internal execution/material plan and cost truth. Locked RAP becomes the cost baseline.
- Tukang Work Package: lightweight internal plan for labor/scope packages. It tracks estimated package cost and actual spend linkage without stock behavior.
- Subcon Package: lightweight internal vendor/subcon scope plan. It can link vendor bills and quotation rows without becoming material inventory.
- RAB: client-facing estimate/proposal. It can be generated from selected RAP material items, Tukang Work Packages, Subcon Packages, and manual client-safe lines, then edited, bundled, hidden, renamed, rounded, discounted, and revisioned before sending.
- Material Master: structured material list with specs, unit, category, and brand/code/color.
- Stock Inventory: current stock, reserved stock, available stock, minimum/buffer stock, location, and cost context.
- Stock Movement: stock in, stock out, reserve, use, return, transfer, adjustment, and waste.
- Expense: actual money spent by project and category. Material/RAP/stock links are allowed only for Material category expenses. Tukang/Subcon expenses may optionally link to their package plan. Operasional and Lain-lain stay simple.
- Vendor Bill: payable or purchase record linked to vendor/project/material when relevant.
- Dashboard: owner-readable summary, not a complex accounting dashboard.
- Rekonsiliasi: finance control that matches one Paduna Build cash record with one bank mutation. A confirmed pair remains visible in history. A documented exception remains unmatched and stores a reason, reviewer, timestamp, and audit evidence.

## 8. RAP / RAB Rules

- RAP is internal.
- RAB is client-facing.
- Internal cost, margin, markup, vendor note, and internal note must never appear in client-facing RAB preview.
- RAP Material, Tukang Work Package, and Subcon Package may feed a quotation draft, but the quotation row must remain client-safe and editable.
- Locked RAP becomes the cost baseline.
- Approved RAB becomes the client-facing proposal or contract value.
- Approved RAB and its source revisions are immutable. Post-approval changes require a formal Change Order that supersedes the old RAB atomically.
- Goods Receipt records physical receipt and stock valuation separately from vendor payment.
- Global Material & Stock is the operational control center for inventory, cross-project shortages, movement/receipt history, project stock actions, location transfer, stock count approval, and audited Goods Receipt reversal. Material identity/defaults remain in Settings.
- Stock transfer posts source and destination together. Stock opname changes inventory only after Owner/Finance approval. Goods Receipt reversal is compensating history and never deletes the original receipt.
- Standalone stock use/return is included in project profitability as non-cash cost/reversal without duplicating direct-use cash expenses.
- Project `COMPLETED` is only created by a closing checklist and final profitability snapshot.
- Actual cost is compared against locked RAP.
- Project margin compares approved RAB value, locked RAP cost, actual cost, estimated remaining cost, and projected final margin.

## 9. Primary Users

- Owner: sees project value, budget, consumed budget, remaining budget, category usage, material shortage, leftover stock, due bills, and margin risk within 30 seconds.
- Finance/Admin: creates budgets, inputs expenses, tracks paid/unpaid vendor bills, uploads proofs, and links costs to material/RAP when relevant.
- Purchasing/Material Team: sees material needs, reserves stock, records stock in/out/use/return/waste, and tracks shortages.
- Project Team: sees material readiness and status for assigned projects without manual chat follow-up.

## 10. Acceptance Criteria

- Owner Dashboard shows active project value, total budget, consumed budget, remaining budget, category usage for Tukang/Material/Operasional/Lain-lain/Subcon, margin projection, material shortage, leftover/reusable stock value, vendor bills due, recent cash activity, and urgent actions.
- Project Budget Detail shows approved RAB value, internal budget, category budget cards, allocated budget, actual spend, remaining budget, used percentage, category risk, RAP planned material cost, paid/unpaid cost, material usage, projected margin, and budget health.
- Project Detail shows RAP Material Plan for Material, Tukang Work Packages for Tukang, and Subcon Packages for Subcon; Operasional and Lain-lain remain fast expense categories.
- Client Estimate / Quotation generation supports selected internal sources plus manual lines and does not expose internal package notes, stock, margin formula, or vendor notes.
- RAP shows area/room, required quantity, buffer, total needed, available stock, reserved stock, need to buy, estimated unit cost, estimated total cost, source, linked material, and linked expense/stock movement when available.
- Material Inventory shows name, category, spec, brand/code/color, unit, current stock, reserved stock, available stock, minimum/buffer, average cost, last purchase price, location, and status.
- Expense Tracker supports project, category, description, vendor, amount, quantity, unit cost, status, payment date, receipt/proof, linked material, linked RAP item, and linked stock movement.
- AI CFO/financial briefing is deferred until the core ERP dashboard and operational flows are stable. The current Dashboard contains no AI briefing entry point or generated analysis.
- Rekonsiliasi shows **Mutasi bank**, **Catatan Paduna Build**, and **Riwayat** as peer views. Open cash records expose age and exception status; every history row opens the exact Paduna Build/bank pair and reviewer evidence.
- Bank-statement CSV import never changes balance, skips duplicate fingerprints, and only creates match suggestions. Users explicitly confirm every match. Canonical Paduna Build CSV is supported; raw bank-specific formats require a compatible adapter or manual mapping.
- Project closing is blocked while a project cash transaction is neither reconciled nor documented as an exception. Documented exceptions remain visible in the closing review.
