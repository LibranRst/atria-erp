# Complete AI response latency — 14 October 2026

Status: development Browser measurements and final protected-business comparison complete. The final clean workspace test repeat is still being collected. Production deployment and its configuration are untouched.

## Measurement

The ordinary synthetic Owner session uses the visible Browser at `http://127.0.0.1:3004/ai`, API3005 and the retained disposable `atria_audit_reconciliation` database. Questions and attachments go through the normal composer, private upload, authorized chat route and persisted response. A sample counts as correct only after the visible answer or actual ready proposal is checked; a loading message, first token or queued job does not count as completion. No assistant answer, proposal or receipt is injected.

Completion is the Browser Resource Timing duration of the full `/api/ai/chat` response. It includes document extraction during that request; the separate upload that occurs before chat submission is outside this timer. Content-free server timing separately records authorization, history, attachment processing, context, first answer, assistant persistence, model calls and tool durations. Those server stages are cumulative checkpoints; they must not be added together or substituted for Browser completion. Frontend-cold baseline, first-use document extraction, cache-warm reuse and configuration transitions have distinct variant labels.

`apps/api/scripts/ai-latency-report.ts` keeps every attempt in its own case/variant denominator, including errors, timeouts and cancellations. It calculates the median, nearest-rank sample p95, correctness and correct successful completion within ten seconds. Target qualification needs at least 20 samples per group, 100% correctness and at least 95% correct successful completions within ten seconds. A percentile from fewer samples remains descriptive; neither one fast result nor a passing sample group establishes a universal external-provider guarantee. The existing 15 requests per minute limit remains unchanged.

## Current Browser results

The final `browser-report.json` contains 37 attempts, all marked successful and checked as correct against the visible answer or ready result. Earlier transitions and the slow result under test load remain in the report and are not pooled into the final variant. One additional receipt has server-only timing and is kept outside the Browser distribution.

| Case / variant                                          | Count | Median or single completion |    Sample p95 | Correct | Correct completion <=10s |
| ------------------------------------------------------- | ----: | --------------------------: | ------------: | ------: | -----------------------: |
| Settings / baseline-high, frontend cold                 |     1 |                     41.317s | Not qualified |     1/1 |                      0/1 |
| Settings / adaptive-before-shortcut                     |     1 |                     28.575s | Not qualified |     1/1 |                      0/1 |
| Settings / candidate                                    |    20 |                      0.193s |        0.679s |   20/20 |                    20/20 |
| Own-profile proposal / adaptive-before-ready-stop       |     1 |                     14.849s | Not qualified |     1/1 |                      0/1 |
| Own-profile proposal / candidate                        |     1 |                      8.938s | Not qualified |     1/1 |                      1/1 |
| Own-profile proposal / low-long-history-under-test-load |     1 |                     24.160s | Not qualified |     1/1 |                      0/1 |
| Own-profile proposal / low-new-conversation             |     1 |                      5.203s | Not qualified |     1/1 |                      1/1 |
| Own-profile proposal / low-independent-command          |     3 |                      4.453s | Not qualified |     3/3 |                      3/3 |
| Invoice read / adaptive-before-single-pass              |     1 |                     23.471s | Not qualified |     1/1 |                      0/1 |
| Daily invoice / shortcut-question-miss                  |     1 |                     23.804s | Not qualified |     1/1 |                      0/1 |
| Daily invoice / low-before-extraction-prompt            |     1 |                     11.912s | Not qualified |     1/1 |                      0/1 |
| Daily invoice / single-pass-v3-first-use                |     1 |                      6.441s | Not qualified |     1/1 |                      1/1 |
| Daily invoice / single-pass-v4-first-use                |     2 |                      5.568s | Not qualified |     2/2 |                      2/2 |
| Daily PDF / single-pass-v4-first-use                    |     1 |                      6.592s | Not qualified |     1/1 |                      1/1 |
| Daily PDF / single-pass-v4-cache-warm                   |     1 |                      0.410s | Not qualified |     1/1 |                      1/1 |

