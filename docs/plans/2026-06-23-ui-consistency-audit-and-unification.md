# UI Consistency Audit and Unification

## Summary

Unify Atria ERP page visuals around the approved mobile-first baseline from the projects list, project payments tab, and the global Kas & Tagihan header/tab selector.

## Visual Baseline

- Page headers stay compact: 28px title, short operational subtitle, optional capsule action or badge.
- Primary page sections use `rounded-[28px]`, white surface, subtle border, and soft shadow.
- Metrics use compact inner cells with `rounded-2xl bg-surface-container-low px-3 py-2.5`.
- Buttons, tabs, filters, and inputs use fully rounded capsule styling.
- Financial amounts use mono/tabular formatting and must wrap safely on small screens.

## Implementation Targets

- Add shared page primitives for headers, native sections, metric pills, pill tabs, and empty states.
- Keep approved designs in `ProjectListClient`, `ProjectInvoices`, and the global `ExpenseList` header/tab selector as the source of truth.
- Align Field Claims, Vendor Bills, Project detail tabs, Materials, Ledger lower sections, Approvals, and Settings surfaces to the shared primitives.
- Avoid new data, RBAC, server action, finance, material, or approval behavior changes.

## Parent Page Consolidation Pass

- Do not redesign from scratch; preserve the approved project-detail content language as the operational surface baseline.
- Parent pages should use the same primitives while keeping their page-level hierarchy:
  - View switching uses `SegmentedTabs`.
  - Search/filter shells use rounded white 28px surfaces with subtle border/shadow.
  - Repeated list cards use white 28px surfaces or low-surface inner rows.
  - Settings pages migrate away from `premium-card` toward the unified `NativeSection` card language.
  - Filter controls remain filter pills, not view tabs.
- Current pass focuses on low-risk visual normalization in Materials and Settings, where the remaining parent-page inconsistency is most visible.

## Verification

- Run `bun run lint`.
- Run `bun run build`.
- Manually spot-check mobile widths for projects, project payments/expenses, expenses, materials, ledger, approvals, and settings.
