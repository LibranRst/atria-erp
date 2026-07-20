# Material & Stock UI Redesign

Redesign the global `/materials` page as a polished operational control center for inventory visibility, project material needs, stock activity, and stock operation entry points. This pass is UI/UX-only: it preserves the current Material Operations dashboard data contract, server actions, RBAC, stock mutation behavior, audit requirements, and database schema.

## Implementation

- Align the page with current Atria patterns: `PageHeader`, `SegmentedTabs`, `NativeSection`, `MetricGrid`, warm background, white `rounded-[28px]` cards, subtle borders/shadows, and fully rounded controls.
- Rework Overview into a clearer stock readiness surface with a primary summary card, capability-aware quick actions, approval rows, and recent movement rows.
- Improve Inventory cards with stronger material identity, status, location context, stock/value metrics, and readable search/filter controls.
- Improve Needs and Activity tabs with project-grouped shortages, audit-style rows, polished empty states, and consistent filters.
- Improve the Material Detail bottom sheet with a top summary, location metrics, shortage context, and recent movements.

## Verification

- Run `bun run lint`.
- Run `bun run build` if lint is clean or after addressing blocking issues.
- Browser-check `/materials` at 320px, 390px, 430px, and desktop width.
- Verify tab switching, search/filter behavior, material detail sheet, quick operation sheets, and confirmation sheets.
