# Dashboard Passive Refresh

## Goal

Replace the Dashboard's prominent stale-data refresh row with passive revalidation and an
exception-only recovery state. Preserve the existing force-dynamic server data, finance hierarchy,
tab state, RBAC, and all balance/material safety behavior.

## UI Contract

- The page header, peer tabs, and financial position keep their current hierarchy.
- Fresh data and successful background refreshes render no refresh control or success decoration.
- A snapshot older than five minutes revalidates when the browser regains focus or visibility.
- Restored connectivity triggers one revalidation. A sixty-second cooldown prevents duplicate
  focus/visibility requests.
- Partial-source and failed-refresh states render one compact shared grouped inline state on every
  Dashboard tab, with visible source context and an explicit `Coba lagi` action when useful.
- Offline state preserves the last valid snapshot and explains that connectivity is pending.
- Loading, route error, restricted, empty, and mutation states remain owned by their existing
  surfaces.

## Motion Decision

No entrance, exit, spinning, or layout animation is added. Background refresh is silent. The retry
button keeps the shared reduced-motion-aware tap feedback only.

## Verification

- Unit-test status resolution, refresh age, and cooldown behavior.
- Verify fresh, partial, refreshing, failed-refresh, and offline copy and accessibility.
- Verify the exceptional row at 320, 360, 390, and 430 px without horizontal overflow.
- Run targeted Bun tests, ESLint, TypeScript, and the production build in proportion to the change.
