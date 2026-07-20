# Pricing, RAB Revision, Profitability, and Workflow Overhaul

## Goal

Make Library prices traceable, project templates reusable, approved RAB revisions explicit, stock usage visible in profitability, and project closing financially safe before rewriting the end-to-end workflow guide.

## Delivery order

1. Add additive schema and validation contracts for cost components, source templates, revisions, change orders, stock-cost classification, and closing.
2. Implement transactional actions for pricing, template copy, budget reallocation, stock cost recognition, RAB/change-order lifecycle, and project completion.
3. Connect mobile project and Settings UI to the new focused actions while preserving compatibility actions.
4. Replace seed placeholders with a resettable Rp650M residential fit-out scenario and rewrite the financial workflow guide from those exact values.
5. Audit all routes, fix P0/P1 workflow gaps, then remediate mobile layout issues in risk order.

## Financial invariants

- Budget cap remains 90% of Project Value.
- Category defaults remain Tukang 18%, Material 35%, Operasional 1%, Lain-lain 0.5%, and Subcon 0%; the 45.5% remainder is Unallocated Buffer.
- Target Gross, Projected Margin, Realized Margin, and Cash Position are separate metrics.
- Approved RAB and linked source revisions are immutable; scope changes require a formal Change Order.
- Standalone stock use creates non-cash project cost; linked direct-use cash expenses are not counted twice.
- Project completion is blocked until financial, scope, and stock closing checks pass.

## Verification

- Run pricing, revision, budget, stock-cost, closing, RBAC, and seed smoke tests.
- Run ESLint, TypeScript, production build, and authenticated browser checks at 320px, 390px, and 430px.
- Validate every workflow-guide amount against the seeded database and UI.
