# Migrate UI/UX Design-System Tooling to Impeccable

## Goal

Replace the bespoke `.agents/skills/atria-ui-ux/` skill (symlinked as `.claude/skills/atria-ui-ux`)
and `docs/05-ui-ux/*.md` as the mandatory UI/UX workflow and source of truth with the Impeccable
skill's own method: `PRODUCT.md` and `DESIGN.md` at the repo root, driven by Impeccable's commands
(`document`, `audit`, `polish`, etc.). This is a tooling/process migration — Atria's actual
established design approach ("The Quiet Command Center": calm ink-and-terracotta, flat tonal
layering, capsule controls, iOS-inspired without glass/gradients/decorative motion) is unchanged.

## What moved where

`PRODUCT.md` and `DESIGN.md` already existed at the repo root going into this migration (written
earlier during the in-flight "Calm Modern Luxury" redesign, see
`docs/plans/2026-08-04-calm-modern-luxury-redesign.md`) and already carried the palette/typography/
shape/elevation tokens. This migration read every file in the old skill and docs at their current
(already-modified-today) content and folded the rest in:

- **Visual design-system content** (named components, semantic token utility classes, numeric
  motion-preset values, the full anti-pattern list) from `MAIN_SURFACE_DESIGN_LANGUAGE.md`,
  `CONTROL_LANGUAGE.md`, `IOS26_SOLID_DESIGN_SYSTEM.md`, and the skill's
  `references/visual-pattern-catalog.md`/`references/motion-and-interaction.md` → folded into
  `DESIGN.md`'s Layout, Elevation & Depth, Components, and Do's/Don'ts sections, and mirrored into
  `.impeccable/design.json`'s `extensions.motion[]` and `narrative.dos/donts`.
- **Product/business-logic content** that wasn't visual design at all — Dashboard tab ordering
  (Ringkasan/Persetujuan/Budget/Jatuh Tempo/Rekening/Material), Category Budget Card fields,
  Settings module list — from `MOBILE_FIRST_UI_UX.md` and `DASHBOARD_WIREFRAME.md` → relocated into
  `docs/02-product/MVP_BLUEPRINT.md` (Modules 2B, 4, 10). Confirmed via grep this content was
  unique — not already duplicated in `MVP_BLUEPRINT.md`/`FLOWS.md`/`PRD.md`.
- **Two dangling doc references and one durable fact** ("never label the UI 'Excel'") →
  `PRODUCT.md`'s Accessibility & Inclusion, Brand Commitments, Evidence on Hand, and Operating
  Context sections now point at `DESIGN.md`/`AGENTS.md` instead of the deleted docs.
- The Client-facing RAB safety rule and Core Screens inventory were already covered by
  `docs/03-flows/FLOWS.md` / `docs/01-product/PRD.md` / `AGENTS.md` — not duplicated again.

## Deleted

- `docs/05-ui-ux/` (all 5 files).
- `.agents/skills/atria-ui-ux/` (`SKILL.md`, `references/`, `agents/openai.yaml`).
- `.claude/skills/atria-ui-ux` symlink.

## Updated

- `CLAUDE.md` — "UI/UX Direction" section and "Documentation Map to Read Before Work" now point at
  Impeccable + `PRODUCT.md`/`DESIGN.md`, keeping every durable hard constraint inline (mobile shell
  - verification widths, `MoneyValue`/tabular numerals, semantic-token-only rule, `SegmentedTabs`
    stability, 48px targets, `lib/utils/motion.ts` presets, Dashboard/Expenses reference pointer).
- `AGENTS.md` — "UI/UX Rules" section repointed the same way, plus an explicit rule against
  rendering raw enums (`formatBusinessLabel` at the presentation boundary) that was previously only
  documented in the deleted `MAIN_SURFACE_DESIGN_LANGUAGE.md`.
- `README.md` — "Documentation Map" repointed from the deleted files to `PRODUCT.md`/`DESIGN.md`.

Historical files under `docs/plans/**` that still mention the old skill/docs are left untouched —
they're historical record of what was true when written, not active guidance (per CLAUDE.md's own
precedence rule that executable code and active guides outrank historical plans).

## Not in scope

This migration did not touch any application/component code, tests, or `app/globals.css` — those
remain whatever state the in-flight "Calm Modern Luxury" redesign left them in.
