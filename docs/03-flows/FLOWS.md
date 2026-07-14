# Operational Flows - Project Budget Finance & Material Control

The core workflow remains Dekoria's familiar budget-control flow:

`Project Budget Setup -> Expense Tracker by Category -> Budget Dashboard -> Category Usage -> Remaining Budget -> Margin Visibility`

Material control is attached to the Material category as the structured drill-down layer.

## 1. Owner Opens Dashboard
```mermaid
flowchart TD
  A["Owner opens mobile dashboard"] --> B["Server reads Better Auth session"]
  B --> C["RBAC: Owner or Finance Admin"]
  C --> D["Query project budgets, project costs, vendor bills, RAP, inventory, stock movements, AI brief"]
  D --> E["Calculate total value, budget, consumed, remaining, category usage, material shortage, bills due, margin risk"]
  E --> F["Render owner-readable budget/category/material cards"]
```

Read-only dashboard queries do not write audit logs. Any action triggered from the dashboard must call a protected Server Action.

## 2. Project Budget Setup from Settings Ratios
```mermaid
flowchart TD
  A["Finance/Admin enters project value or approved RAB value"] --> B["System applies default budget cap 90%"]
  B --> C["System allocates Tukang, Material, Operasional, Lain-lain, optional Subcon"]
  C --> D["User may override category ratio or amount"]
  D --> E["Owner approves budget baseline"]
  E --> F["Dashboard tracks actual spend by category"]
```

Default ratios come from Budget Allocation Settings, seeded from the current Project Budget workflow. Category cards remain visible even when the user drills into material details.

Category ratios are percentages of Internal Budget and may total less than 100%; the remainder is shown as Unallocated Buffer. Target Gross Margin is calculated separately as Project Value minus Internal Budget. Saving is blocked only when enabled category ratios exceed 100%. Settings changes become defaults for new projects and do not mutate existing project budgets.

Project-level reallocation is a single atomic batch. Approved budgets require Owner/Finance permission and an audit reason.

## 3. Expense Tracker by Category
```mermaid
flowchart TD
  A["Finance/PM opens Add Expense"] --> B["Select project and category"]
  B --> C["Enter description, quantity, unit cost, amount, vendor/receipt when relevant"]
  C --> D{"Category detail type"}
  D -->|Material| E["Optionally link material, RAP item, stock movement"]
  D -->|Tukang/Subcon| F["Optionally link Work Package/Subcon Package"]
  D -->|Operasional/Lain-lain| G["Keep fast simple expense"]
  E --> H["Submit expense and update category usage"]
  F --> H
  G --> H
```

Expense category is mandatory. Material linkage is progressive and only valid for Material category. Package linkage is only valid for matching Tukang/Subcon categories.

## 4. Budget Dashboard Rollup
```mermaid
flowchart TD
  A["Read approved project budget categories"] --> B["Aggregate approved/paid expenses by category"]
  B --> C["Calculate remaining and used percentage"]
  C --> D["Assign SAFE/WATCH/CRITICAL/OVER_BUDGET"]
  D --> E["Calculate projected margin"]
  E --> F["Render owner and project detail cards"]
```

This replaces spreadsheet `SUMIFS` behavior with a structured database read model.

## 5. Project Budget to RAP
```mermaid
flowchart TD
  A["Finance/Admin creates Project Budget"] --> B["PM/Purchasing creates RAP material plan"]
  B --> C["RAP items link to Material Master when available"]
  C --> D["System calculates total needed and estimated cost"]
  D --> E["Team prepares Tukang and Subcon packages or explicitly skips each scope"]
  E --> F["Owner/Finance reviews and finalizes the internal plan"]
  F --> G["Material RAP is locked; ready packages remain active until RAB approval"]
```

Project Budget is the high-level control layer. RAP is the internal material/cost plan for the Material category. Locked RAP is compared with Material budget, actual material cost, and estimated remaining material cost.

## 6. Inventory Check and Purchase Need
```mermaid
flowchart TD
  A["Open RAP / Material Plan"] --> B["Read material_inventory by material and location"]
  B --> C["Calculate available stock = current - reserved"]
  C --> D["Compare total needed vs available"]
  D --> E["Show stock source, reserve quantity, and need to buy"]
```

