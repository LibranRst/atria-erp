# ERP Settings Workspace Redesign

## Summary

- Replace the single long Settings form with a hub and focused drill-down routes for Budget Allocation, Expense Categories, Item & Price Library, and Material Master.
- Preserve existing data and compatibility actions while adding focused reads, atomic budget-default updates, canonical-category guards, complete library editing, and transactional material creation with inventory defaults.
- Clarify that category ratios allocate Internal Budget, may leave an explicit Unallocated Buffer, and affect new project budgets only.
- Keep the entire workspace inside the app's fixed `max-w-md` mobile shell. Do not introduce viewport breakpoint layouts inside Settings.

## Implementation

1. Add focused Settings query/action types and Zod schemas, including aggregate ratio validation and item-type/category guardrails.
2. Build the Settings shell, hub, horizontal mobile tabs, shared compact metrics, grouped rows, bottom sheets, forms, and four module routes.
3. Add complete Item Library and Material Master create/edit/archive/reactivate workflows while keeping operational stock quantities read-only.
4. Align PRD, product flows, schema/API docs, and mobile UI guidance with the implemented formula and Settings responsibilities.
5. Use compact 2×2 financial metrics with shortened primary values and wrapped full values; lists and forms stay one column at every viewport.

## Verification

- Run Settings validation and RBAC tests, focused action tests, ESLint, TypeScript, and production build.
- Verify all five Settings routes at narrow mobile and desktop widths, including read-only Purchasing behavior and large financial values.
- Confirm that the document never overflows horizontally; only tab and filter pill strips may scroll horizontally.
