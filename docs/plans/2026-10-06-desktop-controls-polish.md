# Desktop shared controls refinement

## Scope

Refine the unified responsive web workspace through public shared UI. Preserve canonical URLs, existing workflows, permissions, project scope, mobile styling, and the shared overlay focus/dismissal owner. No backend or database changes; the standalone prototype cutover is outside this task.

## Changes

1. Unify desktop button/link press feedback: scale up while pressed, semantic depth, disabled/pending and reduced-motion handling.
2. Align all desktop topbar controls, including notifications and profile, to 40px (48px for coarse pointers).
3. Use native HeroUI Dropdown/Select plus Autocomplete filtering and SearchField through private desktop adapters; retain grouping, search, disabled reasons, and create actions.
4. Separate selected labels from metadata/counts, animate desktop popovers and indicators with Atria Framer Motion presets.
5. Keep grouped fields borderless when focused, with a visible focus treatment matching the owning row.
6. Fill confirmation action grids, including project draft recovery.
7. Render table bodies white with clear dividers, restrained interactive states, keyboard focus, sorting, selection, and horizontal scrolling.
8. Restore the sliding segmented-tab indicator without changing HeroUI keyboard semantics or reading position.

## Acceptance

- Inspect real UI at desktop 1024/1280/1440 and mobile 320/360/390/430.
- Exercise press/hold, keyboard navigation, dropdown/select metadata, nested sheet focus, draft confirmation, sorting/selection, tabs, and reduced motion using the synthetic fixture API.
- Run scoped component tests, TypeScript, lint, format, styles/token checks, and production build. Broaden tests once shared-component changes pass.
- Update the shared design contract where behavior changes; record results and existing failures below.

## Verification

- Implemented all eight refinements through shared Button/ButtonLink/IconButton, ActionMenu, AdaptiveSelect/ComboboxField, DesktopTable, SegmentedTabs, and shared overlay/draft-confirmation contracts. HeroUI imports remain private to desktop adapters; mobile control backends retain their existing behavior.
- Desktop header controls measure 40px each. Pointer hold scales up with raised depth; release returns to 1; reduced-motion controls remain at 1.
- HeroUI Dropdown now includes MenuItem styles/icons. Searchable choices compose native Select, Autocomplete.Filter and SearchField; metadata has its own line/slot, disabled reasons/groups remain available, and only the selected item shows a check.
- Native selector Escape is captured before its popup closes, so parent sheets/dialogs cannot also dismiss. SearchField follows its native behavior: first Escape clears a nonempty query, next Escape closes the popup.
- Grouped text focus remains square/borderless with an owning-field underline. Draft confirmation actions fill the primary row and both grid cells; continue restores the form and resize preserves the draft.
- Table default cells are RGB 255/255/255. Numeric sorting, selected-row detail, visible selection check, keyboard navigation, and horizontal containment passed browser checks.
- Motion was measured in Chromium with reduced motion disabled: the tab pill crossed 16–18 intermediate positions; popover content opacity progressed from near 0 to 1. Native hidden collections remain mounted for stable selected labels; Framer animates a real content node on opening.
- Visual and functional checks passed at desktop 1024/1280/1440 and mobile 320/360/390/430. No document overflow, desktop CSS scope on mobile, or browser exceptions. Mobile screenshots were also inspected after initial indicator measurement settled.
- Validation: 1,741 workspace tests passed, 0 failed; 164 live-database API cases skipped because no disposable database was configured. API/web/mobile TypeScript, workspace lint, web production build, scoped-style drift and token checks passed.
- Changed-file format check passed. Whole-repository format check still reports 123 existing failures outside this refinement. Synthetic loopback fixtures were used; no development database mutations were run.
- DESIGN.md, the Impeccable sidecar and the desktop toolkit story reflect the updated interaction contracts. The Graft graph was refreshed.
