# Grounded factual replies and final AI UAT

Status: Complete. The accepted stream, sequencing, and ordinary-role Browser UAT work is verified; temporary credentials are restored and the Owner preview session remains available.

## Objective

Complete three accepted priorities: publish saldo/budget/stock/document status from verified backend data, repair the two rejected tool attempts found in failure recovery, and run final ordinary-role UAT in the visible Browser.

## Approach

1. Recognize bounded read-only factual requests. Collect successful tool outputs executed in the current request, with actual entity/query provenance. Bind the requested account/project/material/location; never choose the first ambiguous match, mix scopes or infer missing values from conversation history. Render exact facts from those outputs, retaining clear partial/denied/missing outcomes. Preserve ordinary model explanations/actions outside this factual path.
2. Diagnose the real SDK restriction: the active tool registry also validates/executes calls. Keep authorized read dependencies and read-only support usable while fresh facts are collected. Preserve current input validation, authorization, deadlines, and unresolved errors; do not mark failed reads as success or execute a redirected proposal.
3. Use the existing synthetic QA database and ordinary credentials for Owner, Finance, Purchasing, two assigned PMs, a custom Owner label with NONE scope, and a role lacking AI access. Compare expected account/budget/stock values, ambiguous choices, mixed conversation, refresh/retry, and denied foreign scopes in Browser. Restore temporary fixture credentials exactly; keep roles/grants/business data untouched.

## Ownership

Parallel agents own factual rendering, tool sequencing, and guarded UAT scaffolding. The primary agent owns stream integration, visible Browser testing, final verification, and evidence. Existing unrelated workspace edits are preserved.

## Acceptance

- Incorrect model numbers/status never reach the factual answer or assistant history for supported factual questions.
- Each displayed fact is backed by a current successful authorized read and the requested entity.
- Ambiguous or missing facts prompt clarification, and genuine access/source failures remain clear.
- The previously rejected valid stock/catalog calls either execute safely as authorized reads or recover through available discovery, without false failure badges or extra mutations.
- Ordinary-role Browser UAT verifies both allowed and denied paths. Protected budget/cash/stock data and confirmation counts remain stable; retry does not create business transactions.
- Targeted SDK/pure/real-Postgres tests and workspace quality checks pass. Browser preview and a concise acceptance report remain available.

## Implementation and verification

The stream publishes canonical factual text from current executed read chunks and persists that same response with real tool parts and source provenance. Read failures and successes share one chronological collection path. Pure factual turns use an execution registry limited to authorized reads/support; validated original human text controls classification and binding separately from untrusted attachment extraction. Actual spending and cash paid are distinct fields in the project budget reader.

The two rejected stock/catalog attempts were caused by SDK active-tool validation. Fresh stages now retain authorized read peers and discovery while required reads are forced; failed calls never satisfy freshness. Invalid input and denied reads retain real failure traces.

Current checks: 574 API tests passed (545 integration tests skipped in the normal suite); 102 isolated role/scope/workflow integration tests passed; the updated five-case real Postgres read-scope suite was rechecked separately. Current API build/typecheck/lint and sequential web typecheck passed. The initial parallel workspace run exposed a shared UI test timing failure; its isolated rerun passed, with no UI code change. The concurrent web/admin declaration generation caused transient type errors; sequential web verification passed. The existing Material Master effect-dependency lint warning remains outside this change.

Visible Browser UAT and final credential restoration are recorded in [the acceptance report](../guide/ai-final-role-uat-verification-2026-10-13.md). Financial/history/advice/mixed mutation requests outside the bounded current-fact classifier continue using existing workflows; missing or unsupported facts remain explicit. Existing ChatMessage rendering and tool-activity presentation consume the new response without new shared UI infrastructure.

The final Browser pass found and repaired a punctuation boundary in explicit entity matching. The exact mixed Owner question now verifies all three requested domains; real Coba lagi preserves one user turn and produces one persisted assistant reply. The final current renderer suite passes 23 tests / 125 assertions. All seven responsive widths have one visible composer and no document overflow. After credential restoration, an Owner refresh retains exact cash, paid-versus-actual, and warehouse quantities with no timeout alert.
