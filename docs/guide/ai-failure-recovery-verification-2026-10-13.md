# AI failure recovery verification — 13 October 2026

Visible Browser acceptance used `http://127.0.0.1:3004/ai`, the ordinary synthetic Owner session, API port 3005, and the isolated `atria_audit_reconciliation` database on loopback port 32774. The live gateway/model and reasoning effort were preserved. No assistant answer, proposal proof, or confirmation receipt was inserted by the acceptance operator.

## Scenarios

| Condition                               | Browser result                                                                                                                                                                   | Evidence under `output/ai-chat-qa/failure-recovery/`                         |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Disconnected request                    | Bahasa Indonesia recovery message; reconnect + refresh retains the actual question and its identity; retry reaches the live model                                                | `offline-recovery-desktop.png`, `offline-refreshed-pending.png`              |
| Provider timeout                        | The existing 45-second deadline cancels a deliberately stalled provider request and shows an explicit timeout with retry                                                         | `timeout-recovery-desktop.png`, `timeout-320.png` through `timeout-1440.png` |
| Expired proposal                        | Temporarily aging the actual owned assistant proposal by 31 days causes explicit Save to fail. The card disables Save and requests a fresh proposal. Original timestamp restored | `expired-blocked.png`, `expiry-observation.json`, timestamp backup           |
| Source changed before confirmation      | Ordinary audited QA profile updates invalidate an actual model proposal. Save rejects the stale snapshot and the card requests a new proposal                                    | `changed-before-confirm.png`, `stale-after-refresh.png`                      |
| Refresh while answering                 | The persisted user turn and pending state survive reload. Retry uses the same identity; the live conversation can continue                                                       | `refresh-inflight-recovery.png`, `refresh-unanswered.png`                    |
| Confirmation response lost after commit | A scoped Browser interception drops the completed action response. The uncertain-result message prevents resubmission. Reload reads the actual receipt and restores Tersimpan    | `lost-confirmation-unknown.png`, `lost-confirmation-recovered.png`           |

The response interception also held the immediate status-read response before it was cleared. Reload cancelled that paused read and recovered the saved receipt. This demonstrates restoration after refresh; it does not measure automatic status recovery latency under ordinary networking.

## Repairs

- User questions carry a stable UUID. The transactional persistence seam serializes first-turn retries and verifies owner, conversation, role, and unchanged parts. JSONB object key order does not affect identity. Intentional new questions with identical text keep separate UUIDs. Conversation locks precede user locks, consistent with proposal confirmation.
- Retry loads history before the identified question instead of appending another user turn. Pending question text and private attachment references are retained in the user-bound session draft and merged with server history after reload.
- The SDK can end an aborted provider stream without an error chunk. The stream now checks cancellation after iteration and explicitly reports a deadline. Raw fetch errors and HTTP error envelopes receive usable public copy; access-denial messages remain explicit.
- Expired profile proposals have distinct copy and a Kedaluwarsa badge. Stale proposals stay blocked. Shared `Button`, `ProposalCardShell`, and `ProposalReviewFeedback` are reused; no overlay or form primitive was added.
- Live testing exposed historical proposal `after` values being treated as saved facts, and factual replies without source reads. Unconfirmed proposal snapshots now carry an explicit historical/unsaved marker. Profile, balance, and actual stock requests sequence authorized fresh readers before answering. A model answer emitted without the required reads is withheld and is not stored as an assistant success. SDK regression tests cover a compliant reader and a provider that attempts to skip the reads.
- A later name-only reply still quoted the old proposed name despite a correct current lookup. Simple own-name questions now read the actual row through the existing role/permission-checked profile use case and stream that exact fact directly, without model inference. The read is shown in the activity trace and persisted with no model-provider attribution. Compound questions and profile proposals retain the live-model workflow. This also avoids a redundant model call for this trivial factual lookup.

## Data invariants

`verification-summary.json` compares the complete before/after snapshots. All 21 protected collections match byte-for-byte: projects, budgets, categories, RAP/RAB and items, bank accounts, cash, bills/payments/expenses/costs, inventory/movements/receipts, bank statement imports/rows, and Settings.

One explicit QA profile Save created exactly one confirmation. Four ordinary profile audit rows account for the manual source change, restoration, approved profile Save, and final restoration. The Owner name/photo are restored to `QA Role OWNER` / no photo. No financial or stock transaction was created.

The final live reply reports Bank QA / Rp1,000,000, physical stock 6 sheets, reserved 6, available 0. Those values match the database. Three source reads completed. Two preceding tool attempts were rejected; they remain visible in the activity details. These are not concealed as successful reads, and the final quantities come from the successful warehouse result. Historical failed acceptance turns remain in the QA conversation as evidence.

## Verification and cleanup

- Root workspace tests, API/web/mobile typechecks, root ESLint, and workspace build passed. Targeted actual-Postgres suites passed 14 cases, including first-turn concurrency, stale/expired save rejection, ownership, rollback, and confirmation replay. The existing Material Master effect-dependency lint warning remains unrelated.
- Recovery feedback was checked at 320/360/390/430 and 1024/1280/1440 px without horizontal overflow. Retry buttons keep their label on one line and reuse the shared touch-target behavior.
- Browser networking, viewport, and interception were restored. QA API was restarted with its original preload/provider configuration; the fault preload is no longer loaded. Original localhost:3003 was untouched. The visible QA tab remains open.

Scope: this certifies the exercised synthetic name-only proposal and chat-recovery paths. It is not a claim that every provider, document upload, proposal family, or concurrent external transaction has been certified by this run. Operational finance/stock and permission acceptance evidence is recorded in the preceding reports.
