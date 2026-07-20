# Expense and Payable Row Visual Refinement

## Goal

Improve item presentation in Kas & Tagihan for vendor bills, buyer payment plans, and field expenses while preserving Atria's calm iOS-inspired operational language.

## UI contract

- Keep each dataset in one grouped white surface with soft dividers; each item is an operational row, not an independent floating card.
- Row hierarchy: semantic status and date, identity/description with a non-wrapping amount, project/document context, exceptional budget or scheduling context, then one compact action area.
- Use the established 36px semantic icon tile, one activity-detail chevron, tabular `MoneyValue`, 48px effective row/action targets, and concise Bahasa Indonesia.
- Apply explicit `leading-3`, `leading-4`, or `leading-5` to row text according to its size and wrapping behavior.
- Preserve empty states, filters, payment scheduling/disbursement flows, receipt preview, permissions, and activity-detail navigation.
- Motion: no list, section, tab-content, or decorative animation. Keep the established segmented-tab pill, sheet transitions, tap feedback, and real payment-progress change only.

## Implementation

1. Recompose vendor bill rows so status/date, vendor/amount, project/document, progress, and payment action remain legible at narrow widths.
2. Apply the same row grammar to buyer payment plans, with planned/disbursed date and account context placed consistently.
3. Recompose active and historical field-expense rows with clearer description/amount alignment, budget-risk placement, requester context, receipt affordance, and activity-detail behavior.
4. Align nearby section/header text leading where it materially affects these lists, then verify TypeScript, lint, focused tests, and 320/360/390/430px behavior without executing finance mutations.

## Implementation record

- Vendor bills and buyer payment plans now share a stable status/date, identity/amount, context, and action hierarchy inside grouped surfaces.
- Active and historical field expenses use the same scan order, with budget risk separated from the action row and every item opening canonical activity detail.
- Row typography uses explicit compact line-height utilities; financial amounts retain the shared non-wrapping `MoneyValue` contract.
- Strict TypeScript, focused ESLint, six expense presentation/flow tests, and diff checks passed.
- Authenticated browser width verification remains pending because the available local browser had no signed-in Atria session; no finance action or mutation was triggered.
