# Projects Main-Surface Rework

## Goal

Bring `/projects` into the active Dashboard/Expenses/Approvals design language while preserving project data, URL filters, RBAC, create/edit mutations, the global FAB, Project Detail, and the existing project form drawer.

## Audit

- Large 160 px cover cards dominate the viewport and delay comparison between projects.
- Status, health, budget status, values, progress, PM, and risk reason compete at similar visual weight.
- Search and hand-built filter pills do not use the shared segmented-control behavior.
- The same generic progress line appears on every project regardless of whether a threshold is actionable.
- Route loading is generic and does not match the project portfolio hierarchy.

## Implementation

1. Keep the existing scoped server query, effective-health derivation, permissions, URL filter contract, and project drawer behavior unchanged.
2. Add one compact portfolio summary derived from the already-loaded projects: active count and contract value first, followed by internal budget, actual cost, and projects requiring attention.
3. Replace custom filter pills with shared compact `SegmentedTabs`; preserve all filters, translate visible labels into concise Indonesian, and show counts only for actionable warning/critical filters.
4. Preserve the search field in a light sticky control area without a large standalone card. Keep filter changes at the current reading position.
5. Replace oversized cover cards with compact independent project cards: thumbnail identity, project/client/location hierarchy, calm status labels, financial comparison, PM context, and a clear Project Detail affordance.
6. Remove the generic progress bar. Show an effective-health explanation and reuse the Dashboard portfolio-style used-versus-remaining budget split for warning/critical projects, including an overflow end-cap above 100%.
7. Keep edit access Owner/Finance-only and continue routing normal review to `/projects/[id]`.
8. Replace route loading with a structural skeleton matching the page header, portfolio summary, search/filter strip, and compact project cards.
9. Add focused presentation coverage for portfolio aggregation, filter labels/counts, risk presentation, and loading structure.

## Verification

- Verify Owner/Finance edit access and non-authorized read-only behavior.
- Verify search plus every URL filter without document scroll jumps.
- Verify cover/no-cover cards, missing location, absent budget, healthy/warning/critical states, and long project names.
- Browser-check 320, 360, 390, and 430 px for wrapping, horizontal overflow, tab scrolling, touch targets, and bottom-nav clearance.
- Run focused tests, TypeScript, ESLint, full Bun tests, production build, and browser console checks in proportion to the change.
