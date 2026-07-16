# Project Detail Dashboard-Language Rework

## Objective

Rework the Project Detail presentation across Ringkasan, RAP, RAB, Stok, Pengeluaran, Pembayaran, and Margin so it follows Atria's Dashboard/Expenses-derived mobile design language without changing data contracts, permissions, finance logic, stock logic, or audit behavior.

## Implementation sequence

1. Replace the flat seven-tab strip with a sticky two-level domain navigation while preserving every existing `?tab=` value and locked-project default.
2. Refine the square project identity hero and add a route-specific structural skeleton.
3. Recompose Ringkasan into one financial focal surface followed by readiness, actions, and contextual category usage.
4. Recompose RAP and RAB around their distinct workflow/document jobs, retaining all existing actions and sheets.
5. Recompose Stok, Pembayaran, and Margin with posture summaries, timelines, and grouped rows; keep the existing project-scoped Expenses workflow intact.
6. Normalize Indonesian copy, locked/empty/error states, touch targets, sheet surfaces, and mobile density.
7. Add presentation/navigation tests and verify TypeScript, ESLint, Bun tests, production build, and browser layouts at 320/360/390/430 px.

## Invariants

- Preserve URL tab compatibility, project scoping, RBAC, canonical budget gating, RAP/RAB lifecycle, client-safe RAB output, transactions, audit logs, draft recovery, confirmations, and refresh behavior.
- Do not broaden Purchasing access or add schemas, DTO fields, queries, charts, mutations, or inline money/stock operations.
- Keep the global shell, top bar, bottom navigation, FAB, safe area, and fixed `max-w-md` layout unchanged.
