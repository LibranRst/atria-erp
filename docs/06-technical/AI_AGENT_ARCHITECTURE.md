# AI Agent Architecture

## Principle

AI is read-only by default. It may analyze, summarize, classify, and propose actions, but it must not mutate important finance or material-control data without explicit user approval through protected Server Actions.

## Agents

### OCR Receipt Agent

- Reads receipt images and extracts vendor, date, amount, and line items.
- Suggests material/RAP links when text matches material names or categories.
- Output is a draft proposal for the user to review.

### Finance & Material Brief Agent

- Writes a simple Bahasa Indonesia brief for the Owner.
- Summarizes category budget usage, budget risk, margin risk, material shortage, overbudget projects, unusual material cost, leftover/reuse opportunity, vendor/payment issues, and suggested actions.

### Risk Agent

- Reads project value, budget categories, actual category cost, RAP, stock shortage, vendor bills, and movement history.
- Identifies project margin risk and material-control bottlenecks.

## Data AI May Read

- Project budget and actual cost aggregates.
- Settings-backed expense categories and Budget Allocation defaults.
- Category budget cards: Tukang, Material, Operasional, Lain-lain, and Subcon budget/actual/remaining/used/status.
- Item & Price Library references for draft suggestions only.
- RAP item status and shortage calculations.
- Inventory availability, reserved stock, and leftover/reusable stock.
- Vendor bills due and recent project expenses.
- Historical `ai_run` summaries.

## Data AI Must Not Expose

- Internal RAP cost, margin, markup, vendor notes, or internal notes in client-facing RAB output.
- Global cash/ledger data to users without permission.
- Other PM projects to scoped project users.

## Mutation Rule

AI output can power proposal cards or prefilled forms. Final writes must be triggered by a human action and routed through Zod-validated, RBAC-protected Server Actions.

## Output Language

Owner-facing summaries should be practical, short, and written in simple Bahasa Indonesia.

## Required Budget Analysis Examples

AI should be able to produce practical statements like:

- "Project A sudah memakai 92% Budget Material, sementara progress proyek baru 60%."
- "Biaya Tukang Project B masih aman di 55%."
- "Operasional Project C sudah over budget."
- "Stock material gudang bisa mengurangi kebutuhan beli Project D."
- "Margin Project E berisiko karena Material dan Subcon melewati rencana."
