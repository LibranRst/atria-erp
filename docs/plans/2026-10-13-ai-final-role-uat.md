# Final AI acceptance across effective roles

## Scope

Complete the final role acceptance after factual-answer verification and tool routing repairs. Use the existing visible Browser QA app at `127.0.0.1:3004`, its actual API at `127.0.0.1:3005`, and the named disposable database `atria_audit_reconciliation` on loopback port `32774`. Preserve the development environment and existing synthetic operational records.

This acceptance does not broaden roles or grant domains. Read actual role permissions and data scopes from the database. Log in through ordinary Better Auth in the Browser; do not use actor simulation, mocked authentication, injected assistant messages or manufactured proposal proofs.

## Acceptance matrix

| Actor                      | Permitted reading                                             | Required boundary                                 | Browser interaction                                                       |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| Owner                      | This instance's projects, budget, bank balances and inventory | Company boundary; proposals never auto-save       | Mixed project, bank and stock question; ambiguous project requires choice |
| Finance Admin              | Global project and finance reads                              | Actual domain grants remain authoritative         | Mixed project/balance question and refresh                                |
| Purchasing                 | Warehouse/material facts with scope `NONE`                    | No project budget or bank-balance disclosure      | Stock question followed by a finance request                              |
| PM A                       | Projects assigned to PM A, including Role QA A                | Role QA B remains denied; no global bank balances | Own/foreign project mixed question                                        |
| PM B                       | Projects assigned to PM B, including Role QA B                | Role QA A remains denied; no global bank balances | Reciprocal own/foreign question                                           |
| Custom role named Owner QA | Chat and own profile, project scope `NONE`                    | Display name cannot grant Owner/global rights     | Request projects and bank balances                                        |
| No AI grant                | Ordinary permitted ERP pages                                  | `/ai` and chat transport denied                   | Open AI route                                                             |

Read-only backend probes use the same permission-filtered tool builders and actual fixture user identity. They supplement Browser proof; they are not a substitute for ordinary authenticated transport.

## Credential handling

The original random fixture passwords were intentionally deleted after prior role acceptance. If fresh role logins are needed, a new narrowly guarded QA operator may temporarily reset only the credential account rows for the requested existing fixture users. First save original hashes and timestamps to a mode `0600` file under `/tmp`. Store temporary passwords privately under `/tmp`, never in the repo, logs, screenshots or tool output. Do not change users, role assignments, permissions, scopes or tenant memberships. Restore the exact original hashes/timestamps and delete temporary secrets once Browser acceptance finishes. Coordinate the actor keys with the Browser owner before mutation.

## Evidence and restoration

- Take protected business snapshots before and after. Budget, bank/cash, expenses, bills/payments, physical/reserved stock, movements and confirmation receipts must remain unchanged for read-only final UAT.
- Record actual actor identities, effective scopes and grants, tool inputs/outputs, denied reads, message ownership and duplicate confirmation keys.
- Continue a mixed conversation after refresh. Reuse the preceding failure-recovery acceptance for expiry, stale source, timeout, lost connection and uncertain confirmation, with an explicit evidence link instead of re-muting unchanged cases.
- Run the named isolated scope and workflow integration suites on `atria_audit_role_clean`, not on the Browser database or development database.
- Leave the visible Browser in the ordinary Owner session, with final evidence available for manual preview.

## Status

Complete. Seven actual account contexts were verified in the visible Browser, including ambiguity, reciprocal project-scope denials, mixed permitted/denied domains, refresh and a real timeout retry. The final role matrix passes 25 checks; all 22 protected business collections and effective grants are unchanged. The seven temporary credential hashes/timestamps were restored exactly and private secret files deleted. Final evidence and limits are documented in `docs/guide/ai-final-role-uat-verification-2026-10-13.md`.
