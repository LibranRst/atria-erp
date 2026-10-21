# AI chat: grounded budget policy and question-anchored scrolling

Approved after inspecting the annotated dev app: automatic following stops when the latest user message reaches the top reading inset. Upward reading gestures pause following. Opening history and the explicit latest-answer button may go to the actual bottom. Preserve composer, disclosure, resize and reduced-motion behavior.

Register real Stop and stopped-state icons in the shared AppIcon map. Reuse IconButton and the existing icon library; retain compact geometry and keyboard labels.

Remove the AI budget proposal's fixed 85% cap and fixed category shares. Extract the current read-only Settings/default resolver into a backend budget module while preserving the manual public signature and fallback behavior. AI reads the same active configuration, distinguishes configured policy from fallback/unavailable state, and uses an explicitly supplied cap only as a reviewed override. No business writes occur in model tools.

Add a permission-gated company-budget read tool, typed policy DTO, source identity/link and fresh server-side policy context for authorized chat requests. Policy questions cite active Settings, separate company defaults from individual project targets, and never invent industry profiles (15/20/10). General questions use “perusahaan ini”; named identity comes from the active tenant. Old assistant claims are not policy evidence. Clarification instructions must describe the current transcript/sheet UI.

Verify bounded scroll geometry, manual pause and explicit bottom intent; registered Stop SVG; non-85% configuration, disabled categories, missing Settings, denied permissions and runtime policy context. Compare real Settings with a live AI reply in the dev app through @Browser, plus mobile/desktop scroll/Stop verification. Never change company settings, create financial data, reset development DB or save proposals for testing. Complete appropriate workspace gates, document coverage and refresh graft.

## Verification

The dev Settings screen shows a 90% internal cap and 10% target margin. A real read-only AI follow-up now returns 10%/90%, names the active Budget Settings preset, uses the configured category shares (35%, 18%, 1%, 0.5%, 0%) and avoids the old fixed-company/industry profiles. No settings were edited or proposals confirmed.

Explicitly labelled, locally intercepted UI streams verified Stop's real SVG and long-answer limits without persisting fixture messages. At 320/360/390/430px the question top is 79.75–80px against an 80px inset; at 1024/1280/1440px it is 79.75–80px against viewport top 64px plus 16px inset. Remaining answer content stays below the viewport. Manual reading stayed at 1277.5px while the composer grew; the explicit latest-answer action reached zero bottom distance. Interception was cleared, viewport overrides reset and chat reloaded to real history. Evidence is in `output/ai-chat-qa/budget-policy-live.jpg`, `budget-settings-source.jpg`, `stop-icon-live.jpg`, `question-scroll-cap.jpg` and `question-scroll-viewports.json`.

Quality gates: 1,899 workspace tests pass; final policy-executor tests also pass after checking the installed AI SDK 7 execution-context contract. API/web/mobile typechecks and all workspace builds pass. Lint has no errors and retains the existing material-proposal dependency warning. The UI detector and owned-file formatting check pass. The broad format check reports 115 pre-existing issues outside this change; no unrelated files were reformatted to mask it. No disposable database integration run was needed for these read-only policy and presentation changes.
