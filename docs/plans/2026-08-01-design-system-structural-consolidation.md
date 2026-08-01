# Design System Structural Consolidation

## Goal

Make the shared UI layer authoritative and findable: one semantic type/icon scale instead of
hardcoded pixels, one home for cross-domain primitives, one import path per primitive, and a
consistent feature-slice shape. No user-facing visual or financial behavior change.

## Findings

Measured on the current tree, not inferred:

| Problem                     | Evidence                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| No type scale               | 1075 hardcoded `text-[Npx]` (`10px`x319, `9px`x203, `11px`x82, `13px`x80). `@theme` defines `--font-*` families only, no size/weight/leading. |
| Icon sizes share the syntax | `text-[18px]` is 63/95 on `AppIcon`, `16px` 28/39, `19px` 8/11. Icon sizing and type sizing are visually indistinguishable at the call site.  |
| Misfiled primitives         | `finance-form-patterns` has 10 consumers outside `finance-dashboard`, 4 inside. `budget-split-indicator`, `usage-block-meter` also leak.      |
| Parallel duplication        | `MaterialSuccessSheet`/`FinanceSuccessSheet`, `MaterialUnsavedChangesModal`/`FinanceUnsavedChangesModal`, `StockImpactRow`/`MoneyImpactRow`.  |
| Incomplete barrel           | `MoneyValue`, `MoneyMetricPill`, `FactRow`, `PanelSection`, `SheetSection` are absent from `components/ui/index.ts`.                          |
| Inconsistent import path    | 279 deep `@/components/ui/...` imports vs 100 barrel imports.                                                                                 |
| Cross-feature coupling      | 20 edges into `finance-dashboard`; also `onboarding`->`settings` (5), `projects`->`expenses` (4).                                             |

Dominant size/leading pairings already exist in practice, so bundled tokens can encode them:
`10px`->`leading-4` (112), `11px`->`leading-4` (33), `13px`->`leading-4` (30), `17px`->`leading-6` (10).

## Phase 1 - Type and icon scale

Add semantic tokens to `@theme` in `app/globals.css`, named for the role defined in
`MAIN_SURFACE_DESIGN_LANGUAGE.md`, each bundling size and line-height:

- `text-eyebrow` (9px) - eyebrow and uppercase metadata
- `text-meta` (10px) - dense metadata and inset cell labels
- `text-support` (11px) - supporting context
- `text-row` (13px) - row title and primary row value
- `text-section` (15px) - section title
- `text-title` (17px) - page and major section title
- `text-focal` (28px) - the single justified focal value

Icon sizing moves to its own non-type scale (`icon-sm`/`icon-md`/`icon-lg`) so an icon size is never
mistaken for a type size.

Migrate call sites per surface, not repo-wide in one pass: Dashboard and Expenses first as the
reference implementations, then Projects, Materials, Settings, the rest. Sizes that carry no
semantic role stay unchanged rather than being forced into the nearest token.

## Phase 2 - Relocate shared primitives

- `finance-form-patterns.tsx` -> `components/ui/form/` (money-impact row, success sheet, unsaved-changes modal).
- `budget-split-indicator.tsx`, `usage-block-meter.tsx`, `risk-threshold-rail.tsx` -> `components/ui/feedback/`.
- `budget-indicator-utils.ts` -> `lib/finance/`; `dashboard-formatters.ts` money helpers -> `lib/utils/money.ts`.
- `DashboardTone` -> a shared presentation tone type in `lib/types/`.
- Collapse the three Material/Finance duplicate pairs onto the relocated shared primitive, keeping
  each domain's copy as a thin domain-labelled wrapper only where the copy differs.

Anything genuinely dashboard-only stays in `features/finance-dashboard/`.

## Phase 3 - Barrel and import discipline

- Export every shared primitive from `components/ui/index.ts`, including the currently missing ones.
- One rule: application code imports shared UI from `@/components/ui`; deep paths remain only inside
  `components/ui/**` itself.
