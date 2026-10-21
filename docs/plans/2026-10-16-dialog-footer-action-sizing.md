# Dialog footer action sizing

## Scope

Fix the uneven two-column action row in the shared unsaved-changes dialog and audit equivalent confirmation/recovery footers. Preserve the accepted Atria capsule density, semantic tones, action order, pending/disabled semantics, form associations and the existing sole overlay owner. Keep deliberate intrinsic/adaptive action layouts intact.

The current development Stock Opname draft belongs to the user. Inspect it read-only; do not save, discard, close, navigate away from or reset that workflow. Capture its existing fields/state before source changes, and verify that the live fix preserves them.

## Acceptance

- Identify the actual width/height ownership defect before changing code. Reuse public Button, SheetFooterActions and ConfirmationDialog contracts rather than feature-local CSS or a global width override.
- Audit analogous shared and feature-owned dialog footers for the same defect. Equal columns fill their tracks, with aligned edges and height, consistent gap and readable long/pending labels. Single and adaptive actions retain their intended behavior.
- Verify desktop 1024/1280/1440 and mobile 320/360/390/430, keyboard/focus, pending guards and nested modal ownership using bounded live inspection plus representative fixtures. No finance, stock, settings or account mutation is performed.
- Run focused regressions and appropriate web TypeScript, lint, formatting and scoped styles/token checks. This props-only sizing fix does not change generated CSS or framework behavior; avoid another Next build/reload while the user's unsaved form is open. Update shared guidance only for clarified contracts; refresh Graft after changes. Preserve the running dev services and existing work.

## Verified cause and fix

At 1499px the existing footer had two 156px tracks separated by 8px, but its buttons measured about 150px and 129px. Both lacked `fullWidth`, so native HeroUI intrinsic widths left unfilled space. The save action already filled its 320px row. Add the existing opt-in to both lower shared UnsavedChangesModal actions and both paired SuccessDialog actions; shared Button defaults and CSS remain unchanged.

A bounded production-footer audit found the same issue in workspace-switch, quick-start/onboarding workspace decisions, Budget submission/approval/rejection, RAB bundle removal/approval, Settings filter actions and the flexible Material detail action. Nineteen feature buttons across eight files now fill their owning tracks. WorkspaceSwitch uses an equal two-column grid. Material detail preserves its intentional intrinsic archive action beside the flexible edit action. Standard SheetFooterActions, ProjectRecoveryModal and existing full-width OCR/expense-conflict footers already followed the contract.

## Preservation and evidence

Development Fast Refresh reloaded the shared-component tree during edits. The original document/note/eight quantities had been captured in memory before the patch. They were restored through ordinary UI inputs with the original location, then the same unsaved confirmation was reopened. An exact comparison confirmed all ten values matched. No save, discard, stock action or database mutation was performed. DOM-generated input IDs may change after development reload; the actual draft values and location are preserved.

Seven-width live geometry checks passed at 1024/1280/1440 and 320/360/390/430: paired buttons fill the row, have equal widths/heights, keep an 8px gap and show no clipping or document overflow. Desktop pairs are 156×40px; at 320px they wrap naturally to 120×52px; at 360px they are 140×52px. Original 1499×954 viewport and two-layer unsaved workflow are restored.

Existing focused regressions passed: 40 tests / 185 assertions, including shared dialogs, footer guards, button interaction, real Material owner cancel/discard/resize fixtures, RAB and Catalog flows. No implementation-mirroring test was added for Boolean layout props. Three pre-existing RAB typography literals outside the edited footers were left unchanged and no detector ignore was added.

Final validation passed: web TypeScript, workspace lint with zero warnings, global formatting, semantic tokens and scoped HeroUI style checks. The generated hook cache was normalized before the final format check. No CSS regeneration or Next build was needed for Boolean layout props; the live unsaved draft remains open. Graft was refreshed.

Evidence: `/tmp/atria-dialog-footer-sizing-2026-10-16/footer-geometry.json` and `final-dev-preview.png`. Logs: `/tmp/atria-dialog-footer-tests.log`, `/tmp/atria-dialog-footer-types.log`, `/tmp/atria-dialog-footer-lint.log` and `/tmp/atria-dialog-footer-format.log`.

Status: complete. Shared Button sizing is reused, intentional asymmetric/adaptive layouts are preserved, and the original user draft/dialog are restored without a database write.
