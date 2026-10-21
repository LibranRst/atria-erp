# Finish AI v1 factual coverage

Status: Complete for the exercised AI v1 scope. See [final verification](../guide/ai-factual-finish-verification-2026-10-13.md). User authorized completing the remaining AI refinements before release preparation; no production deployment is included.

## Outcome

Complete verified expense-status replies and bounded historical/period comparisons, then exercise the configured live model through the visible local QA Browser. Preserve existing action/confirmation flows and all finance, stock, permissions and private attachment boundaries.

## Implementation

1. Extend authorized read-only expense lookup with stable IDs, exact amounts, current statuses, requested entity/date/status filters, explicit pagination and ambiguity. Ground status replies in executed current reads; a recent page is never a full-project total or permission to choose the first match.
2. Introduce a bounded read-only historical financial report using actual ledger/expense records and existing cash-flow/money rules. Resolve supported human period phrases server-side in Asia/Jakarta, calculate exact cents and full scoped period aggregates, and label date basis, partial periods, excluded transfers/opening/adjustments and zero comparison denominators. Recorded expense amounts, consumed Material budget and paid cash remain distinct. Do not infer past budget allocations, balances, stock snapshots or approval state from present data; unsupported history/forecasts remain explicit.
3. Publish and persist verified historical/status facts from current tool observations with entity/period provenance. The original validated user question controls classification; model prose, attachment instructions and previous tool outputs cannot supply amounts or dates. Keep the actual execution registry read-only for factual turns and preserve real errors, ambiguity and role/project scope.
4. Run meaningful pure, SDK and disposable-Postgres tests, including current database-derived Owner/Finance/assigned-PM/denied-role read probes. Exercise the new replies with the live Owner Browser session, refresh and retry; retain the prior ordinary seven-role Browser acceptance as separate evidence. Use existing ChatMessage/tool activity/result primitives, not new overlay/form infrastructure. No business mutations in Browser; source records/receipts remain unchanged.

## Ownership

Parallel agents own expense read/status adaptation, historical report/domain logic, and read-only QA fixtures/expected facts. Root owns grounded stream integration, capability/context registration, scoped code review, visible Browser UAT, final quality gates and documentation.

## Acceptance

- Named or explicitly chosen expense statuses are correct; duplicate descriptions and short/paginated results require a choice or retain bounded scope.
- Historical comparisons state exact periods/date basis and full scoped counts/totals; pagination, transfer double-counting, zero denominator, month boundaries and timezone edges are tested.
- Wrong model numbers/time ranges, stale history, denied reads and mismatched entities never become verified factual replies.
- Existing current cash/budget/stock/RAP/RAB, proposal approvals, cancellation, provider error privacy and ordered retry remain green.
- Actual live replies match DB evidence and survive refresh without new business transactions or duplicate user turns.
