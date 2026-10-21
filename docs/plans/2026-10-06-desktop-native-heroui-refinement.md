# Desktop native HeroUI refinement

## Approved direction

Desktop action/icon colors follow their owning surface: bright white containers use ink buttons; gray containers use white buttons. Form inputs, dropdown choices and destructive variants retain their semantic roles. Status filters become compact dropdowns with aligned labels/counts; the whole positioned popup uses the same spring/scale/translation as the FAB dropdown. Search remains available for long entity choices.

Restore HeroUI 3.2.6 Table primary appearance: native gray frame/header, white body, native radius, cell padding, header weight, sort indicator and interaction states. Retain Manrope, MoneyValue, typed data/sorting, row navigation and shared accessibility contracts. Desktop topbar uses the website's semantic background canvas.

## Implementation

1. Add a private desktop filter adapter behind public FilterSelect; preserve mobile behavior, selected values, disabled options, query callbacks and keyboard semantics. Animate the owning popup with the FAB's Atria Framer spring preset.
2. Remove table-specific visual overrides and custom selection decoration; keep only theme variable bridges necessary for native surface colors. Tables size to their content alongside detail panels.
3. Change desktop topbar to bg-background and derive normal action/button colors from the nearest owning surface through scoped semantic variables. Preserve button scale-up/depth, danger variants and existing 40px/48px sizing.
4. Align DESIGN.md and the Impeccable sidecar with this revised direction; update stories/contracts where interaction changes.

## Verification

Use the loopback synthetic API for UI scenarios. Run relevant shared UI tests, TypeScript, workspace tests/lint, scoped-style drift, token checks, changed-file format and web production build. Perform one combined desktop/mobile visual inspection, one repair batch if needed, and one confirmation pass. Cover fixed status filters, long-search choices, disabled options, keyboard/reduced motion, table sorting/selection, button colors and mobile CSS isolation. No database changes.

Implemented through shared FilterSelect, DesktopTable and action/icon adapters. The project status consumer now supplies counts as trailing metadata. Normal button tones inherit scoped semantic surface variables, including native table state changes; date-navigation utilities reuse shared controls. Mobile renderers are unchanged.

Browser verification passed on the synthetic loopback fixture: gray topbar/white buttons, white table cells/ink buttons, selected gray row/white buttons, native 20px table radius, 12px cell padding and medium header weight; numeric sorting, row selection, fixed-status filtering and keyboard dismissal. The owning filter popup uses the FAB spring/scale/translation, with immediate presentation for reduced motion. Desktop 1024/1280/1440 and mobile 320/360/390/430 had no document overflow or desktop CSS scope on mobile, and no browser exceptions.

66 shared UI/overlay tests passed; targeted UI lint, changed-file format, scoped styles and token checks passed. The first web TypeScript check passed before the API declaration generator was run. Global validation is currently blocked by unrelated in-progress backend/seed changes: API type errors (including missing addRab/addAllocations and seed/audit record typing), six API lint errors, tenant/AI-registry test failures, and a hardcoded-company boundary failure in the new material master writer. The direct Next build compiled successfully, but its type phase inherited errors from the incomplete API declarations. No backend files were changed to work around those failures, and no development database mutations were run.

The design hook reports existing 28/36/32px type in the mobile branch of project-list-header.tsx. Those unchanged mobile heading/focal-count values are outside the approved desktop refinement; preserve the mobile reference instead of altering its hierarchy as a side effect.
