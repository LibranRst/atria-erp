# Desktop table header contrast

- User requested slightly darker headers wherever desktop tables blend with their canvas, including both RAP reviews.
- Apply the existing `surface-container` background and `on-surface-variant` foreground to header rows/cells in the shared HeroUI stylesheet. Keep body, footer, hover, focus, geometry and mobile grouped rows unchanged.
- Apply the same desktop background to AI Markdown tables. Client-facing export documents keep their separate print contract.
- Regenerate scoped HeroUI CSS, run its freshness check, verify existing table/Markdown tests and inspect dev web with the in-app Browser: RAP edit, RAP creation and an ordinary module table, plus mobile regression. Confirm actual foreground/background contrast.

## Verification

- Shared header background is RGB 232/232/235 and label foreground is RGB 58/58/60, with 9.28:1 contrast. Both RAP review tables and Proyek use these computed colors.
- Dev in-app Browser checks: ordinary table at 1024/1280/1440px has no horizontal overflow; RAP creation review at 320/360/390/430px retains clipped screen-reader-only headers and the grouped layout. No business data was saved during verification.
- Scoped stylesheet generation/freshness, formatting, ESLint, web production build and 24 existing table/Markdown tests passed.
- Finish review disposition: ship, no material findings. Markdown desktop styling was checked in source and tests; no separate Markdown browser capture was supplied.
- Evidence: `output/ai-chat-qa/saved-rap-changes/header-contrast-1280.png`, `header-contrast-create.png`, `header-contrast-projects.png`, `header-contrast-mobile.png`.
