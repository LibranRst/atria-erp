# AI context and latency verification

The visible QA Browser on web3004/API3005 tested the unchanged NINEROUTER model `ag/gemini-3.8-flash-high` and high reasoning against the existing disposable operational dataset. No model/provider/effort change, financial cache, history deletion, permission grant or business Save was used.

## Context size

One frozen first24-message history plus the identical current operational question was serialized using the installed SDK. The captured pre-change system/tool definitions and unchanged stored history were compared with the final generation copy.

| Component                   |  Before |   Final |
| --------------------------- | ------: | ------: |
| Initial tool definitions    |     106 |      27 |
| System characters           |  55,125 |  44,749 |
| Tool definition characters  | 160,561 |  24,902 |
| Model history characters    | 103,029 |  86,313 |
| Total serialized characters | 318,715 | 155,964 |

Reduction:51.06%. These are character counts, not token counts or billing estimates. The initial tool set is task-specific; explicit or recovered discovery expands the full currently authorized registry for subsequent steps.

## Live timing and correctness

Browser Resource Timing measured full `/api/ai/chat` response completion, including server reads, model generation/tool steps and persistence. Each pair uses the same natural question; the long-history final question occurs later in the same growing real conversation rather than a cloned/injected history.

| Question                                                                | Baseline | Final sampled completion |
| ----------------------------------------------------------------------- | -------: | -----------------------: |
| Fresh chat: active ERP cap and margin                                   |  33.560s |                  20.478s |
| Long operational chat: PM, contract, Material budget, account and stock |  23.685s |                  18.473s |

The reductions are about39% and22% for these samples. Provider/network latency, model decisions and prefix reuse vary; these are observed samples, not a fixed latency promise. A9.612s earlier long trial included an unavailable-tool error and is explicitly labeled pre-repair in the artifact; it is not the final accepted speed result. An intermediate17.430s trial preceded the public PM read addition.

Final source reads are getProjectBudget (including fresh assigned PM), getBankBalances and getProjectStockContext. Verified values: PM QA Role PM_A, contract Rp20.000.000, Material allocation Rp1.800.000/actual Rp400.000/remaining Rp1.400.000, QA account Rp1.000.000 and selected warehouse physical6/reserved6/available0. Final accepted response has no output-error parts. The fresh Settings response reports actual QA cap90% and target margin10%.

The same long conversation switched to an own-profile proposal (`QA Owner Performa`), then a reference-only follow-up (“nama yang tadi”) correctly prepared `QA Owner Performa 2`. Both remain uncommitted and display the real unchanged name as Before. Returning to project facts works after the topic switch. Complete business snapshots before and after performance trials match, including original payments, reconciliation, inventory, budgets, audit and confirmation receipts.

## Implementation and safeguards

- `chat-context.ts` chooses initial NINEROUTER definitions from recognized task families, immediate reference follow-ups and canonical dependencies. Names/order come from the original permission-filtered registry. Unknown intents retain the complete authorized set; newly unclassified registered tools remain available.
- `getAvailableActions` stays present. Explicit discovery opens the full authorized set on later SDK steps. If the model requests a permitted registered tool outside the initial set, SDK repair replaces that unavailable call with read-only discovery, then exposes its actual schema for a new call. It does not execute the original request, invent parameters, repair invalid financial inputs or make absent/forbidden tools available.
- Generation removes old plain reasoning/step markers only for NINEROUTER. User messages, assistant answers, all tool pairs, confirmation enrichment and files remain intact. Reasoning with provider metadata and native/fallback provider sequences retain their original form. UI/persisted history is unchanged.
- The prompt keeps one compact capability report, project-creation denial context, current verified policy and all product/scope/approval rules. Original executors, schemas, session/tenant/project scoping, confirmations, cancellation/fallback,10-step bound and45-second deadline remain authoritative. Alternate providers keep their full authorized definitions.
- getProjectBudget now supplies the assigned PM's public project ID/name through the scoped project relation. A real Postgres test changes the PM name and verifies the next read returns it without staff-management rights; foreign projects stay denied. No email, role grants or private staff fields are added.

## Evidence and validation

`output/ai-chat-qa/performance/` contains pre/final packets and sizes, `context-comparison.json`, `browser-timings.json`, actual provider/tool observations, `verification-summary.json` and screenshots. All evidence is synthetic; credentials/headers are excluded. Provider-reported usage is retained as metadata and not treated as a billed-cost measurement.

Actual SDK child fixtures verify initial narrowing, explicit discovery, unexpected permitted-tool recovery, original-history preservation and zero execution of the redirected original proposal. Unit checks cover cross-domain reads, dependencies, reference follow-ups, unknown intents, effective-grant subsets, an Owner label with NONE scope, cent precision, confirmed historical results and native/signed metadata. Cancellation, attachment and prompt contracts pass. Five disposable read-scope cases pass with25 assertions. Workspace normal tests:2154 pass,0 fail,542 integration skips; the named scope run executes its cases separately. API/web/mobile typechecks and workspace lint pass, retaining the existing Material Master dependency warning. API/web builds and scoped formatting are recorded in the handoff. No deployment was performed.
