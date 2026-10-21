# RAP review surface and shadow consistency

User annotated clipped desktop summary/button shadows and a mobile material surface with different radius/depth from the budget surface.

- Browser repro measures zero horizontal shadow clearance at the nested summary scroll area and shared aside; mobile budget uses 28px `GroupedSurface` with `shadow-surface`, while the material wrapper has 16px radius and no shadow.
- Extend shared `FormSheet`/`BottomSheet` with an optional `desktopAsideSummary` slot. The shared aside owns summary scrolling, protected actions and 16px shadow gutters, preserving the existing 224px visible column, chrome alignment and natural-height measurement. Measure intrinsic summary/actions separately so expanding budget details does not force full-height sheets or hide confirmation.
- Migrate both RAP review cards to the shared summary slot. Wrap their review tables in the same public `GroupedSurface` as budget summaries, retaining embedded `FormSection` controls and the single outer clipping radius. Keep rows flat and retain one input tree across resize.
- Verify the original Browser probes before/after, short and multi-row previews, budget disclosure, focused input/editor, pagination/resize, all supported mobile/desktop widths, pending/stale confirmation guards and shared overlay tests. No business save during visual verification.

## Verification

- Actual Browser geometry reproduced clipped summary/actions at 0px side clearance. After the fix the summary has 16px clearance at its scroll boundary and controls remain 24px from the outer sheet edge. The original desktop probe passes.
- Material ownership changed from 16px/no shadow to the same 28px radius and exact computed semantic shadow as budget. Surface parity passes at 320/360/390/430/1024/1280/1440px without horizontal overflow.
- Short desktop preview stays 431px high; expanded budget grows to 704.5px. At a 600px viewport the sheet caps at 552px and the save button remains visible (bottom 529px). Intrinsic summary/action measurements prevent feedback from the constrained scroll height.
- Existing required quantity stays 3000, focused control identity survives resize, and items 11–12 retain pagination across desktop/mobile. No RAP business save was performed.
- Thirteen existing overlay, measurement, dismissal and actual proposal-confirmation tests pass, plus web typecheck, scoped ESLint, formatting and production build. Live Browser probes cover the actual CSS clipping/ownership seam; no source-string regression test was added for computed browser geometry.
- Finish review disposition: ship, no material findings. Evidence: `output/ai-chat-qa/saved-rap-changes/surface-shadow-desktop.png`, `surface-shadow-desktop-wide.png`, `surface-shadow-mobile.png`.
