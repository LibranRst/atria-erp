# Hugeicons Stroke Rounded migration

## Authorized scope

Use the free Hugeicons Stroke Rounded family throughout web and mobile UI.
Keep native iOS dock SF Symbols intact. Visual verification is web-only as the
user requested; mobile receives type, renderer and bundle checks without device
or simulator screenshots.

## Implementation

- Introduce `@atria/icons`, a platform-independent registry of free icon data,
  shared names, safe fallback and the 1.5 stroke default. Preserve the union of
  both clients' existing aliases and inspect all icon-name callers for gaps.
- Keep `AppIcon` public names, SVG sizing/props, native sizing/color/style and
  existing call sites compatible. Legacy `weight` values are consumed but always
  render the one free outline family. Remove web's previous 110% glyph scale.
- Use the official React and React Native renderers; install native SVG through
  the project's Expo SDK installer. Keep all finance/material/RBAC behavior intact.
- Keep the React web renderer inside a client leaf for React Server Component
  compatibility. Standard SVG class sizing remains the public contract.
- Keep `DuotoneIconTile` as a compatibility name for the existing neutral tile
  frame, now containing an outline glyph. Preserve public interaction primitives,
  labels, touch targets, focus and motion owners.
- Update the transitional standalone web shell's remaining direct Phosphor imports
  through its own shared icon adapter. Preserve its theme and session boundaries.
- Preserve the approved comparison story with an isolated historical Phosphor
  reference; Phosphor remains a web development dependency only. Update DESIGN.md
  and its sidecar to identify Hugeicons and outline active navigation as canonical.

## Validation and acceptance

- Every previous icon alias and every literal icon-name use resolves to a free
  glyph, with a safe question fallback for genuinely unknown names.
- Check full registry rendering, legacy weights, SVG/native props, distinctive
  state icons, shared architecture boundaries and existing icon/control tests.
- Run workspace typechecks/lint, changed-file formatting and web/native bundles.
- Inspect the web icon gallery and representative canonical shell/dashboard,
  project, expense, material and settings contexts at the supported web viewport
  matrix. Keep inspection to one batch plus one correction/confirmation batch.
- Native dock source and SF Symbols remain unchanged. No mobile visual review,
  database reset, seed changes or finance/material mutations are included.

## Native control coverage

SF Symbols outside the dock were also found in app-owned header buttons, action
menus, segmented controls and sheet-header actions. Chrome buttons compose
`AppIcon` through the existing RNHostView. UIKit/menu slots use generated 20pt @3x
template images from the exact same free SVG data, keeping native owners, tint,
focus, dismissal and callbacks. The native module must be rebuilt to pick up the
new icon-data props; no device or simulator visual review is included.

## Completed — 11 October 2026

- 151 shared names map to 118 free glyphs, including the question fallback. All
  144 original aliases are preserved. Caller gaps `block`, `check-circle`,
  `settings`, `home`, `swap_vert` and the two chrome caret names are covered.
- Web/mobile/public adapters, neutral tiles, transitional admin icons and native
  app-owned controls use Hugeicons. The iOS dock implementation was compared
  byte-for-byte with the pre-migration source and remains unchanged.
- API, web, mobile and admin typechecks pass. Production web and Storybook builds
  pass; final iOS/Android JavaScript bundle exports pass. Swift syntax parsing
  passes; native binary compilation/device painting remains deferred.
- 198 web UI/architecture tests, 107 mobile tests and four registry/template tests
  pass. Focused adapter checks were repeated after adding the final aliases.
- Web visual checks cover Dashboard, Budget, Projects, loaded Expenses, Materials
  and Settings at 1024/1280/1440px. No old Phosphor SVGs or document overflow were
  found. The complete Storybook gallery renders all 151 names at 1280px. No native
  visual review was performed.
- Evidence is under `outputs/hugeicons-migration/`; the isolated verification web
  server uses port3015 with the existing API and demo session. Existing development
  services were not restarted. The comparison story retains historical Phosphor
  only as a development dependency.
- A build blocker in chat-message.tsx had imports preceding `use client`; its
  directive order was corrected while preserving its component behavior.
- Changed-file lint/format pass. Workspace lint still reports unrelated AI expense
  batch issues; workspace formatting reports 125 unrelated files. The existing
  desktop Settings financial layout is too narrow and is recorded as separate
  layout work; no layout redesign was included in this icon migration.
