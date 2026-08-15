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
| Hardcoded `text-[Npx]`                   | 1075   | 353   |
| Deep `@/components/ui/**` imports        | 278    | 0     |
| Cross-feature imports into the dashboard | 20     | 5     |
| Cross-slice edges                        | 45     | 33    |
| Slice-level dependency cycles            | 1      | 0     |
| Icon libraries in use                    | 2      | 1     |
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

### Recorded debt, since cleared

Every item below was written up as deferred, then closed in a follow-up pass.

- **`lucide-react` removed.** It was imported in 29 files against the single-icon-set rule, so two
  libraries with different stroke weights rendered side by side. All 38 distinct icons map onto
  `AppIcon`; eleven entries were added to the map. Two call sites needed more than a tag swap, since
  they held an icon as a value: `FormRiskNotice` and the settings tab config, which typed its icon
  field as `typeof Settings2` and so coupled a plain config module to an icon library. The package
  is gone from `package.json`, and `ui-import-boundaries.test.ts` now fails on any third-party icon
  import.
- **The `settings <-> administration` cycle is broken.** The three configuration-workspace
  primitives moved to `components/ui/feedback/workspace-primitives.tsx` as `Workspace*`. None of them
  touched settings domain logic. `administration -> settings` is now zero.
- **`.money-value-exact` dead styling removed.** `moneySecondarySizeClass` returned four Tailwind
  sizes that never applied, because the plain CSS rule sits outside `@layer` and always wins.
  Measured before the change: elements carrying `text-[14px]` and elements carrying `text-eyebrow`
  both rendered at 9px/9.9px. Rendering after removal is unchanged at 1280px and 390px.
- **Icon sizing moved onto the icon scale.** 151 `AppIcon` call sites still used `text-[Npx]`; they
  now use `icon-*`. No visual change, since a 1em SVG at `text-[18px]` and at `icon-md` both measure
  18px.

### Remaining: the hardcoded type sizes

This is the one open item, and it is open on purpose. The breakdown, measured rather than estimated:

| Group                                  | Count | Why a mechanical pass is wrong                        |
| -------------------------------------- | ----- | ----------------------------------------------------- |
| Size carries no role in the scale      | ~143  | 8px, 12px, 14px, 16px, 19px and similar have no token |
| Size with no explicit `leading`        | ~329  | The token would introduce a line-height, see below    |
| Size paired with a different `leading` | ~110  | The token would overwrite a deliberate line-height    |
| Icon sizes with no matching utility    | ~57   | 13, 15, 17, 19, 21, 23, 26, 32, 34, 36px one-offs     |

The middle group is the trap. Sampling live elements that set a size with no `leading` showed nine
of twelve inherit a 24px line-height, while the matching token would set 12–16px. Converting them
in bulk would tighten line boxes by 8–12px across hundreds of elements — a silent regression, not a
cleanup.

That sample also revealed the actual rule, and it turned out to be a provable fact, not a pattern
that needs re-checking per surface — though the first attribution was wrong. `app/layout.tsx:31` set
a `leading-lg` class directly on `<body>`, and the ancestor-chain walk found no wrapper between
`<body>` and any sampled node that re-declares `line-height`, so **every** element in the app that
does not set its own `leading-*` inherits the same ambient value, unconditionally. Sampling across
seven unrelated surfaces (`/ledger` two dashboard tabs, `/expenses`, `/settings`, `/materials`, a
project detail page — 139 elements total) found zero exceptions.

`leading-lg` itself, however, was never a valid Tailwind class. This project's leading scale (there is
no `--leading-lg` in `app/globals.css`) and Tailwind v4's own default scale (`tight`/`snug`/`normal`/
`relaxed`/`loose` only, per `node_modules/tailwindcss/theme.css`) both lack an `lg` size, so the class
compiled to zero CSS the entire time. Confirmed empirically by removing it and reading
`getComputedStyle(document.body).lineHeight` before and after: `24px` in both cases, no change.
The real source is Tailwind v4 Preflight (`node_modules/tailwindcss/preflight.css:29`):
`html, :host { line-height: 1.5; }` — a framework default, not a project-specific token. `leading-lg`
was removed from `app/layout.tsx` as dead-code cleanup; the ambient value is unchanged and the
decision (see below) is to leave the Preflight default alone rather than override it at the root.

