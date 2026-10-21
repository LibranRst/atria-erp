# RAP mobile editor polish

User still dislikes the review section layout, especially mobile input numbers that appear oversized/forced. Preserve the approved material-first concept and Apply/Save contracts.

- Make mobile editing a contextual grouped form: one field per full-width row, visible sentence-case labels left and values right, quiet dividers, a lighter input weight and the shared 16px touch-input floor to avoid keyboard zoom. Remove repeated visible row-number labels while retaining accessible row context.
- Reuse FormField inline layout and public TextInput/NumericInput/MoneyInput. Keep one DOM input tree across resize; the desktop table still exposes editable cells. Extend the opt-in DesktopTable review skin rather than creating new form infrastructure.
- Keep fullDynamic read amounts, natural sheet height, five/ten-row pagination, draft persistence, and explicit Apply before business Save. No backend/calculation changes.
- Verify actual dev @Browser mobile 320/360/390/430, intermediate 716 and desktop 1024/1280/1440, expanded/closed row, input focus/value on resize, dirty close and disabled Save before Apply. No business Save in dev QA.
- Run relevant shared form/consent tests, types/lint/style/format gates, documentation and graph refresh. Preserve unrelated workspace work.

## Implemented and verified

Mobile editors now use public `FormField` inline rows, one field per row, with sentence-case visible labels. Row-qualified accessible names are retained, including an additive `MoneyInput` aria-label pass-through. The opt-in `DesktopTable` review skin uses Manrope and tabular digits for editable values, regular weight on mobile, and the shared 16px floor. Currency prefix and value sit together; fullDynamic read values and all draft/business contracts remain unchanged.

Dev @Browser verification covered 320/360/390/430/716/1024/1280/1440px. No horizontal overflow; a focused quantity value survived all eight sizes. Checked a single over-allocation row and the twelve-row paginated draft, expanded/collapsed editors, local subtotal/budget recalculation, disabled Save before Apply, Cancel retaining local edits, and discard protection. QA edits were reverted locally; no business Save was clicked. Visual evidence is under `output/ai-chat-qa/rap-mobile-editor/`.

Workspace tests: 1,951 passed, zero failures. Workspace build, web types, shared styles check, and scoped Prettier check passed. Lint passed with the existing unrelated Material Master `accept` dependency warning. Focused form, input typography, RAP consent DOM, and table suites also passed (13 tests). DESIGN.md and its sidecar record the mobile editor composition; graph refreshed after this change.
