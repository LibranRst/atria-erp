# AI agent transcript

Status: implemented and verified in development; replaces the transient deterministic introduction direction for this surface.

## Requested behavior

Each assistant turn reads in this order: user request, model-written introduction, genuine activity disclosure, final assistant answer, applicable action cards, follow-up suggestions. The introduction remains in the same assistant message after completion. Activity keeps one compact appearance and disclosure owner while running, complete, stopped, failed, or waiting for user input. There is no generated private reasoning in the UI.

## Evidence and approach

Use the requested REA workflow to inspect an installed Hermes/Codex JavaScript artifact passively. Record artifact identity, static evidence IDs, supported conclusions and coverage limitations in `output/ai-chat-qa/agent-transcript-2026-10-14/reference-analysis.md`. Reference behavior informs the presentation; Atria retains server-authenticated reads, approvals, permissions and proposal validation.

The current helper chooses fixed introduction templates from request patterns. Remove it from the production waiting presentation. Introductions use a persistent `data-assistant-introduction` part carrying `{ text }` within the existing assistant UIMessage, separate from answer text. Investigate generating this short public plan inside the existing first tool call arguments, so forced fresh reads and grounded answer validation remain intact without another serial model call. Emit only the model-authored public sentence; never expose provider reasoning or fabricated tool progress. Fast final answers may skip the introduction.

Before the model supplies public text, show one honest compact pending activity row, not a fabricated assistant sentence. Report measured first-public-text latency separately from completion; provider latency cannot be claimed instantaneous.

Within the previously approved adaptive-effort direction, the first call of a clear single Operasional/Lain-lain expense draft command with an explicit amount, description and literal project name may use low effort when the incumbent active registry includes `listProjects` and `proposeExpenseDraft`. This does not force another lookup or change tool choices. Later steps retain the incumbent workload profile. Batch/compound/reference-dependent requests, documents, historical reports, other action families, fresh-read enforcement and approvals keep their existing routing; measure the live effect rather than claiming an instant introduction.

## Implementation boundaries

- Backend: explicit introduction emission, bounded validation, original tool validation/execution unchanged, persistence in the same assistant message, and unchanged grounded factual-answer gates.
- Frontend: introduction projection ahead of one stable ToolTraceList; existing ChatBubble, FormDisclosure/activity, motion presets, ChatMessage card renderers and follow-up chips reused.
- Recovery: intro-only or unfinished read-only turns remain retryable; completed usable answers, cards, requests and proposals retain current recovery behavior. Stop, retry, conversation changes and refresh cannot create duplicate messages or confirmations.
- Existing global design, business mutations, finance/material calculations and production hosting remain outside this change.

## Verification

Focused stream tests must verify the data-part order, no added serial model round, tool-input stripping, original schemas/permissions, grounded text safety, failure/fallback and persisted introduction. Frontend tests verify sequence, consistent trace DOM/appearance, no duplicate intro, disclosure focus/state, partial-turn recovery and stop/retry/history/refresh. Run scoped type and lint checks. Verify live model requests through the visible local Browser preview, plus 320/360/390/430 and 1024/1280/1440 layouts, reduced-motion and long-copy behavior. Use synthetic QA requests only and do not confirm business mutations.

## Results

The visible local Browser now shows model introduction, the same tool disclosure while pending/completed, final answer, applicable card and follow-ups. Completed introductions survived refresh. Stop followed by refresh and retry preserved one user request and one completed assistant result. Ambiguous project requests still asked the human to choose and produced no expense proposal. All seven required widths kept one introduction/activity owner without document overflow. Normal/reduced-motion and actual SDK introduction-only completion recovery tests passed.

All three app typechecks and workspace lint passed (one existing unrelated Material Master hook warning). Scoped formatting passed; the full workspace formatting check still reports 86 files outside this change. Backend scoped suites cover introduction parsing/streaming, original validation/execution, persistence, fallback/cancellation, factual verification and adaptive first-step exclusions.

Measured live introduction arrival ranged from 3.442 to 7.371 seconds across the recorded emitted-introduction runs. The final cash retest completed in 3.516 seconds with one model call. A clear expense after the narrow initial-step routing completed in 16.561 seconds; its introduction arrived at 5.519 seconds. This single observation does not establish a speed improvement or qualify a universal 5–10 second completion target. Complex action completion remains a separate latency bottleneck.

The final snapshot matched all 61 protected business tables. No business confirmation or production deployment was performed. See `output/ai-chat-qa/agent-transcript-2026-10-14/verification.json`, `live-timing.json`, `responsive-widths.json` and `reference-analysis.md`.
