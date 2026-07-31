---
name: atria-ui-ux
description: Design, implement, redesign, rework, style, plan, audit, or review any Atria ERP user interface using its Dashboard-led mobile iOS design language. Use for pages, components, forms, inputs, buttons, tabs, filters, cards, grouped rows, financial values, loading and runtime states, drawers, sheets, dialogs, modals, navigation, responsive behavior, accessibility, visual QA, and Framer Motion decisions.
---

# Atria UI/UX

Apply Atria's calm, premium, operational mobile language without turning every workflow into a copy of Dashboard. Treat this skill as the mandatory entrypoint for every UI/UX task, including planning and review-only work.

## Required Sources

Before making a UI decision:

1. Read `docs/05-ui-ux/MAIN_SURFACE_DESIGN_LANGUAGE.md`.
2. Read `docs/05-ui-ux/IOS26_SOLID_DESIGN_SYSTEM.md`.
3. Read `docs/05-ui-ux/CONTROL_LANGUAGE.md` whenever adding, reviewing, or changing a button, sheet action, badge, count, metadata chip, color token, or icon. Use the typed Phosphor-backed `AppIcon` mapping; do not add Material Symbols or icon fonts.
4. Inspect the live implementation relevant to the task; do not rely on old plans or screenshots.
5. Read [references/visual-pattern-catalog.md](references/visual-pattern-catalog.md) for main-page or form work.
6. Read [references/motion-and-interaction.md](references/motion-and-interaction.md) whenever the task contains interaction, state changes, overlays, or animation.

For Dashboard-led main surfaces, inspect all applicable code under `features/finance-dashboard/components/`, including Ringkasan, Persetujuan, Budget, Jatuh Tempo, Rekening, and Material. For forms, inspect the current `ExpenseForm`, `VendorBillForm`, and `ProjectDrawer` implementations plus their shared form and sheet primitives.

Dashboard and the approved forms are taste references, not universal layouts. Reuse their grammar and shared primitives when semantics match. Never copy class strings merely to imitate their appearance.

## Workflow

### 1. Ground the Design

- Identify the role, workflow, primary decision, financial or operational risk, and supported runtime states.
- Inspect the existing route, shared primitives, loading skeleton, and nearest approved reference.
- Preserve project finance, category budget, material-control, RBAC, and client-safety requirements from `AGENTS.md`.

### 2. State the UI Contract

Before implementation, state:

- the information hierarchy;
- the focal, grouped, decision, identity, inline, state, and inset metric surfaces required;
- the row and financial-value patterns;
- empty, loading, error, restricted, partial/stale, pending, success, and failure behavior relevant to the flow;
- the motion decision, including `no animation` where stability is preferable.

Do not invent a focal summary, chart, card, progress indicator, or animation when it does not improve a real decision.

### 3. Compose with Existing Primitives

- Keep the fixed `max-w-md` shell one column at all viewport sizes.
- Use at most one justified focal summary.
- Put simple related rows on one soft grouped surface with dividers.
- Use a decision item when one entity is independently actionable and needs internal comparison. It may contain one compact neutral inset grid of 2–3 comparable values.
- Treat inset metric cells as contents of their owning surface: no independent shadow or elevation, quiet radius, and semantic tone on the value, icon, or status by default.
- Use semantic surface, ring, focus-ring, and shadow utilities from `app/globals.css` and
  `CONTROL_LANGUAGE.md`. Never add warm neutral values, raw neutral palette utilities, arbitrary
  Tailwind shadows, `ring-black/*`, raw `box-shadow`, or component-local focus-ring colors.
- Use the global main-surface primitives from `components/ui/feedback/` for summary, grouped,
  section-header, detail-section, row-group, summary-fact, and inline-state contracts. Do not add a
  feature-prefixed duplicate when the semantics match.
- Preserve standalone cards for focal, decision, interactive, or identity units such as configured bank accounts.
- Use `MoneyValue`, tabular numerals, compact primary amounts, and exact supporting amounts. Never wrap a primary financial value at supported widths.
- Use `SegmentedTabs` for genuine peer views or filters. Keep tab content replacement instant and the document position stable.
- Use `SectionCountPill` for a cardinal item/workload total in a section header. Keep status,
  dates, periods, ratios/progress, and descriptive context as plain metadata.
- Use structural skeletons matching the final hierarchy.
- Keep visible controls compact while preserving a 48x48px effective target, keyboard focus, screen-reader names, and safe-area clearance.

### 4. Apply Contextual Forms

- Use standalone white `rounded-full`, `min-h-12`, `px-5` controls only outside grouped forms.
- Let `FormSection` own one white 24–28px surface. Render its controls as labeled, borderless rows with subtle dividers; do not nest a capsule around every value.
- Use `rounded-2xl` for standalone textareas and an unboxed growing row for grouped textareas.
- Keep buttons, selectors, toggles, and option actions capsule-shaped.
- Prefer `OperationalFormSheet` for data entry, `WorkflowFormSheet` for review/commit steps, and existing confirmation/success primitives when their contracts fit.
- Show budget impact, irreversible effects, autosave/recovery, and review confirmation where the workflow requires them. Keep non-material expense entry fast.

### 5. Set a Motion Budget

- Use Framer Motion and tokens from `lib/utils/motion.ts`; never define ad-hoc springs or raw CSS keyframes.
- Allow motion only for sheet/backdrop continuity, modal entry and exit, meaningful morphs, disclosure height changes, tap feedback, success feedback, progress changes, and the active segmented-tab pill.
- Keep route changes, page changes, tab/filter content, ordinary sections, and lists instant and stable.
- Do not add staggered entrances, decorative loops, or motion to every card or row.
- Respect reduced motion and preserve functionality with motion disabled.

### 6. Verify Before Handoff

For a main page, form, or overlay, verify 320, 360, 390, and 430px. For a micro-edit, verify the affected width plus the nearest regression surface.

Confirm:

- no horizontal overflow or wrapped primary amounts;
- no wrapping, competing elevation, or more than three equal-weight cells in an inset metric row;
- no warm neutral undertone, arbitrary shadow recipe, local focus-ring color, or nested elevation;
- stable document position when tabs or filters change;
- skeleton-to-content stability;
- relevant runtime states;
- keyboard, screen-reader, focus, touch-target, safe-area, and reduced-motion behavior;
- browser console, TypeScript, ESLint, tests, and build in proportion to the change.

In the handoff, report the visual references used, widths and states checked, and the motion decision. Do not claim visual acceptance from a desktop preview alone.

## Non-Negotiable Anti-Patterns

- Generic admin dashboard composition or spreadsheet-like mobile UI
- Elevated standalone cards, pills, or progress bars repeated under every section
- Tonal or rainbow inset metric cells without a whole-cell semantic reason
- Inset metric grids used for activity, history, transactions, or simple title/meta/value rows
- Nested capsules for ordinary grouped rows
- Decorative gradients, glass, blur, charts, rails, or animation
- Oversized mobile typography, spacing, tabs, or controls
- Color-only status or unexplained financial numbers
- Whole-page, tab-content, filter-content, or list entrance transitions
- A Dashboard layout copied into a workflow with different information needs
