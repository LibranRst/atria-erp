# 9Router-only Gemini 3.8 Flash for the web pilot

The user selected 9Router as the sole AI gateway and Gemini 3.8 Flash as its model. The existing HTTPS gateway's authenticated model catalog returned 200 and lists `ag/gemini-3.8-flash-high`, the current configured exact model, plus medium/low/base alternatives. Retain the explicit high variant rather than relying on ambiguous aliases.

## Implementation

1. Preserve action/tRPC signatures, authorization, private storage, human confirmation, audit, timeouts and Zod validation.
2. Reuse the installed AI SDK and existing provider resolution for document extraction. Receipt OCR, bank-statement AI parsing and chat image/PDF extraction must use the same configured provider/model as chat; remove direct Gemini SDK calls from these workflows.
3. Keep direct CSV/spreadsheet parsing local. Do not send a file to AI when the deterministic parser already handles it.
   The actual gateway advertises `pdf:false` for the selected model and a native PDF probe failed to read its transactions. Render private PDF bytes locally into bounded page images before sending them through the same gateway. Use one isolated renderer process at a time, at most five pages, bounded page dimensions and aggregate image bytes, and terminate it on abort/deadline. Reject unsupported/oversized documents explicitly; never silently omit a page or fabricate rows from a missing PDF.
4. Configure the API with `AI_CHAT_PROVIDERS=NINEROUTER`, the exact Flash model and matching reasoning, an authenticated HTTPS gateway, and only the user-selected provider. No fallback to other services; keep direct unpaid Gemini blocked.
5. Test policy rejection, provider/model selection, image/PDF payloads, structured output, cancellation and sanitized errors. Probe only synthetic text/documents/tools/streams on the actual gateway; never use company data as a connectivity test.
6. Deploy through the isolated release branch after focused tests/typecheck/lint and CI. Keep keys API-only and out of source, frontend variables, logs and documentation.

## Acceptance and operational limits

- Gateway credentials and actual response/model routes must be verified. A model catalog entry does not prove inference, vision, structured output, tools or streaming.
- The `ag` route is Antigravity OAuth, distinct from the official Gemini API/Vertex route. The user's gateway/model selection does not establish upstream billing, privacy/retention or account suitability. Record these remaining real-data pilot gates honestly.
- Gateway authentication and request logging/retention must be checked where accessible. Do not change gateway account routing or logging settings without reviewing their actual configuration.
- ImageKit delivery TLS is an independent existing blocker for hosted attachment/OCR workflows.
- Finance baseline, individual users, hosted business UAT and nightly/private backup gates remain in the parent pilot plan.

## Evidence

- Authenticated gateway catalog: HTTP 200, 40 models; the exact configured `ag/gemini-3.8-flash-high` is present. No request body or company data sent.
- Actual text and streaming passed. Gateway non-stream requests require explicit `stream:false`; omitted fields returned SSE. The adapter now preserves explicit chat streaming and buffers document responses. Antigravity ignores native response schema, so extraction includes a JSON/schema instruction and retains domain Zod validation.
- After that fix, synthetic PNG extraction and a streaming tool loop passed. Native PDF did not; local page rendering is in progress. Anonymous inference returned401.
- Shared document extraction and PDF-to-image implementation completed. Safe focused suite: 37 tests passed, including six PDF process/abort/limit cases. Separate receipt tests on a fresh disposable PostgreSQL instance: six passed; that container was removed.
- Actual gateway probes with synthetic data: text 200; PNG receipt exact 12345/vendor matched; locally rendered PDF exact 12345 INFLOW and 2345 OUTFLOW matched; streaming tool executed once and consumed its result; stream sentinel completed. Anonymous inference 401. No company data sent.
- Renderer source/bundle proved on macOS and Linux ARM64 with network disabled/read-only container 512MB/1CPU; Linux AMD64 production image built; its renderer passed with network disabled, read-only rootfs, 512 MB/1CPU and nonblank 1200×1552 PNG 53,597 bytes. Limits are five complete pages, input 10MiB, dimensions 1200×2400, aggregate images 10MiB, one active subprocess and 15 s renderer deadline plus caller abort. No hard memory-SLA claim.
- The user authorized storing the existing 9Router API key in Railway and enabling only NINEROUTER. Both service-variable changes were applied. Verified implementation deployment `23c9240d-af7c-4456-bac8-240b08799d50` from `c6b24b918729a487f2384191fa730f7c1de1ee3b` is Active; [CI 37201181435](https://github.com/LibranRst/atria-erp/actions/runs/37201181435) passed quality and disposable PostgreSQL. Stored provider is NINEROUTER and the backend key matches the tested credential; no secret is recorded here. Direct Gemini remains unapproved with its paid-data flag false.
- Chat streaming provider errors are sanitized before frontend/logs. Current PDF failures are explicit; historical PDF follow-up preservation is receiving focused verification.
- Actual hosted chat/OCR business acceptance still requires the Owner's personal password, valid ImageKit delivery, Finance baseline and the parent plan's remaining gates. Upstream account privacy/billing/retention suitability remains unverified.
