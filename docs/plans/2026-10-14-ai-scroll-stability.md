# AI transcript scroll stability

Status: implemented and verified in development.

## Regression

Draft-to-server conversation ID promotion triggers the same bottom jump as history navigation. The modified hook makes that jump select persistent bottom following; its idle ResizeObserver and incidental scroll events can keep pulling the reader below the newest question. The previous transcript contract capped automatic following at the newest user question's top reading inset.

## Fix

- Separate opened conversation identity from streamed persistence identity so server-ID assignment never counts as navigation.
- Reuse `useChatScroll`; distinguish a bounded initial/history `openAtBottom` alignment from the explicit `jumpToBottom` reader action.
- New submissions resume question-capped following. Move for content growth only during a response; idle observation only updates latest-answer control visibility, with no idle growth snapping.
- Programmatic/resize scroll events never promote question following into bottom following. Upward wheel/touch/keyboard input cancels queued following and keeps the reader paused. A deliberate downward return to the bottom or the newest-answer button may resume bottom following.
- Retain the shared viewport, anchors, footer clearance, touch/keyboard support, reduced-motion presentation and stable route/overlay owners.

## Verification

Test real hook DOM interactions and SDK conversation-ID promotion, long response growth, final card insertion, pending/corrected text resizing, idle disclosure growth, manual upward cancellation before RAF, explicit newest-answer action and history navigation. Verify live local Browser desktop/mobile without business confirmations, plus scoped type/lint checks. No finance/material/backend behavior changes.

## Results

20 focused tests passed, including actual SDK conversation-ID promotion and long response/card insertion at mobile and desktop geometry. The real hook tests cover wheel/touch/keyboard pauses, bounded initial alignment, early pointer cancellation, deliberate return to bottom, explicit newest-answer action, idle affordance updates, resize and cleanup. Web typecheck, scoped ESLint and formatting passed.

Live local Browser evidence: a new desktop response kept scrollTop 0 while scrollHeight grew to 2915px; an idle activity expansion kept scrollTop 0. After manual upward scrolling during a follow-up, scrollTop remained exactly 979.5px through completion while content grew from 3069px to 3707px. The explicit newest-answer button reached the bottom. A new mobile response likewise kept scrollTop 0 while content grew to 3074px. No business action was confirmed. See `output/ai-chat-qa/scroll-stability-2026-10-14/`.
