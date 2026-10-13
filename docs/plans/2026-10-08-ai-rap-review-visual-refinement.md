# RAP review visual refinement

User approves the current concept and requests five concrete visual corrections: remove table corner slivers, make mobile table ownership visibly rounded, align budget amounts naturally on desktop/mobile, and open short reviews at their content height.

- Preserve the approved material-first layout and Apply/Save contracts. No backend, permission, calculation or draft storage changes.
- Use label/value comparison rows with a consistent value edge in the budget summary; warning icon, label and excess amount share one row. Detail budget remains a plain disclosure rather than an elevated pill.
- Fix the opt-in shared table review skin: one owning radius/clipping boundary, transparent root outside rows, no duplicated table/body/cell corner decoration. Other tables retain default styling.
- Return RAP review to content sizing and natural initial height. For the shared aside footer, measure its inner content rather than the fixed-height outer box; fit the larger of table content and side content. Longer pages still stop at viewport bounds and scroll, while manual expansion remains available.
- Verify short one-row and longer paginated reviews in actual dev @Browser, desktop 1024/1280/1440 and mobile 320/360/390/430. Check editor/disclosure expansion, footer clearance, rounding, numbers and resize; do not click business Save.
- Run focused shared geometry/DOM tests, applicable workspace gates, scoped style generation/formatting and graph refresh. Preserve unrelated dirty files.

## Verification evidence

- Review no longer requests maximum sizing/initial expansion. Parallel sidebar extent uses the measured inner footer content and insets, without a fixed-box measurement feedback loop. Its content is observed for disclosure changes; keyboard viewport clearance excludes the parallel footer.
- Budget labels share one left edge and MoneyValue amounts one right edge. Excess amount sits beside its warning label; the aside no longer forces raised shadows onto a plain disclosure.
- The opt-in review table has no primary root gutters or nested body/cell radii. One FormSection clipping boundary owns desktop/mobile rounding; other tables retain defaults.
- Actual dev @Browser: short desktop review settles at 372px in a 978px viewport, mobile at 550px; disclosure/editor opening grows the sheet. Longer desktop/mobile pages correctly cap to viewport bounds and retain 10/5-row pagination. Checked 320/360/390/430, 1024/1280/1440 and annotation widths 716/1095 with no horizontal overflow. No business Save clicked.
- 1,951 workspace tests pass, including 18 focused geometry/table/consent tests. Type checks, lint and workspace build pass; the prior Material Master hook warning remains. Scoped formatting and generated HeroUI styles pass. The design record was updated narrowly; screenshots are in output/ai-chat-qa/rap-refinement/.

## Full amount follow-up

User requested fullDynamic amounts. RAP chat/review read values now use the shared fullDynamic variant for complete rupiah values; amount inputs keep MoneyInput. The desktop subtotal column receives more width to retain readable full amounts. Calculations and save contracts remain unchanged.
