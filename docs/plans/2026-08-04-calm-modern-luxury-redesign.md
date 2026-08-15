# Calm Modern Luxury Visual Redesign

## Goal

Move Atria toward a calm, tactile, high-end mobile finance language without changing routes, data,
permissions, financial/material behavior, or information structure. Use the supplied project-app
reference for tonal layering, spacing, radius, typography, and icon character only.

## Rollout

1. Establish the semantic palette, radius, typography, icon, tab-count, attention-marker, and
   floating-shell primitives.
2. Redesign Dashboard Ringkasan and its loading, restricted, error, offline, stale, partial, and
   empty states; stop for visual approval.
3. After approval, update the active UI documentation and `atria-ui-ux` skill, then continue one
   approved view at a time through the remaining Dashboard tabs and application routes.
4. Preserve configured bank gradients as identity surfaces and keep the fixed `max-w-md` shell.

## Dashboard Remaining Tabs Gate

Cadence override approved by the user on 2026-08-04: redesign the remaining Dashboard tabs as one
combined review gate instead of pausing between tabs. The gate includes Persetujuan, Budget, Jatuh
Tempo, Rekening, and Material plus their tab-local empty, pending, detail-sheet, and error-adjacent
presentation. It preserves every query parameter, action, permission, drawer/sheet flow, and domain
structure. Motion remains limited to the existing segmented pill, sheets/backdrops, disclosures,
and tap feedback; tab content stays instant.

## First Review Unit Contract

Status: **approved with revision** on 2026-08-04. Decorative short attention markers were removed
from Ringkasan list items; continuous connectors remain timeline-only. Active UI documentation and
the `atria-ui-ux` skill were synchronized before work begins on the next view.

- Hierarchy remains financial position, priorities, risky budgets, nearest due items, material
  attention, then recent cash changes.
- One dark financial focal surface owns the hero amount and its supporting comparison.
- Related operational rows share solid white owners with tonal inset detail; ordinary rows and
  nested metrics receive no independent elevation.
- Priority/decision rows use duotone icon treatment, concise copy, tone, and position without a
  decorative left marker or severity rail.
- Progress context always exposes percentage plus nominal used/remaining values when available.
- Motion is limited to the existing active tab pill, FAB/overlay continuity, and interactive tap
  feedback, with reduced-motion fallbacks. Page and tab content remain instant.

## Verification

- Capture before/after Dashboard screenshots at 320, 390, and 430 px; check 360 px internally.
- Verify fresh and relevant runtime states, one-line primary money values, 48 px touch targets,
  focus visibility, screen-reader labels, safe-area clearance, and stable tab scrolling.
- Run focused presentation tests, TypeScript, ESLint, and a production build in proportion to the
  first slice.
- Preserve the existing dirty changes in `app/reconciliation/loading.tsx` and `eslint.config.mjs`.

## Dashboard All-Tabs Gate — Approved (2026-08-04)

Status: **approved**. Persetujuan, Budget, Jatuh Tempo, Rekening, and Material all shipped under the
First Review Unit Contract's grammar, with tab-local empty/pending/detail-sheet/error presentation.
Persetujuan is decision-first with budget impact visible before approval; Budget always exposes
percentage plus used/remaining nominal values; Jatuh Tempo is the one place a continuous vertical
connector is used, because it is a genuine timeline; Rekening dropped decorative blur/unnecessary
shadow from account detail, transactions, add/edit form, review state, and the color editor; Material
shows category budget context before shortage detail. 320/360/390/430 px visual QA, no horizontal
overflow, no wrapped primary values, stable tab-change document position, clean console/TypeScript/
ESLint, focused tests, and a production build all passed.

**Dashboard (`/ledger`, all tabs) is now the sole approved reference implementation.** Expenses is
not yet redesigned under this visual language — do not treat it as a reference until it clears its
own gate below.

## Bottom Navigation Alignment — Finalized (2026-08-04)

The closed `QuickActionFab` no longer offsets 6px above the tab-bar baseline (`bottom-nav-parts.tsx`
`QuickActionFab`'s closed-state `bottom` animates to `0`, not a positive offset); it and
`BottomTabBar` sit in one `items-center` flex row (`bottom-nav.tsx`), which centers both on the same
line by construction. Verified 0 px center delta and no horizontal overflow at 320/390/430 px.
`DESIGN.md` updated to drop the stale "~6px above nav baseline" language in both the Elevation &
Depth and Components/Navigation sections.

## Design-system tooling migration (2026-08-04)

The `atria-ui-ux` skill and `docs/05-ui-ux/*` referenced above (Rollout step 3, First Review Unit
Contract) were retired and folded into `DESIGN.md`/`PRODUCT.md` at the repo root — see
`docs/plans/2026-08-04-impeccable-design-system-migration.md`. Going forward, "synchronize active UI
documentation" means updating `DESIGN.md` (and `docs/02-product/MVP_BLUEPRINT.md` for any
non-visual/business-logic fact), not the retired skill.

## Remaining Surface Gates

Each gate: preserve current functionality and information structure; use Dashboard as a taste
reference, not a template — choose the content pattern from that page's own workflow, not from
Dashboard's layout; do not turn every page into a stack of summary cards; verify mobile widths and
runtime states; stop for user review; update `DESIGN.md`/docs only after approval.

Queue, in order:

1. Standalone Persetujuan (`/approvals`).
2. Projects list (`/projects`).
3. Project Detail: Ringkasan, RAP, RAB, Stok, Pengeluaran, Pembayaran, Margin.
4. Expenses: Pengeluaran Lapangan, Tagihan Vendor, Rencana Bayar, finance-entry forms/drawers.
5. Materials: Ringkasan, Inventori, Kebutuhan, Aktivitas.
6. Reconciliation: Mutasi Bank, Catatan Atria, Riwayat.
7. Settings: Ringkasan, Kesiapan Setup, Budget, Categories, Library, Material Master, Tim & Vendor.
8. Owner onboarding.
9. Finance onboarding review.
10. Profile.
11. Login, setup-owner, and mandatory-password support flows.
12. Final shared runtime-state and cross-route consistency audit.
