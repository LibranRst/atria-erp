# Own profile changes through AI chat

Approved: complete name and photo add/replace/remove flow, consistent with existing compact AI proposals, with a visible Browser preview.

## Contracts

- Resolve actual session Actor and target only that user. Any data scope may change its own name/photo with use:ai_chat; no administrative permission or client user/role/email/password input is accepted.
- Read current profile and bounded owned image choices. Photo replacement accepts only a registered, owned private AI-chat image attachment, JPEG/PNG/WebP, at most8MB. Never adopt arbitrary remote URLs or another user's attachment; ambiguity requires the user's choice.
- Prepare immutable before/after proof with live user and attachment version. Explicit Save sends only the owned stored proposal identity. Expiry, stale source, revoked access, inactive account, no-op and uncertain outcome remain visible. Repeated approval has one receipt and one profile audit.
- Reuse a transaction-safe profile writer across manual, native and AI entrypoints. Preserve omitted photo; null removes it. Updating name/photo cannot change email, password, roles, sessions, grants, finance or inventory.
- On approved photo replacement, re-read the owned private image, decode/rotate/crop to the same square avatar as the manual profile form and upload a public profile copy to the configured ImageKit account. The original chat attachment remains private. Validate returned provider URL; rollback/cleanup of an uncommitted new avatar is explicit. No network upload occurs in a model tool or preview.
- Refresh profile, topbar/session presentation and proposal result after saving. Recorded history and current verified profile are distinguished if the profile changes later.

## UI

Inherited Atria Operate. One compact profile card with actual name comparisons and shared UserAvatar before/after preview, concise effect copy, adaptive quiet correction + primary Save. No mandatory review sheet or extra confirmation for this reversible own-profile edit. Photo preview uses shared MediaPreviewDialog. Corrections request a fresh immutable proposal; attaching a photo uses the existing composer upload. If a contextual detail needs a sheet, shared ownership and responsive composition apply.

Reused primitives: ProposalCardShell, ProposalInlineReview/DiffRow, UserAvatar, SheetFooterActions, Button/Link, MediaPreviewDialog and existing feedback. No new overlay, selection, motion, crop UI, money, focus or touch infrastructure.

## Verification

Pure strict schema/name/photo states; disposable Postgres integration for name-only, add/replace/remove, no-op, ownership/tenant/private source policy, stale/expiry, permission/scope, replay/concurrency, failure rollback, shared manual writer and protected-field invariants. Photo storage integration runs against a narrow test-only provider seam with real image decoding and database records, never a production flag.

Browser QA on existing visible3004 tab and named disposable DB: name Save, upload/select image, before/after preview, photo replacement/removal, errors/recovery, confirmed result and topbar/profile refresh. Test mobile320/360/390/430 and desktop1024/1280/1440, reduced motion and keyboard. Keep preview open; run workspace gates and fresh Impeccable finish/doc handoffs. Live model provider tool selection remains a separate certification unless tested here with configured credentials.

## Completion

Browser keyboard acceptance found the shared icon-button tooltip consuming Escape before the owning overlay. Ordinary Button Escape/Tab propagation passed. Let the tooltip's dismissal bubble Escape to its owner; retain independent selector/menu ownership. A real DOM regression reproduces the focused-tooltip failure before the fix and verifies propagation afterward. Verify the profile viewer's Escape/focus return; no feature-local overlay handler is introduced.

Implemented the strict core contract, bounded read-only tools, owned proposal operations, shared locked/audited manual/native/AI writer, private-source avatar processing and compact profile card. Browser name/add/replace/remove saves plus a final photo Save for pending-state evidence produced five receipts and five profile audits with protected account, permission, finance and stock fields unchanged. Real configured ImageKit was used for synthetic Browser photos; live model tool selection was not certified. Fresh finish disposition: ship, with its desktop crop finding resolved. The built rule is recorded in DESIGN.md and its sidecar. Final evidence and test results: `docs/guide/ai-own-profile-verification-2026-10-12.md`.
