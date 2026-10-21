# AI operational live acceptance

Run one visible Browser scenario on the existing disposable `atria_audit_reconciliation` database (loopback32774), web3004/API3005, using the configured live model and actual Owner QA account. Do not seed assistant messages, proposals, confirmations, or completed workflow outcomes.

## Scenario

1. Prepare labeled reference-only QA client/vendor/material/location and one isolated funded QA account. Snapshot domain records before chat execution.
2. Create a new project with Settings-derived budget through chat and explicit UI Save.
3. Create its Material RAP, explicitly declare unused Tukang/Subcon scopes, finalize, generate client-safe RAB and approve the required project budget/readiness steps through UI decisions.
4. Create/submit a linked Material vendor bill, receive its ten panels, reserve and use four panels, then explicitly record vendor payment.
5. Import the synthetic payment bank statement through chat and match it to the one actual cash record.
6. Repeat captured confirmation requests using the same ordinary authenticated Browser transport; reopen/reload saved cards. Compare domain snapshots to prove no duplicate business rows or cash/stock impact.

## Expected checks

Planned purchase:10 panels at Rp100.000 each, total Rp1.000.000. Physical stock starts0, receipt makes10, reserve makes reserved10, usage4 leaves physical6/reserved6/available0. Material realization follows canonical usage accounting; receipt and settlement must not create another usage expense. Funded QA account starts Rp2.000.000, payment leaves Rp1.000.000. Reconciliation changes matching state only. Project/category allocations follow the reviewed actual Settings/RAB values. Verify exact stored values, source links, audit records and owned idempotent receipts at each stage; resolve any discrepancy instead of declaring it expected.

Exercise representative review/confirmation UI on desktop and mobile with existing shared primitives. Save screenshots, live provider/tool observations and a final invariant report under `output/ai-chat-qa/operational/`. Record any repaired defect and rerun affected meaningful tests. Preserve existing QA histories and unrelated domain rows; never reset development/production data. Mark the visible Browser tab as a deliverable.

## Live defect: tool object unions

The live RAP finalization response describes seeing only the first object-union branch (`READY_PACKAGES`), omits required scope/stage fields, and produces three rejected calls. Add a NINEROUTER-only model-facing schema adapter which exposes every object-union field and discriminator on one object. Keep original SDK/Zod validation as the execution authority, including branch-required fields, strict extra-key rejection and refinements. Exercise nested RAP steps and root vendor/warehouse requests in a deterministic regression before repeating the same natural request live. Other providers retain original schemas.

## Outcome

Completed the business scenario,15 explicit human-confirmed actions, with26 verified invariants and retry snapshot equality. Repaired tool object-union hints, fractional default selling-price context, and duplicate balance-result row keys. Attachment upload remains unverified because private storage is not configured on this QA API; reviewed pasted CSV was used for import and matching. See `docs/guide/ai-operational-live-verification-2026-10-13.md` for evidence and exact limits.