- Convert the 279 deep imports mechanically, per directory, verifying after each batch.

## Phase 4 - Feature slice shape

- Normalize each of the 12 slices to `components/`, `hooks/`, `server/`, `types/`, `utils/`.
- Give every slice an explicit public surface and stop reaching into another slice's internals.
- Record the allowed cross-feature edges; move anything shared by three or more slices out to
  `components/ui` or `lib/` instead.

## Safety

- No change to Server Actions, Drizzle queries, transactions, ledger writes, audit logs, RBAC, or Zod
  schemas. This is a presentation and module-location change only.
- Preserve `lib/architecture/server-boundaries.test.ts` invariants; no `features/**/actions/`, no
  `"use server"` re-exports, no `@/db` import from a page.
- Preserve identity surfaces (bank account gradients) and existing motion tokens.
- Use `git mv` so history follows each moved file.

## Validation

Per phase, not only at the end:

- `bun test` (full suite; 359 tests green at the start, 364 at the end).
- `bunx tsc --noEmit`.
- `bun run lint` and `bun run tailwind:format` scoped to the touched paths.
- Storybook renders for every relocated primitive.
- Visual check at 320, 360, 390, and 430px on the surfaces touched by that phase.

## Outcome

All four phases landed. Measured results:

| Metric                                   | Before | After |
| ---------------------------------------- | ------ | ----- |
| Hardcoded `text-[Npx]`                   | 1075   | 845   |
| Deep `@/components/ui/**` imports        | 278    | 0     |
| Cross-feature imports into the dashboard | 20     | 5     |
| Cross-slice edges                        | 45     | 34    |
| Architecture tests                       | 1      | 3     |

### Where the work diverged from this plan

- **A live defect surfaced in phase 1.** `--font-mono` was never mapped, so JetBrains Mono was
  downloaded on every page and never used; all 90 `font-mono` financial values rendered in the
  system mono stack. Fixed while adding the scale.
- **Icon sizing changed approach mid-phase.** Defining `icon-*` as `font-size` made the
  canonical-classes lint rule suggest `icon-2xl` for a page-title `h1`, since it cannot tell an icon
  from text. The utilities became `width`/`height` instead.
- **Only two of the three duplicate pairs merged.** `StockImpactRow` and `MoneyImpactRow` share a
  before/after layout but not a contract: the stock version carries reservation-safety logic, unit
  formatting, and its own surface role. Merging needed a props explosion, so they stay separate.
  The unsaved-changes modals merged their markup but kept per-domain copy, because a material draft
  not touching stock and a finance form not recording a transaction are different consequences.
- **`risk-threshold-rail.tsx` was deleted, not moved.** It had zero consumers. The pattern stays
  documented; git history keeps the implementation.
- **Per-slice public barrels were not added.** The `settings <-> administration` cycle would have
  made them circular. The enforced edge allowlist in `feature-boundaries.test.ts` delivers the same
  explicit contract without the bundling risk.
- **`features/projects` stayed nested.** Its `detail/`, `list/`, and `shared/` sub-slices already
  follow the standard shape.

### Known debt, deliberately not addressed here

- `lucide-react` is still imported in roughly 30 files even though `CONTROL_LANGUAGE.md` mandates
  the Phosphor-backed `AppIcon`. One instance was removed as a side effect of merging the success
  sheets. The rest is its own change.
- `settings <-> administration` remains a slice-level cycle. The fix is promoting the
  configuration-workspace primitives (`SettingsModuleHeader`, `SettingsStatusLabel`,
  `SettingsRowChevron`) to the shared layer, which is a rename cascade.
- `.money-value-exact` in `globals.css` sets its own `font-size: clamp(...)`, which overrides the
  Tailwind size utility on that element. The utility there is dead styling, predating this work.
- The remaining 845 hardcoded sizes pair a size with a non-matching leading, specify no leading at
  all, or carry no role in the scale. They need per-surface judgement, not another mechanical pass.
