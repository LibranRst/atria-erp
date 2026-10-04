# Desktop HeroUI refinement

Status: implemented; final verification recorded in the desktop guide.

Approved request: fix topbar AI link/avatar geometry, tab navigation escaping desktop, and over-wide tab tracks; prefer appropriate HeroUI components throughout desktop.

- Keep URL/history updates within the current workspace, including query/hash/native presentation markers; cover the real Dashboard tab handler with a regression.
- Use HeroUI Link/Button styling and Avatar through shared desktop adapters; guarantee one-line icon/text and fixed square avatar geometry.
- Extend the public SegmentedTabs contract with a desktop HeroUI Tabs backend and intrinsic-width track, bounded by its parent. Retain mobile behavior and stable vertical scroll.
- Retain the actual HeroUI Table compound anatomy, use built-in single-row selection, sortable headers where the column provides a sort value, and preserve domain actions/money/status semantics.
- Use HeroUI for desktop shared text input, textarea and switch controls where native props match existing contracts. Keep finance-specific input formatting and managed outer overlay contracts.
- Compile selective, scoped styles with existing Atria tokens, no default global theme/reset. Verify desktop/tab/back-forward/selection/keyboard/avatar states and mobile regression; run targeted tests, TypeScript, lint and build.
