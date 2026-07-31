# Library Settings Manager Structural Refactor

## Context

`features/settings/components/library/library-settings-manager.tsx` currently owns
workspace state, mutation orchestration, list presentation, template form
presentation, and component-cost form presentation. The latter already has a
dedicated `library-cost-component-sheet.tsx`, but the manager still duplicates
that markup and its local draft types.

## Scope

- Move shared Library draft types to `features/settings/types/library-types.ts`.
- Use the existing `LibraryCostComponentSheet` from the manager.
- Extract the template list and template editor into focused Library components.
- Keep the manager as the state/mutation orchestration boundary.
- Move client mutation orchestration to a feature hook while keeping Server
  Actions in their existing authoritative application boundaries.
- Preserve existing actions, validation conditions, unsaved-change prompts,
  filtering, Settings/onboarding presentations, and pricing calculations.

## UI Contract

- Information hierarchy remains: Settings header/filter, grouped template rows,
  then the existing focused editor sheets.
- Existing grouped surfaces, row values, and operational-form primitives are
  reused; no new control family or status treatment is introduced.
- Empty, filtered-empty, invalid-draft, pending, and confirmation states retain
  their existing copy and behavior.
- Motion: no new page or tab-content animation; retain only existing local tap
  feedback and OperationalFormSheet transitions with their reduced-motion path.

## Verification

- Type-check the affected Settings feature.
- Run focused ESLint and relevant tests, then inspect formatting.
- Verify the Settings and onboarding callers still use the same public manager
  contract. UI viewport validation is deferred until a running app is available;
  no layout behavior is intentionally changed.
