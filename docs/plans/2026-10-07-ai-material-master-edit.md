# AI capability truth and Material Master editing

Approved milestone: make AI capability answers describe implemented tools rather than the user's entire permission set, then add editing/reactivating/deactivating an existing Material Master through chat. RAP, stock operations, batch updates and additional domain actions remain later milestones.

## Contract

- The existing capability catalogue remains the authority for tool selection, welcome suggestions and capability answers. Expose read/proposal modes and scope explicitly; explainUserAccess describes authorization, not implemented AI actions. Identify relevant manual gaps without advertising them as executable tools.
- Add read-only lookup of editable material records, including inactive materials, and a read-only proposal tool. Resolve the target and reference IDs from database lookups; ambiguous names require user selection. Proposals capture server-read before/after values and the material's version.
- Edit the metadata supported by the ordinary Material Master form: name, category, specification, brand, code, color, unit, default vendor, active status. Inventory balances/cost, locations, inventory defaults and price-library changes use their existing separate workflows. No deletion, stock movement or cash mutation is added.
- Persist proposals through the existing owned assistant tool output. Confirmation accepts only conversation/tool identity and loads the reviewed proposal from the server, with a 30-day expiry. Never accept client-supplied replacement values or versions as the authority for a write.
- Fresh server Actor must hold use:ai_chat and manage:material_settings at lookup/proposal/read/confirmation. Custom roles and existing global catalog access rules apply; project finance scope does not grant catalog rights.
- Extract transactional metadata/status writers from Settings, preserving public manual action signatures. Both manual and AI paths lock the tenant catalog and target material; normalize and check duplicate name/code against active and inactive records. Validate references and preserve ordinary status behavior.
- Confirmation compares the reviewed version with live data, rejects stale proposals, writes the update and audit in the same transaction as its existing AI confirmation receipt, and replays safely on retry/double click. Status-only changes preserve all other metadata exactly. Existing stocks, movement history and financial records remain untouched.

## Presentation and transport

- Add core Zod contracts and DTOs, fixed backend operations, typed web facades and explicit tool-output parsing/rendering.
- Compose the existing ProposalCardShell, grouped surfaces/form controls, InlineReviewStrip, shared statuses/buttons and appropriate shared sheet when needed. Show only changed fields as before/after, identify the target clearly, explain deactivation, and provide contextual pending/error/stale/saved states. Corrections through conversation produce another server snapshot/proposal.
- Preserve the approved responsive chat widths, composer/wizard, history persistence, shared motion, focus, dismissal and native mobile fallback. Verify directly in the dev app through @Browser; no business saves on the development database for QA.

## Verification

- Core normalization/proposal contract tests; permission-derived capability modes/manual gaps; tool filtering, actor scope and unsupported claims in prompts/tool responses.
- Disposable Postgres integration through ATRIA_TEST_DATABASE_URL: permissions/custom roles/Purchasing, ownership and expiry, tampered confirmation payloads, stale manual/AI edits, case/trim duplicates including inactive materials, status transitions, reference validation, idempotent replay, transaction rollback, audit, and unchanged inventory/cash/movement counts.
- UI: target/diff/status/confirmation states, narrow/mobile rows, desktop layout, keyboard and attachment/composer interactions, reload and resize without losing unrelated drafts. Viewports 320/360/390/430 and 1024/1280/1440.
- Update AI architecture and coverage matrix. Run appropriate tests, workspace quality gates, owned formatting and graph refresh. Run the Impeccable finish review on saved desktop/mobile screenshots as required by its new-work workflow.

## Acceptance

Implemented the permission-filtered read/proposal/manual capability report, editing lookup including inactive materials, stored before/after metadata/status proposals, identity-only preview/confirmation operations and shared transactional Settings/AI writers. The fixed operation registry and typed facades preserve the existing manual signatures. Existing stock, inventory defaults/cost and finance workflows are outside the edit operation.

Disposable local PostgreSQL workflow: 9 tests/45 assertions pass for explicit update and replay/double-click, custom NONE role and Purchasing, permission revocation, ownership/forged values/user-authored parts, expiry/stale manual changes, inactive lookup/status transitions, normalized inactive duplicates, manual–AI rename races, reference invalidation and rollback. Nonzero stock/reserved/cost values and cash/movement counts remain unchanged. Core schemas, the capability/prompt/read-only suite and consent DOM fixture also pass.

Live @Browser dev acceptance: the welcome capability question produced the three capability categories; material lookup found the existing test material and a brand/color proposal rendered real server before/after values with an enabled explicit Save. No business Save was clicked in dev. Reopening after page reload retained the same proposal. All seven required widths show no overflow or title clipping after shortening the local card title; desktop remains capped at 600px. The finish reviewer returned disposition: ship, no material fixes, and the documenter recorded only the shared comparison-row variant.

Workspace tests pass (1,942); workspace build and lint pass, with the existing material-import hook warning. Final API/web/mobile typechecks and changed-file formatting are checked before handoff. Proof is in output/ai-chat-qa/material-edit-desktop.png and material-edit-mobile.png. The isolated database/container is removed after verification.
