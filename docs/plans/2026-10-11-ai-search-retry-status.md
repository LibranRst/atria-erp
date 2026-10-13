# Scoped project search and recovered tool activity

Approved: allow one-character project searches; show waiting-for-project-choice when the current wizard actually needs that choice; retain failed attempts as neutral recovered history only with evidence. Unresolved errors must remain clear.

- Keep database search, role/project scope and the20-row maximum; trim/bound query input and reject blank supplied queries. No automatic selection or business write.
- Derive presentation before grouping traces from owned tool parts. Same-tool read retries need the same normalized inputs and a genuine error-free result. Different tools, targets/pages, missing results, permission failures, mutations and interruptions do not prove recovery.
- The known historical one-character validation failure may recover through an explicit project-choice handoff: a later scoped listProjects result must supply the choices in the actual current project selector, preserving other filters. This proves the lookup-to-choice outcome rather than claiming the named project was found. Raw input alone is never displayed.
- Propagate the existing active input request through the stable view/turn/message owner. Only its successful requestUserInput part may show “Pilih proyek untuk melanjutkan” (or generic waiting input). Submitted/cancelled/dismissed/history requests do not remain waiting. Active generation, unresolved failures and interruption have priority.
- Recognize structured tool-error outputs as failures even when the SDK marks output-available. Show concise safe category/recovery copy, without provider messages, credentials or raw technical errors.
- Reuse FormDisclosure, AppIcon, ActivityMark and existing motion; add neutral recovered/static waiting states without new controls, tokens or looped decoration.

Verify search validation/bounds/scope, exact/different retry targets, error envelopes, access failures, historical project handoff, input completion/dismissal, active/interrupted precedence, count preservation and DOM copy. Test live dev app through @Browser at mobile320/360/390/430 and desktop1024/1280/1440 in bounded visual passes. Update docs/design rules, workspace gates and graph; preserve unrelated work.

Status: complete.

Implementation uses the existing scoped `listProjects` lookup, shared `FormDisclosure`, `AppIcon`, `ActivityMark`, and motion presets. Waiting state reads the active wizard's local values: selecting a valid project changes the summary to “Menunggu isian Anda”; completion, cancellation, or dismissal clears waiting. Read recovery remains separate from successful-source counts and never suppresses an unresolved access failure.

Validation:

- Workspace tests: 2,051 passed, zero failures. Focused activity/trace tests: 14 passed. Disposable Postgres integration: three passed, covering assigned custom roles, global lookup limits, and no-project-access roles.
- Full workspace build passed; the final web build and API/web type checks passed after local wizard-state integration. Workspace lint passed with the existing unrelated Material Master `accept` effect-dependency warning. Task-scoped formatting and `git diff --check` passed. The broader formatting baseline retains unrelated drift.
- @Browser verification on the actual dev app passed 28 checks: recovered, access-denied, unresolved lookup, and unavailable-service states at 320/360/390/430 and 1024/1280/1440 px. Evidence is under `output/ai-chat-qa/search-retry/`; the current original conversation also shows the recovered attempt and remaining-input status while preserving the user's selected project.
- The independent Impeccable finish review returned `ship`, with no material fixes. The existing activity documentation and design sidecar agree. Graph refreshed after the final documentation update.

No business data was saved during browser verification. Synthetic QA conversations contain preview metadata only; the test database is disposable and separate from development.
