# Adaptive AI proposal review

Replace mandatory review sheets for small immutable proposals with contextual confirmation directly in the chat card. Backend proof/permissions/scoping/maker-checker/idempotency/audit remain unchanged.

## Policy

- Small single-object metadata edits/status changes: visible before/after on card, one explicitly labeled save/decision button.
- Sensitive single-object changes (bank details, inventory valuation, physical stock, deletion/finalization/financial approval): visible consequences on card followed by one shared ConfirmationDialog; no intermediate review sheet.
- Multiple changed items, large patches, full template/component changes, selection/editing/import, baseline revisions and complex budget impacts: retain dedicated review sheet.
- Compute the path deterministically from validated action/row/change metadata. The model cannot choose or bypass presentation/confirmation. Keep current direct Material Master/single material and legacy finance/role controls where already appropriate.

Audit catalog, project stock, procurement/warehouse, RAP setup/lifecycle/saved changes/category packages and RAB workflow. Scope/type/context, changed values, allowed financial effects, human reason and blocking feedback must be visible before an inline action. Additional facts expand within the card. Use action-specific labels (Simpan/Aktifkan/Nonaktifkan/Ajukan/Setujui/Tolak), reserving Buka review for complex cases. Preserve saved receipts and recovery; keep stable flow across resize.

Compose existing ProposalCardShell/ProposalDiffRow, FactRow, shared disclosures, ReviewCollection/ReviewItem, MoneyValue, ConfirmationDialog and FormSheet. Reuse feature row renderers; add only a typed presentation policy/composition helper, no duplicate overlay/money/focus/motion infrastructure.

## Verification

Meaningful pure policy and DOM tests for direct vs dialog vs sheet, bank and stock sensitivity, complete changed fields, permission/stream/stale/pending gates, exact identity, double click/retry, disclosure, saved result and resize. Verify live dev app through @Browser at320/360/390/430 and1024/1280/1440; synthetic owned preview metadata only. Independent Impeccable finish/documentation, scoped formatting, workspace tests/build/lint/tokens and graph refresh. Report unrelated existing lint/formatting drift separately.

Status: complete.

Implemented the deterministic policy and shared inline composition across all eight proposal families. Direct paths retain visible changes/reasons and existing execution gates; protected paths open one confirmation from the card. Complex proposals retain their established review, five-row pagination and draft/overlay ownership. Business operations and permissions are unchanged.

Validation: all 2,029 workspace tests pass; the final focused policy/DOM run passes 15 tests. Workspace build and final web build pass. Live dev-app evidence covers 13 cases at all seven required widths (91 checks), with no overflow or route mismatch. Independent visual finish disposition is ship with no material fixes; the saved design detector is empty. Lint has zero errors and one existing Material Master effect-dependency warning. Scoped formatting passes; workspace formatting retains unrelated existing drift. Design rules, architecture and coverage documentation are aligned, and the graph is refreshed after the final documentation changes.
