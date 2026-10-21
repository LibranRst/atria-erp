# Final AI role acceptance — 13 October 2026

Final acceptance passed across seven actual account contexts in the visible Browser. The final Owner answer verifies the requested account, Material budget and warehouse stock from fresh backend reads. Finance verifies RAP/RAB status and resolves an ambiguous project only after human choice. Domain and project-scope denials stay explicit. Thirteen user turns produce thirteen persisted assistant messages and **zero new confirmation receipts**.

All **22 protected business collections are unchanged** from `grounding-baseline.json` to `grounding-final.json`: cash rows remain 50, stock movements 20 and confirmation receipts 66. Budget amounts, balances, inventory quantities, payment/expense records and audit records are identical. Effective roles and grants are also unchanged.

## Actual Browser coverage

| Account                    | Final outcome                                                                                                                                                       | Evidence in `output/ai-chat-qa/final-uat/`                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Owner                      | Exact requested account only; Material category only; one stock summary; cash, budget and stock provenance verified                                                 | `owner-final-factual-audit.json`, `owner-final-desktop.png`, `owner-final-mobile.png` |
| Finance Admin              | Three ambiguous Role QA projects require a choice. Explicit A selection preserves contract/budget cents. Fresh RAP is Terkunci with tahap Selesai; RAB is Disetujui | `finance-ambiguity-audit.json`, `finance-resolved-audit.json`                         |
| Purchasing                 | Warehouse facts remain available with project scope None. Bank access is denied without a bank lookup or disclosure                                                 | `purchasing-audit.json`                                                               |
| PM A                       | Own A budget reads correctly. Explicit foreign B ID returns only the generic scope denial. A later successful A read does not mark the unrelated B denial recovered | `pm-a-resolved-audit.json`                                                            |
| PM B                       | Own B contract/cap/category cents are exact. Explicit foreign A ID returns only the generic scope denial                                                            | `pm-b-audit.json`                                                                     |
| Custom role named Owner QA | Actual scope None and three grants remain authoritative. Neither bank nor project budget is read; both denials are clear                                            | `custom-none-audit.json`                                                              |
| No AI grant                | Ordinary ERP project access remains. Direct `/ai` shows “Asisten AI belum tersedia untuk akun ini” with no composer/new-chat controls and creates no conversation   | `no-ai-audit.json`, `no-ai-route-denied.png`                                          |

The final Owner values match the source: account balance Rp 1.000.000; Material allocation Rp 1.800.000, actual Rp 400.000, paid Rp 1.000.000 and remaining Rp 1.400.000; Panel Operasional QA physical 6, reserved 6 and available 0. Role QA A preserves contract Rp 111.000.000,25 and cap Rp 99.900.000,23. Role QA B preserves contract Rp 222.000.000,50 and cap Rp 199.800.000,45.

## Findings repaired and recovery verified

Initial live cases found repeated stock summaries, incidental account/category name matches, and an unsupported RAP status source shape. The repaired final readings remove duplicate stock and false account matches, retain all categories when no category is requested, and verify RAP/RAB status from their actual sources. Initial and repaired observations remain available in separate audit artifacts.

Owner refresh retains the persisted conversation. The final fresh Owner attempt initially timed out (`owner-final-timeout.png`). A punctuation/entity-clause regression was reproduced before repair. The visible Coba lagi action then reuses the same question and user message ID, producing one successful live assistant message with three fresh source proofs; no extra user turn or receipt appears. The interval between original submission and the repaired retry is not a model-latency measurement.

The preceding [failure-recovery acceptance](./ai-failure-recovery-verification-2026-10-13.md) separately covers connection loss, timeout, expired/stale proposals and uncertain confirmation. These faults were not repeated for every role. The no-AI case proves the route gate and absence of a persisted provider message, not a measurement of upstream provider network traffic.

## Isolation, checks and cleanup

The Browser uses `127.0.0.1:3004`, API `127.0.0.1:3005` and disposable `atria_audit_reconciliation` on loopback port `32774`. All account logins use ordinary Better Auth; session records have no simulated actor. The original development environment is outside this acceptance.

Read-only backend probes pass **25/25** role/scope checks. Seven named integration suites pass **77 tests / 382 assertions** on the separate `atria_audit_role_clean` database; the capability catalog additionally passes **25 tests / 175 assertions**. The final read-scope suite is separately rerun after the runtime repairs. Backend probes supplement the authenticated Browser proof.

The responsive checks cover 320, 360, 390, 430, 1024, 1280 and 1440 px: no horizontal overflow and exactly one visible composer at every width (`responsive-layout.json`).

Temporary credentials changed only the existing synthetic credential rows. All seven original hashes and timestamps were restored exactly on 13 October 2026 at 16:13:35 WIB (09:13:35 UTC); private password and backup files were deleted. Credential restoration did not alter roles, grants, user flags or tenant memberships, and did not manipulate sessions. Ordinary sign-in/sign-out created and revoked sessions normally. The Owner session remains for preview; a refresh after restoration confirms the same persisted facts (`owner-restored-session.json`).

Final evidence: `browser-observations.json`, `backend-role-matrix.json`, `protected-business-comparison.json`, `protected-role-comparison.json`, `credential-restoration.json` and `final-acceptance-summary.json`. Integration log: `/tmp/atria-ai-final-uat-integration.log`.