Of the seven type tokens, only `text-title` (17px/24px) equals that ambient 1.5-ratio value at the
app's 16px base; the other six are all smaller than what 1.5× their own size would give them. This
means the remaining "no leading" sites at 9/10/11/13/15px **cannot** be converted by a blanket rule,
not "probably shouldn't" — doing so would always tighten the line box relative to the current render,
by construction, unless a closer ancestor happens to override the Preflight default (none did, in 139
sampled elements). Closing this gap for real means adding an intentional `leading-*` per site, a
design decision made one component at a time, not a continuation of the mechanical migration from
phase 1. The existing hand-added `leading-4`/`leading-5` overrides scattered across the app are
exactly this kind of per-site decision, made reactively against the same Preflight default — not
band-aids for a mistake, legitimate prior art for the same problem.

Acting on the proven-safe subset first: the 7 real `text-[17px]`-with-no-leading text sites in the
repo (excluding `AppIcon` sizes, which share the same numeric syntax, and one
`max-[430px]:text-[17px]` responsive override that is a different case) moved to `text-title`.
Verified in the browser at both before and after: every one measured 17px/24px both times.

Then the deliberate per-site pass proceeded feature by feature — reviewing each site's role (eyebrow
label, dense metadata, supporting text, row value, section title) against the matching bundled token,
applying it, and verifying visually per surface (including 320/360/390/430px) before committing:

| Area                                                               | Sites converted | Commit    |
| ------------------------------------------------------------------ | --------------- | --------- |
| finance-dashboard                                                  | 74              | `df255df` |
| projects                                                           | 60              | `55f141c` |
| settings                                                           | 47              | `0418097` |
| materials                                                          | 39              | `091af84` |
| approvals                                                          | 26              | `f0d418c` |
| components/ui (shared)                                             | 25              | `f9569bc` |
| onboarding                                                         | 20              | `7b1edff` |
| expenses/activity-detail/reconciliation/profile/administration/app | 35              | `1a2595c` |

326 sites total. The remaining 4 sites at token sizes with no explicit `leading` are not conversions
missed by the pass — they're 3 `AppIcon` instances whose `text-[17px]` is icon sizing on a multi-line
JSX tag (the single-line `AppIcon` check used while filtering didn't catch multi-line cases, but these
were never text sites) and the one `max-[430px]:text-[17px]` responsive-override case already called
out above as a different situation. The "no explicit leading" group is fully closed: 0 remaining text
sites among 9/10/11/13/15px.

Hardcoded `text-[Npx]` drops from 679 to 353. What's left is the other three groups from the table
above, none of which this pass targeted: sizes with no scale role (~138), sizes already paired with a
deliberate `leading-*` override (~154, unchanged by design — converting them would overwrite an
existing decision, not just an ambient default), and icon one-offs (~57, a separate icon-scale gap,
not a type-scale one).

### leading-lg was a dead class, not a design decision

Mid-pass, a stray uncommitted change surfaced: `leading-lg` had been removed from `app/layout.tsx`,
apparently in an earlier attempt to fix line spacing that looked too loose across the app, then left
uncommitted. It was restored on the assumption it was accidental debris — which was wrong. Testing
confirmed the removal was deliberate and, more importantly, correct in intent: `getComputedStyle`
showed `document.body`'s line-height was `24px` identically with or without the class, because
`leading-lg` was never valid Tailwind (no `--leading-lg` in this project's theme or Tailwind's default
scale) and compiled to no CSS. The real source of the ambient 24px is Tailwind v4 Preflight
(`html, :host { line-height: 1.5; }`), not anything project-specific. The class was removed again as
dead-code cleanup (`93ac2f0`); the decision was to leave the Preflight default itself alone rather
than override it at the root, since every dense-text site either now carries an explicit bundled
token or a hand-added `leading-4`/`leading-5` override, and a root-level change would touch every
untouched element in the app at once with no per-site review.
