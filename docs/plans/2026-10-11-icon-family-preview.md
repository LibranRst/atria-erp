# Atria icon family preview

## Approved direction

Compare current Phosphor with free Hugeicons Stroke Rounded in the shared AppIcon
Storybook gallery. Keep production icon mappings, public UI APIs and native iOS
SF Symbols unchanged. This is a visual evaluation, not a migration.

## Implementation

- Install exact Hugeicons React/core-free packages as web development dependencies.
- Use eight explicit, per-icon imports: DashboardSquare01, Folder01, Wallet01,
  Invoice01, CheckmarkBadge01, Package, Hammer and Settings01.
- Show 18/20/24px glyphs and interactive desktop sidebar, web mobile navigation,
  icon buttons and neutral grouped rows. Hugeicons uses a 1.5 stroke.
- Reuse AppIcon, DuotoneIconTile, IconButton, Button, SegmentedTabs, GroupedSurface
  and RowGroup. Extract the existing tile frame privately to share its geometry
  with the story-only outline candidate without changing the public tile API.
- Align Storybook's root font variables with production Manrope for truthful
  comparison. Keep all candidate imports in Storybook-only modules.

## Validation

Build Storybook, check relevant icon tests and workspace quality gates. Inspect
320/360/390/430 and 1024/1280/1440px together; verify no horizontal overflow,
all glyphs, selection, keyboard focus, accessible names and reduced motion.
Check the free package license and React Native renderer against the same eight
glyph definitions. Record the distinction between a renderer smoke check and
device-level verification. No native app or dock migration is included.

## Completed — 11 October 2026

- Story: `ui-icon-appicon--family-comparison`, with shared selection across both
  families and preserved selection when changing the comparison view.
- Storybook build and API/web/mobile typechecks pass. Workspace lint passes with
  one pre-existing hook warning in material-master-proposal-card.
- 24 icon, tile, shared boundary, button-motion and segmented-tab tests pass.
- Both preview views fit all seven exact CSS widths without horizontal overflow.
  Mobile navigation targets measure 48×48px; icon buttons have accessible labels.
  Keyboard Tab/Enter activation, selection, focus ring and reduced-motion press
  behavior were checked. Hugeicons' active navigation glyph remains white outline.
- Official Hugeicons React Native renderer 1.0.16 produces identical geometry for
  all eight free glyphs at 18/20/24px, using host SVG primitives in an isolated
  smoke check. No native device painting/screenshot is claimed.
- Evidence: `outputs/icon-preview/gallery-*.jpg`, `context-*.jpg`,
  `verification.json` and `native-render-smoke.tsx`.
- Changed-file formatting passes. Workspace formatting still reports 107
  unrelated existing files. The old gallery's 8px label was changed to `text-xs`;
  no design findings were suppressed or left unresolved.
