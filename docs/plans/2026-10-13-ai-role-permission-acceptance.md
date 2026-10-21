# AI role and permission acceptance

User authorized Browser testing of AI role/permission behavior with a visible preview. Use the named disposable `atria_audit_reconciliation` database and existing QA web/API3004/3005. Preserve development/production data, existing QA grants and earlier evidence. Fixtures may add synthetic role/users/projects and ordinary credential accounts; no assistant outputs or receipts may be injected. Login through the real Browser UI with disposable credentials kept outside evidence.

## Matrix and evidence

- Owner and Finance: global reads and permitted proposals; no execution without the human control. A regular-project preview may close the earlier live acceptance gap if actual final rights are present.
- Purchasing: material/inventory capability and finance/Settings restrictions follow actual grants.
- PM: only assigned projects; another PM's project/financial context must remain absent and inaccessible even with a known ID.
- Supporting/denied/custom roles: chat entry depends on use:ai_chat; NONE must not become assigned/global access, and a familiar role name must not confer missing grants.
- Own history/proof only: another account cannot read a conversation or confirm its proposal.
- Permission revocation after preview: current server authority blocks read/save, stale card content is handled clearly, and business state remains unchanged. Restore only the synthetic fixture's original grants after the denial check.

Test natural model prompts for allowed and denied paths, visible UI entry/history/cards, and fixed HTTP requests from the Browser for server-enforced denials where the UI hides a control. Complement with capability/scope/confirmation integration suites in named disposable databases. Snapshot business counts/hashes before and after and record role/session/tool metadata without credentials. Keep the final Browser preview open, return to a permitted synthetic identity, and report tested boundaries honestly.

## Repair boundary

Fix concrete access leaks, incorrect permission answers, or stale-confirmation behavior discovered in this matrix. Record reproduction before substantive changes and use a meaningful regression. Do not loosen domain rules, add rights to real users, bypass auth, execute real cash payments, or treat static role constants as runtime authority.

## Finding: nominal precision before Owner confirmation

The actual model correctly sent totalContractValue125000000.25 for the chosen client/PM. The stored tool proposal instead held125000000 because the shared AI money helper rounded to whole rupiah. No Save was performed. Preserve exact decimal amounts in the shared tool DTO and its human formatted text, verify whole/decimal/negative/null inputs, regenerate the real model preview and assert the approved project/budget values after human Save. This repairs a concrete value loss discovered in the allowed-role path, without changing formula/default/permission policy.

The initial QA web process also contained a malformed NEXT_PUBLIC_APP_URL with appended npm metadata. It was corrected in that process's disposable environment and restarted using a separate Next output directory. No app auth bypass or source change was needed for login/logout.

## Finding: global bank lookup crossed instance boundary

The live Finance balance card included two “Rekening asing” QA accounts. A database check confirmed their tenant IDs differ from INSTANCE_TENANT_ID. getBankBalances filtered activity but not tenant; global role scope must not mean other-company visibility. Add an actual-tool database regression proving those accounts are excluded and that denied grants still reveal no account data. Inspect the adjacent legacy project/lookup reads for the same missing parent boundary before accepting PM/global tests; keep current business balances unchanged.

## Finding: direct page offered a composer to a denied account

The no-AI role's POST correctly returned403 and wrote no conversation, but opening /ai directly still mounted the chat view, capability retries and composer. Gate the server page with the actual Actor permission and reuse the existing restricted PageState with a link to the user's own profile. Do not mount chat providers/actions for a denied page. Browser retest checks that the composer/history/new-chat controls are absent at mobile/desktop sizes and the endpoint remains denied.

## Finding: filtered reference list mistaken for company total

Finance retest excluded the foreign accounts correctly, but the model narrowed an all-account request to one returned name prefix and described that10-account subset as the company total, contradicting the full balance card. Preserve the reference lookup's search/pagination behavior, label its actual filter/returned count explicitly, and provide an authoritative accountCount alongside getBankBalances.totalAvailable. A bounded live follow-up must use the full aggregate rather than the filtered choice list.

## Completion

Eight actual identities, eleven live responses and the planned authorization/ownership/revocation paths were exercised. Two permitted human Saves committed; denied paths did not post. Defects were repaired with live and disposable database retests. [Verification report](../guide/ai-role-permission-verification-2026-10-13.md) records the matrix, precise persistence, responsive evidence and coverage limits. Source roles were seeded only in the QA database; the temporary fixture's revoked grants were restored. Canonical and custom permission assertions remain based on live grants, not names.
