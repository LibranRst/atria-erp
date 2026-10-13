# Live model conversation acceptance

The visible Browser at `http://127.0.0.1:3004/ai` exercised natural messages through the configured NINEROUTER gateway, model alias `ag/gemini-3.8-flash-high`, high reasoning. Seventeen persisted assistant responses across three conversations have NINEROUTER metadata and positive input/output usage. No assistant parts, proposals or receipts were injected.

The disposable database was `atria_audit_reconciliation` on loopback port32774. The existing synthetic QA actor and actual custom grants were used. Fixture preparation added labeled material/location/client/manager references only. Development/production business data and the original localhost3003 server were untouched. Browser tab2 remains visible for inspection.

## Results

| Scenario              | Observed result                                                                                                                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company policy        | Actual active Settings reported cap90%, target margin10%, and the synthetic five10% category shares. No inferred15% policy.                                                                                                                                                                                             |
| Ambiguous stock       | Two warehouses/materials and the missing reason were clarified before a proposal. No first-match write.                                                                                                                                                                                                                 |
| Single correction     | Panel Live QA A20→17.5, reserved5 unchanged. Textual approval performed no write; the card action and confirmation created one movement/audit/receipt.                                                                                                                                                                  |
| Batch correction      | Fresh lookup; A17.5→16.25 and B20→24. Desktop review and390px mobile sheet were exercised; one human confirmation committed both rows atomically.                                                                                                                                                                       |
| Excess reduction      | 100 units remained blocked. After repair, the fresh bound was12.5, then11.25 after the batch save. Repeating the original request after that second save used16.25 current stock instead of historical20.                                                                                                               |
| Own profile           | Name proposal saved, then the actual follow-up chip produced a restoration proposal. Two human Saves succeeded. Name/image/email/role/activity/password-change flag match the original after restoration.                                                                                                               |
| Completed Quick Start | Stored completion was read; reset/recreation was not offered. Retest displayed “Selesai” without the machine step code.                                                                                                                                                                                                 |
| Ordinary project      | Pre-fix wizard collected name/value/client in order and preserved100000000.25 exactly. The actor lacks create:budget, so the regular proposal is correctly absent. Repaired response identifies that right and refuses another dead-end wizard. No project was created: this certifies denial, not successful creation. |
| History/reload        | Saved cards remained “Tercatat”; batch review showed saved results with no Save action. Switching history and reloading did not change the domain snapshot.                                                                                                                                                             |

Final persistence: three stock movements, three stock audits and four owned confirmations (single, batch, profile change, profile restoration). Stock ends A16.25/B24, reserved5 each, average cost10000 and last price12000 unchanged. Hashes of all cash transactions, bank accounts, expenses and Settings, and separately all pre-existing project/category budgets, match the starting snapshot. No ordinary project was created.

## Repairs

1. A correctly blocked reduction quoted stale20/15 after a real saved correction. StockCorrectionError now carries authorized current/reserved/available/max-decrease facts; unknown errors remain generic and revoked inventory rights expose no stock context. Fresh lookup instructions accompany each new stock proposal. A real Postgres regression saves first, then calls the failing tool.
2. Completed setup exposed the internal success step ID. Completed context omits that step and marks progress eligibility false; the live retest uses the human status.
3. A regular-project wizard opened despite missing final proposal rights; the model mistook the filtered tool for an unimplemented feature. Explicit or inferred CREATE_PROJECT input requests now use the same final capability descriptor. The capability report supplies an implemented-but-denied explanation. Live follow-up and direct denial tests pass without adding grants.

Proposal instructions also name actual CTA labels and avoid guessed card positions. These are instructions to a probabilistic model, not a guarantee of identical brevity. Historical pre-fix responses remain unchanged as repro evidence.

## Evidence

Directory: `output/ai-chat-qa/live-conversations/`. `live-observation.json` records prompts, selected tool inputs/outputs, provider usage and receipts. `invariant-summary.json` and `final-domain-snapshot.json` record persistence. All identities/data are synthetic; credentials and sessions are excluded.

Repaired captures: `fresh-stock-limit-fixed.png`, `same-scenario-after-second-save.png`, `batch-stock-saved-desktop.png`, `saved-history-reload-desktop.png`, `profile-name-restored.png`, `completed-quick-start-label-fixed.png`, `project-access-label-fixed.png`, `project-wizard-access-blocked.png`. The mobile review/save is in `batch-review-mobile.png` and `batch-stock-saved-mobile.png`. Earlier `excess-stock-blocked.png` and `completed-quick-start-guard.png` preserve the pre-fix faults.

Summed provider-reported usage:1937952 input and28321 output tokens over17 responses. This is metadata, not a billed-cost estimate. Context size deserves a separate bounded cost/latency audit; this run changes no routing, models or token budgets.

## Validation and limits

Capability/input tests:28 pass,194 assertions. Disposable stock integration:16 pass,105 assertions. Disposable Quick Start integration:16 pass,65 assertions. Workspace tests, API/web/mobile typechecks, lint and full workspace build passed. Lint retains the existing Material Master accept dependency warning. Scoped formatting passes; repository-wide formatting has unrelated baseline failures.

Existing ProposalCardShell/ProposalInlineReview, FormSheet, ReviewCollection/ReviewItem, FormDisclosure, FactRow/MoneyValue, SheetFooterActions and ConfirmationDialog were exercised without new primitives or layout changes. This acceptance covers sampled stock/profile writes, policy lookup, completed setup and project denial with one configured model and one actual role. It does not certify every registered action/provider/role, ordinary project creation, cash transfers or privileged administration. “Supported” in the action inventory means implemented, not live-certified.