The Settings result is a fresh authorized server-policy answer, not a faster model generation claim. Its samples correctly report the active QA budget cap 90% and target margin 10%; server timing has no model calls for this narrow path. The 41.317-second baseline includes a cold development frontend, so it is not a controlled estimate of model-only improvement. Settings meets the measured sample target; the profile and document groups have insufficient samples for p95/target qualification.

The final independent profile commands completed in 4.763, 4.453 and 3.461 seconds (median 4.453 seconds). The two final new-PNG Browser completions were 5.559 and 5.578 seconds. Receipt 2 separately completed through assistant persistence in 3.706 seconds, with one model call and correct visible contents. Its Browser resource buffer had filled, so the network duration was unavailable; no prior request entry was reused. That observation remains in `receipt-2-server-timing.json` and is not presented as a Browser timing or pooled with the other two receipts. First-use PDF extraction and cache-warm reuse are also separate samples, not a single combined speed claim.

The profile results are ready, uncommitted proposals. Their Before value remains the actual stored profile. Finishing the proposal stream does not save the name or approve a business action. The first invoice is read from the real private attachment and matches 1.50 lembar ×Rp125,000.50 =Rp187,500.75, zero tax and the printed vendor, invoice/date and due date. The additional invoice/PDF results were checked against the distinct exact golden values below. OCR readability is distinct from semantic approval of an invoice.

## Implementation and safety

- Narrow company-default questions use the freshly read, permission-filtered `CompanyBudgetPolicy` after ordinary session/access/AI permission/rate-limit checks. Invalid, missing or forbidden settings remain visible failures; mixed or unsupported requests retain the normal model workflow.
- Plain single-document reads may publish complete OCR directly after private-file authorization and actual extraction completion. Ambiguous/incomplete reads, action requests and mixed questions retain the contextual assistant path. The response identifies private OCR provenance and explicitly does not represent semantic verification.
- Adaptive reasoning stays in the configured approved model family. Unknown/custom model IDs and approved-provider policy remain authoritative. Complex or mixed workflows retain stronger reasoning. The final low-effort profile/document samples passed their exact-value and permission checks.
- One narrow model-history exception applies only to an independent literal own-name edit, with a fresh verified session profile, no attachments and exactly the own-profile proposal family. It sends the current human message to the model, preserves stored/UI history and the fresh server Before value, and rejects reference words, mixed requests and unsafe names. This is a model-input optimization: the route can still preprocess older uncached attachments/PDFs before reaching the model. The retained 24.160-second long-history result under heavy test load demonstrates that long attachment-heavy conversations are not universally below ten seconds.
- Generation keeps four recent human turns and preserves all text/files, pending proposals/input requests, errors, signed provider sequences and server confirmations. Older successful read-tool parts are removed as whole call/result units. Older ordered references fall back to full tool history. Native/fallback-provider history stays unchanged.
- Compact task capability descriptors retain the original manual-workflow distinctions, project-creation denials, scope, budget policy and shared rules. Default, full, unknown and discovery-only selections retain the original complete report. `getAvailableActions` discovers other authorized actions; omitted descriptors never mean an unimplemented feature.
- Bounded immutable PDF raster/OCR artifact reuse is separate from financial data. Private-file authorization is checked on each request. OCR identity includes actor scope, source bytes, MIME, extractor version and model signature. Errors, cancellations, access decisions and finance/stock facts are not reusable financial answers.

Packet measurements, without model calls: the frozen 24-message generation history shrank 85,953→60,191 characters (29.97%); a recognized fresh Settings-family system prompt shrank 44,480→35,459 characters (20.28%). These are serialized characters, not token billing or completion speed measurements. The unchanged default system prompt was verified byte-for-byte.

## Fixtures and persistence

The evidence directory is `output/ai-chat-qa/latency-2026-10-14/`. Three additional 1000×780 PNG fixtures have distinct printed vendors, invoices, items and dates. Their `.golden.json` sidecars store exact decimal strings and integer cents. They are explicitly synthetic and not authorized for payment:

