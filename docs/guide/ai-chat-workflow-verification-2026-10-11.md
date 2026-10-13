# AI chat workflow verification — 11 October 2026

The connected dev app was tested through the Codex in-app Browser at `/ai`. Business confirmation tests used a separate disposable PostgreSQL database through `ATRIA_TEST_DATABASE_URL`; no dev business save was performed. Chat messages, the test attachment, proposal previews and draft corrections/selection are AI metadata.

| Scenario                                               | Observed result                                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One-character project discovery (`X`)                  | Real candidates returned; user choice requested before invoice preparation.                                                                                         |
| Named-project invoice at an exhausted contract ceiling | Refused with the actual invoice/contract reason; no proposal capable of over-invoicing.                                                                             |
| Correct the requested project to Brawijaya Residence   | Fresh unpaid-invoice preview containing the complete number, amount, stage and due date; explicit save button.                                                      |
| Six monthly installments, starting 31 October          | Dedicated schedule tool produced all six, totaling 100%; dates include 30 November, 28 February and 31 March.                                                       |
| Schedule review                                        | Five visible rows; next page contains Pelunasan; page survives desktop-to-mobile resize.                                                                            |
| Company cap 90% → 85%, preserving other settings       | Full inline cap/margin differences; all other categories/name/notes retained. Protected confirmation opened and cancelled. Existing projects were not recalculated. |
| Linked Draft RAB refresh                               | Real client-safe source preview for 37 linked rows; bundle pricing/client content retained; five-row review.                                                        |
| Upload a supported TXT material table                  | Three rows, original file/physical row evidence and prices 125,000/35,000/45,000 recovered; unresolved category/location prevented saving.                          |
| Correct one material with existing category/location   | One ready selected row, two still requiring review, zero saved; no new references created.                                                                          |
| Reload and reopen                                      | Corrected values and selection persisted in the same draft.                                                                                                         |

The live audit found and fixed three causes of failed or incomplete requests:

- AI identifier schemas used RFC UUID version/variant checks and rejected historical PostgreSQL identifiers. GUID shape now matches ERP identifiers; ownership/tenant/scope validation remains server-side.
- Invoice context initially required a copied ID. Named, scoped lookup now returns verified IDs and explicit ambiguous candidates; a one-character search remains discovery only.
- The combined invoice/schedule proposal tool could reduce a schedule request to its DP. Dedicated proposal tools now express the two operations separately.

A material text-table audit additionally found that prose/header lines were being treated as candidates and analytical instructions forced another provider mapping call. Recognized pipe/TSV tables now preserve actual rows and original cell values, use the existing deterministic currency mapper, understand explicit no-vendor values and skip that second generation for neutral analysis requests. Real field changes still require interpretation. A legacy checkpoint with no completed candidates is normalized once; completed checkpoints are not reinterpreted. The previously failed six-source checkpoint recovered to three completed material rows without restarting the user draft.

Artifacts: `output/ai-chat-qa/workflow-completion/`. The viewport checks cover invoice, schedule, company-default and RAB-source review at 320/360/390/430 and 1024/1280/1440 px, plus schedule-page preservation. Material screenshots cover recovered analysis, partial draft readiness and reopening. The test text file contains synthetic material names; it is intended for preview only.

Disposable integration verifies live grants/assignment/NONE, foreign ownership, permission revocation, stale/expired sources, tampered confirmation input, repeat/double-click, AI/manual schedule races, complete-subset rollback, audits and unchanged cash/stock. RAB tests additionally verify client safety, source drift, approved-baseline protection and replay. Role coverage uses actual database Actors and dynamic grants; live Browser conversations used the current Owner session.

Coverage is checked against every fixed registered operation by `action-coverage.test.ts`. Counts of registered functions are not counts of independent business features. Partial, legacy and infrastructure paths remain explicit; the AI is not advertised as covering all remaining manual actions.

Final verification: 2,065 workspace tests and 20 disposable PostgreSQL integration tests passed with zero failures; the workspace build and app type checks passed. Lint has zero errors and one preexisting Material Master effect-dependency warning. The fresh Impeccable finish review returned `ship` with no material fixes. RAB and protected-confirmation screenshots were recaptured after viewport transitions settled; final evidence has the recorded dimensions.
