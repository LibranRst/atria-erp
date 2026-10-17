# Contextual initial AI response

Status: implemented and verified in development after user confirmation. Browser preview is open. Production was not deployed.

## Confirmed behavior

- Display one brief contextual intention derived locally from the submitted turn, with no additional model call. It is presentation, not an assistant answer or a completed read.
- Keep that introduction stable while one separate activity bubble follows genuine tool activity. Never invent phases, success, percentages, access or business mutations from elapsed time.
- As soon as useful answer text, a real result/proposal, required input or an error appears, focus on that result and retain genuine activity in the existing disclosure. Fast replies are never held for an introductory animation.
- Temporary UI is isolated by active turn/reply cycle. Stop, retry, history changes and refresh must not leave a stale intention or make recovery consider the turn answered.
- Reuse ChatTurn, ChatBubble, ToolTraceList/FormDisclosure and existing motion/accessibility owners. Preserve desktop/mobile width, scroll anchoring, approval and financial/stock guards.

## Verification

Meaningful tests cover contextual copy safety, pending-to-activity-to-result transitions, immediate text/card/error/input handoff, cancellation, retry and conversation isolation, recovery and original persisted message identity. Inspect desktop and mobile in the visible Browser using the disposable QA database, with no business confirmations. Measure actual response completion independently of the temporary UI; no production deploy or schema change.

The current API reports SDK tool activity after pre-stream route/OCR processing. The local intention covers that initial wait; a second activity bubble appears only when real activity is available. This change does not invent an early OCR progress event or alter HTTP error contracts.

## Result — 14 October 2026

Reused ChatTurn, ChatBubble and the existing ToolTraceList/FormDisclosure. The introduction is computed only for an active submitted turn, appears through the existing 180ms anti-flash threshold and never enters SDK messages. Genuine activity has one persistent disclosure; its temporary bubble becomes the normal inline detail without remounting focus/open state. Input-streaming arguments alone do not claim execution. Blocking errors and required input take precedence over generic running labels. Meaningful answer text and finished cards appear without an introductory hold.

Live Browser QA used the retained disposable Owner environment at127.0.0.1:3004/ai. Mobile390 showed the stable introduction plus one activity bubble, then actual unsubmitted expense results; no confirmation was clicked. Stop at320 cleared the introduction, retry showed it once, and refresh restored the real answer with no stale introduction. Fast Settings output used the actual90% cap/10% margin. All supported widths320/360/390/430/1024/1280/1440 have no horizontal overflow in the result; viewport override was reset.

Final focused validation:69 tests across12 files, including real DOM normal/reduced motion, focus across resize/handoff, recovery, waiting input and a complete SDK stream. Cold web typecheck and API declaration generation pass. Web lint has no errors and retains existing warnings; scoped formatting and git diff checks pass. Minimal validation compatibility fixes preserve the existing Settings detail button using the public compact size, enrich Storybook pricing fixtures with the matching material name, and preserve Bun fetch typing in the SDK-stream fixture. No backend behavior, schema or business approval flow changed.

Evidence: output/ai-chat-qa/initial-response-2026-10-14/. Screenshots capture actual pending/result states; presentation acknowledgment does not count as a completed AI response. The real expense run still took16.378 seconds for four model rounds, so this work improves immediate feedback, not a universal five/ten-second completion guarantee.
