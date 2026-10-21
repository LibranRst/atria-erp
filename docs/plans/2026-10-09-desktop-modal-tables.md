# Desktop modal table surfaces

User requests HeroUI-style tables inside desktop modals with tonal separation from the modal canvas; canvas changes are authorized where they improve clarity.

Preserve the established Atria Operate world and HeroUI primary-table topology. Desktop FormSheet canvas uses the existing lighter surface token; mobile keeps the low canvas. Modal tables own a cohesive surface-container frame/header/footer with white body rows, a four-pixel HeroUI inset and inset body corners. Page tables retain their existing low frame/header color. Reuse DesktopTable, GroupedSurface and FormSheet; scope contextual overrides to desktop modal tables, including ordinary tables and editable review tables. Generic DialogFrame surfaces containing desktop tables follow the same canvas relationship. Shared header/footer scrims match the owning canvas.

Keep real table semantics, sorting, selection, keyboard focus, input density, pagination, drafts and resize state. Do not add a palette, dependency or overlay owner. Generate scoped HeroUI CSS through the existing workspace script.

Verify in the dev Browser using RAP and package/readiness review tables, ordinary project page tables, and mobile regression at 320/360/390/430; desktop at 1024/1280/1440. Inspect computed canvas/frame/header/body colors, label contrast, corner continuity and overflow. Existing table/overlay/AI guard tests, scoped lint/typecheck/build/styles check, design-rule parity and graph refresh close the change. Synthetic QA previews never save business data.

## Verification

- Dev Browser confirms desktop canvas `surface` (245/245/247), modal frame/header `surface-container` (232/232/235), normal body rows white, and 28 px outer / 20 px inset corners. Disabled draft inputs keep their existing disabled treatment.
- Package review fits without document overflow at all three desktop and four mobile widths. Mobile keeps its low canvas and grouped rows. Pagination and open-review resize work; RAP budget disclosure opens normally. The ordinary Projects table retains its low frame/header (239/239/242).
- 19 targeted table/overlay/AI tests, scoped ESLint, web TypeScript, Prettier, HeroUI generation/check and web production build pass. Screenshot and computed-style evidence is under `output/ai-chat-qa/modal-tables/`.
- No business data was saved. Shared styling applies to DialogFrame tables, but visual browser evidence covers FormSheet reviews and the Projects page.

## Pagination follow-up

All AI review lists now show at most five rows per page on desktop and mobile, including Material Master, RAP drafts/changes, packages, readiness/finalization and lifecycle actions. Existing row anchors, selection, corrections and shared table controls are preserved. Browser verification confirms five rows on intermediate pages, two on the last page of a twelve-row proposal, correct Previous/Next states and a stable 6–10 range through all seven supported viewport widths. Five existing proposal interaction tests and scoped formatting/lint checks pass; lint retains the pre-existing Material Master effect-dependency warning. Evidence is under `output/ai-chat-qa/pagination-five/`.