| Fixture                  | Quantity × unit price |   Subtotal |       Tax |      Total |
| ------------------------ | --------------------- | ---------: | --------: | ---------: |
| receipt-qa-latensi-2.png | 2.50 liter ×40,000.20 | 100,000.50 | 10,000.05 | 110,000.55 |
| receipt-qa-latensi-3.png | 3.25 meter ×32,000.40 | 104,001.30 |      0.00 | 104,001.30 |
| receipt-qa-latensi-4.png | 4.50 meter ×15,000.80 |  67,503.60 |  6,750.36 |  74,253.96 |

The fixtures were visually checked before use and their actual visible readings were compared with the golden files. `receipt-qa-latensi-3.pdf` embeds the exact third PNG, with one page, one image and identical embedded RGB pixels; a Poppler full-page render verifies all printed content remains visible. Its first-use and warm Browser readings preserve the same invoice/date, quantity, unit price and total.

OrbStack stopped during the task. The same retained `atria-ai-reconciliation-test` container was restarted without reset, seed or migration; its dynamic loopback port changed 32774→32768. Recovery and final AFTER read-only, repeatable-read snapshots both verified 61/61 protected table counts and hashes against the original BEFORE snapshot. Finance, budget, inventory, stock movements, procurement, users, credentials, roles/grants, settings and confirmation receipts remained identical. The final separate metadata changes are `ai_conversation`, `ai_message` and `attachment`; session/verification hashes remain unchanged. Separate chat/form/AI/file/auth metadata and their scoped audit rows are explicitly excluded from the business digest. No business confirmation was pressed during this benchmark.

Sanitized final evidence is `output/ai-chat-qa/latency-2026-10-14/business-invariant-summary.json`; recovery evidence is `output/ai-chat-qa/response-latency/recovery-business-summary.json`. Private snapshots contain counts/hashes only, no rows or credentials. `ai-latency-qa-snapshot.ts` rejects production, non-loopback/wrong-port/wrong-database targets and URL query overrides; its current exact binding is 32768.

## Validation and outstanding work

Focused checks pass for installed SDK message conversion/call-result pairing, historical/reference preservation, capability compaction, factual verification, cancellation/attachment boundaries, latency-report statistics, and the named snapshot guard. Final API/web/mobile typechecks, workspace lint and the API build pass. Lint retains one pre-existing Material Master `accept` dependency warning and no warning in the owned latency files.

The final full `bun run test` exits 1 solely because the unchanged `desktop-modal-select-dom.test.ts` reaches its 60-second timeout in the full suite. Its isolated retry passes unchanged in 34.41 seconds; no deadline or assertion was weakened. Every other app suite passes. The root command short-circuited before its development-script target, which was then run separately and passed 15/15. Across the distinct tests, 2,457 pass and 560 database-integration cases are expected skips; there are no unresolved assertion failures, but the full-command timeout remains a limitation. Per-package outcomes and the exact retry are recorded in `output/ai-chat-qa/latency-2026-10-14/workspace-test-results.json`.

Presentation reuses the existing `ChatMessage` renderer and typed own-profile proposal card. No shared UI primitive or frontend styling was added. The v3 OCR trial retained an irrelevant technical comment; the v4 extraction prompt requests only printed content. The final fresh PNG/PDF checks contain the expected printed fields and OCR provenance without that comment or escaped filename punctuation.

The repository-wide format check reports 87 files: 83 have byte-identical source hashes to the frozen deployed release, while four generated/cache files have no comparable release baseline. Owned latency changes pass scoped formatting. These baseline findings are recorded rather than silently reformatted as part of the performance work.

Regenerate the statistical report without any HTTP or model calls:

```sh
bun --no-env-file apps/api/scripts/ai-latency-report.ts \
  output/ai-chat-qa/latency-2026-10-14/browser-samples.json \
  output/ai-chat-qa/latency-2026-10-14/browser-report.json
```

Remaining confidence work: at least 20 independent final-profile and first-use document samples per case/variant for a qualified distribution, broader mixed/large-document workflows, and a separate hosted-production latency acceptance. The measured fast cases do not establish a five- or ten-second ceiling for every assistant operation or uncached long-history document. Production was not deployed or reconfigured by this development task.
