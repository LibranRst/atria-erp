# Global Main-Surface Primitive Consolidation

## Goal

Remove feature-owned UI primitives whose semantics are global, while preserving Atria's current
mobile hierarchy and runtime behavior.

## Consolidation Map

| Current duplicates                                                                                      | Global target                |
| ------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `DashboardSummarySurface`, `ExpensesSummarySurface`                                                     | `SummarySurface`             |
| Material, Expenses, Dashboard, Reconciliation, Settings, Administration, and Profile grouped containers | `GroupedSurface`             |
| Dashboard/Material/Expenses/Projects section headers                                                    | `SectionHeader`              |
| `DashboardDetailSection`                                                                                | `DetailSection`              |
| `DashboardRowGroup`                                                                                     | `RowGroup`                   |
| feature-owned `SummaryFact`                                                                             | `SummaryFact`                |
| `MaterialInlineState`                                                                                   | `InlineStateRow`             |
| `PanelEmptyState`                                                                                       | existing global `EmptyState` |

The shared `GroupedSurface` supports semantic `div`, `section`, and `article` roots so consolidation
does not weaken document structure.

## Semantic Boundaries

- Dashboard preview composition remains feature-owned because it combines title-side context with
  a fixed navigation action.
- Domain status mapping remains feature-owned.
- Large centered empty pages and compact inline grouped states remain separate patterns.
- Financial/domain rows, cards, and decision flows are not generalized merely because they share
  spacing or typography.

## Migration Rules

- Global primitives live under `components/ui/feedback/`.
- Call sites import the global semantic name; feature aliases are removed.
- Preserve server/client boundaries, accessibility labels, touch targets, and motion behavior.
- Standardize subtle surface geometry to the active Dashboard-led grammar during extraction.
- No new animation.

## Verification

- Add global primitive presentation tests.
- Run affected Dashboard, Approval, Material, Expenses, Projects, Reconciliation, and Settings tests.
- Run ESLint, TypeScript, diff check, and production build.