Need to Buy is a calculated operational signal, not an accounting liability. Vendor bills or expenses are created only through explicit user actions.

Goods Receipt is the explicit physical receipt action. It updates stock and weighted average cost but does not pay the vendor.

## 6B. Approved Scope Revision
```mermaid
flowchart TD
  A["Approved RAB and locked sources"] --> B["Create RAP/package revision"]
  B --> C["Generate RAB revision and refresh linked sources"]
  C --> D["Record Change Order reason and client confirmation"]
  D --> E["Owner/Finance approves transaction"]
  E --> F["Old RAB/source superseded; new contract and budget become current"]
```

Direct approval is rejected when a current approved RAB already exists.

A draft RAB revision may be cancelled before approval. Cancellation marks the revision `VOID`, cancels any linked open Change Order, preserves the approved baseline and revision number history, and does not update contract, budget, RAP, or package locks.

## 6C. Project Closing
Completion runs only through the closing action. It validates client invoices, vendor liabilities, expenses, open revisions/change orders, stock reservations, and canonical budget synchronization, then writes the final realized-margin/cash-position snapshot.

## 7. Reserve Material for Project
```mermaid
flowchart TD
  A["Purchasing chooses material and project/RAP item"] --> B["Validate stock availability and permission"]
  B --> C["Start database transaction"]
  C --> D["Update material_inventory.reserved_stock"]
  D --> E["Insert stock_movement type RESERVE"]
  E --> F["Write audit_log"]
  F --> G["Commit"]
```

Reservation does not create a cash transaction. It only changes inventory commitment.

## 8. Use Material for Project
```mermaid
flowchart TD
  A["Project/Purchasing marks material used"] --> B["Validate project access and quantity"]
  B --> C["Start database transaction"]
  C --> D["Decrease current_stock and reserved_stock if reserved"]
  D --> E["Insert stock_movement type USE"]
  E --> F["Optionally link RAP item and expense"]
  F --> G["Write audit_log"]
```

Material usage affects project material status and estimated remaining material need. Cash impact and Material budget actuals are recorded through expense or vendor bill payment.

## 9. Stock In from Purchase
```mermaid
flowchart TD
  A["Finance/Purchasing records vendor bill or purchase"] --> B["User records Stock In after material arrives"]
  B --> C["Start database transaction"]
  C --> D["Increase current_stock and update cost context"]
  D --> E["Insert stock_movement type STOCK_IN"]
  E --> F["Link vendor bill/expense when available"]
  F --> G["Write audit_log"]
```

Stock In is explicit. AI OCR can suggest fields but cannot create final stock movement without human action.

## 9B. Transfer, Stock Opname, and Receipt Reversal

```mermaid
flowchart TD
  A["Purchasing transfers material"] --> B["Lock source and destination inventory"]
  B --> C["Post TRANSFER_OUT and TRANSFER_IN atomically"]
  D["Purchasing submits physical count"] --> E["PENDING_APPROVAL"]
  E --> F["Owner/Finance approves variance movements"]
  G["Purchasing requests receipt reversal"] --> H["Owner/Finance approves compensating movement"]
```

Transfer cannot consume reserved stock. Stock counts reject stale snapshots or counted quantity below reservation. Receipt reversal does not change the linked vendor bill or payment.

## 10. Generate Client Estimate / Quotation from Selected Sources
```mermaid
flowchart TD
  A["User selects quotation sources"] --> B["Include RAP Material, Tukang packages, Subcon packages, and manual lines"]
  B --> C["System creates client-safe rab_estimate_item rows"]
  C --> D["User edits client label, grouping, visibility, rounding, discount, and revision"]
  D --> E["Client-safe preview hides internal cost and margin"]
  E --> F["Approved RAB becomes client-facing project value"]
```

Client-facing RAB output must never include internal unit cost, margin formula, stock availability, vendor notes, or internal notes.

## 11. AI Finance & Material Brief
```mermaid
flowchart TD
  A["Cron or user request"] --> B["Read-only context builder"]
  B --> C["Gemini analyzes category budget usage, margin risk, and material stock signals"]
  C --> D["Store ai_run result"]
  D --> E["Render Bahasa Indonesia summary and suggested actions"]
```

AI can analyze, summarize, and suggest. It cannot mutate finance/material data without explicit approval.
