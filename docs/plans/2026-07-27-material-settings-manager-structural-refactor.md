# Material Settings Manager Structural Refactor

## Scope

- Move Material Master draft and option types into the Settings type boundary.
- Extract the repeated grouped Material Master list from its workspace manager.
- Extract category creation and inventory-default sheets so each overlay owns
  its presentation contract.
- Extract the Material create/edit form and detail sheet; the manager only
  supplies drafts, validation state, and persistence callbacks.
- Move client mutation orchestration into a Settings hook while retaining all
  authoritative Server Actions in `app/actions/settings/system.ts`.
- Preserve all settings actions, inventory-default-only behavior, detail-sheet
  handoff, unsaved-change handling, filters, and onboarding presentation.

## UI Contract

The page keeps its existing hierarchy: header and filter, grouped Material
Master rows, then contextual detail and edit sheets. Empty and filtered-empty
states remain unchanged. Motion: no new animation; existing sheet and local tap
feedback are retained.

## Verification

Run focused formatting, ESLint, TypeScript, Settings presentation tests, and
diff whitespace validation. No visual behavior is intentionally changed.
