# Staff creation and completed chat replies — 14 October 2026

Production hotfix: `8d64cf128dd08fc7d61d239882fd3ae736682cbc`, based on the
previous deployed `442ecb94` release. Unrelated development changes were excluded.

## Staff creation

Read-only production diagnosis reproduced the exact company-membership error:
four accounts, three memberships, and an active first Owner with no membership.
`bootstrapFirstOwner` had created the credential without its tenant membership.
The new administration guard correctly rejected that Owner.

A PGlite regression reproduced the same error through bootstrap and the actual
staff-creation authority gate. The fix inserts the Owner membership in the
same transaction as its credential and bootstrap audit. Seven bootstrap cases
pass, including a real Better Auth login followed by staff creation, membership,
credential, forced password change and audit assertions. Late failures still
roll back membership; existing grants and revocations remain intact.

After the [verified backup](https://github.com/LibranRst/atria-erp/actions/runs/38542282533),
a guarded operator repair restored only the affected Owner's missing membership
with an audit. It required a single company, exactly one active original Owner,
no existing membership and matching bootstrap audit provenance. No role grants,
original credentials, schema, seed or business transaction were changed.
Project, cash transaction, project cost, stock movement and inventory fingerprints
matched immediately before and after the authorized account operations.

The user authorized a separate temporary Owner for production diagnosis and
their own acceptance. Its credentials are in an ignored local file with mode
0600, never in the Git revision or deployment. The account remains active for
user acceptance; deactivate it and its sessions when that verification ends.
The final read-only authority check allows staff creation for both Owners.
No synthetic staff accounts were added to production to test the form.

## Chat completion

The first authenticated hosted sample ended with activity and follow-up chips
but no answer bubble. Its completed answer was stored and appeared after reload.
Subsequent baseline samples did not always reproduce the miss. This was an
intermittent hosted symptom; the ordinary complete-stream DOM replay did not
reproduce it deterministically.

The finish handler now explicitly publishes the SDK's complete reply as an
immutable message snapshot. It keeps the same message/tool IDs and existing
bubbles, cards and confirmations. Failed, aborted and inactive streams are
excluded; a completion for a cleared or different conversation cannot replace
the current reply. A state regression covers a tool-only partial snapshot whose
completed message contains final text and tool output. A real SDK → AiChatView
→ ChatTurn DOM replay verifies late final text without history reload.

After publication, two hosted samples rendered their completed answers without
reload: a bank-result card plus narrative, and an ordinary text reply. Both
remained rendered without horizontal overflow at 320/360/390/430 and
1024/1280/1440 px. Browser console errors were absent. The bank narrative retained
the backend's conservative incomplete-verification notice; this hotfix does not
claim full factual coverage or alter financial calculations/verification gates.

## Release evidence

- [CI](https://github.com/LibranRst/atria-erp/actions/runs/38547407662): quality and
  disposable Postgres integration passed for the exact hotfix commit. Safe test
  summaries: core 475, API 641, web 1014; no failures. Targeted regressions: 47.
- API/web/mobile types, workspace lint, security classification, shared styles,
  tokens and API/web production builds passed. Scoped formatting passed;
  repository-wide formatting retains 83 unchanged baseline findings.
- Railway deployment: `ddede58c-4102-4662-a094-eddd0da6a495`, successful exact
  source commit; `/health` and `/ready` returned 200. All 42 configured variables
  were byte-identical before and after deployment.
- Netlify deployment: `6acf56d7707354c65b780f55`, published exact source commit,
  81-second build. Builds returned to Stopped; production origin remains
  `https://atria-dekoria-app.netlify.app`. No hosting account, billing or provider
  configuration changed.
- Screenshot: `output/production-hotfix-2026-10-14/chat-response.png`.

Application rollback uses the previous compatible `442ecb94` source and Netlify
deployment `6ace49aca9f5a26ff42ff637`; retain the repaired membership and newer
business data. Never restore a database dump as an application rollback.
