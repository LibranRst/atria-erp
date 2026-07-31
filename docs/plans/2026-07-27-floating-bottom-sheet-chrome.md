# Floating Chrome for Global Bottom Sheet

## Summary

- Apply a functional soft edge fade to every shared `BottomSheet`, including forms, detail views,
  pickers, and nested sheets.
- Let scrollable content pass behind the fixed header and footer chrome while preserving readable
  controls, safe-area clearance, natural sizing, keyboard behavior, and the existing overlay stack.
- Keep centered `ConfirmationModal` presentation unchanged.

## Implementation

- Change the shared sheet canvas to `surface-container-low` and restructure the sheet body as the
  full scroll plane.
- Position the pull handle/header and optional footer above that scroll plane. Reserve their measured
  heights with scrollable spacers so resting and focused content is never hidden, while scrolled
  content can move beneath the chrome.
- Replace opaque header/footer fills, the footer divider, and local chrome blur with token-based
  directional gradients that are strongest beneath text and controls and fade toward content.
- Preserve `BottomSheet`, `OperationalFormSheet`, `WorkflowFormSheet`, and `SheetFooterActions`
  public APIs and all existing focus, drag, resize, nested-sheet, safe-area, and exit behavior.
- Document the functional edge-scrim exception without permitting decorative gradients.

## Verification

- Cover floating chrome structure and overflow/keyboard metrics with focused regression tests.
- Check short, long, expandable, footerless, one-action, two-action, status, disabled, and nested
  sheet states.
- Verify 320, 360, 390, and 430 px widths, keyboard and safe-area behavior, focus order, screen-reader
  labels, touch targets, reduced motion, TypeScript, ESLint, tests, and production build.

## Motion

Existing `BottomSheet` slide and backdrop fade only, using the current shared motion tokens and
reduced-motion behavior. No new animation is introduced.
