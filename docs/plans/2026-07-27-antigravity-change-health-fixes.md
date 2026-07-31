# Antigravity Change Health Fixes

## Context

The latest working-tree changes improve dashboard summaries, Finance Admin
approval visibility, and activity-detail access, but the review found release
blockers and UI regressions around activity-detail runtime states, sheet
presence, project-tab scrolling, repeated metric cards, and unbounded dashboard
approval details.

## Scope

- Keep activity-detail data mounted through the existing BottomSheet exit.
- Make activity-detail loading race-safe and provide an explicit retry action.
- Use the typed `AppIcon` and shared `Button` primitives in the new sheet.
- Keep project-tab content replacement instant and restore scroll position
  without smooth scrolling.
- Render summary facts as inline grouped facts instead of nested cards.
- Keep the dashboard approval count complete while limiting preview details.
- Keep full-queue approval aggregates separate from the five-row Dashboard preview.
- Present all summary facts as compact neutral cells, including dense
  three-column summaries, while applying semantic tone only to their values.
- Optically center numeric count badges across compact tabs and filters.

## UI Contract

- Activity detail uses one BottomSheet with structural loading, actionable error,
  and grouped success content.
- Error recovery uses a 48px secondary capsule action.
- The last presented activity remains available until the sheet exit completes.
- Summary facts use one compact neutral card treatment inside their parent
  surface. Risk tone belongs to the value, not the card background.
- Approval summaries show critical workload and items waiting at least three
  days; type counts remain available in filters.
- Project tab changes preserve the reading position without animated document
  scrolling.
- Motion: existing BottomSheet slide/fade only; no page or tab-content motion.

## Verification

- Focused ESLint for changed files.
- Activity-detail, dashboard, expenses, and project presentation tests.
- TypeScript check and production build.
- Inspect 320, 360, 390, and 430px when an authenticated runtime is available.
