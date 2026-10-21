# Optional desktop approval row selection

## Scope

On `/approvals` desktop, begin with no selected row and no detail panel. Clicking a row selects it; activating it again clears selection and closes its panel. Selecting another row changes context. Preserve the existing narrow list/detail/Back flow, selection through resize, pending guards and explicit approval/receipt workflows. No decision or financial mutation is part of verification.

Reuse public DesktopTable and its native HeroUI/React Aria interaction owner. Extend its controlled single-selection contract if necessary to report an empty selection, without changing existing action/navigation consumers. The approval presenter must stop deriving a default selection from the first row. Do not add checkboxes or a bulk workflow.

## Verification

- Add a focused regression at the existing real approval presenter/shared table seam for initial empty selection, select/deselect, changing rows, keyboard activation, pending guards and responsive selection.
- Verify actual dev `/approvals`, including table expansion after deselection, desktop widths 1024/1280/1440px and retained mobile/native presentation.
- Run relevant tests, TypeScript, scoped lint/format and shared UI checks. Update DESIGN, its sidecar and the approval surface brief, then refresh Graft.

## Status

Completed. Plan was saved before executable changes.

The approval presenter now derives context only from the owner's explicit selection. Public DesktopTable adds opt-in `onRowSelectionChange(row | null)`, using native HeroUI/React Aria single toggle selection and allowing empty selection. Existing row-action/navigation consumers retain their contract. Approvals uses only the selection callback, avoiding duplicate action toggles; pending guards remain with its stable owner.

## Evidence and checks

- RED: the real ApprovalList/shared table DOM fixture failed because it initially selected one row instead of zero.
- GREEN: the approval DOM suite passed in 5.91s, covering initial empty selection/detail, pointer select/deselect, switching rows, Enter/Space activation, detail closing, narrow Back, resize preservation and pending decision guards. Existing permission, stock, self-approval, source refresh, failure and removed-row checks still pass.
- Shared desktop table/contracts/button suites: 19 tests passed with 82 assertions. The existing reconciliation DOM regression also passed, verifying compatibility with the unchanged row-action contract.
- Live `/approvals`: fresh initial selected/detail counts are zero; pointer selection opens detail, second click clears it and restores full width; Enter selects and Space clears. No approval/rejection or financial mutation was performed.
- Desktop 1024/1280/1440px select/clear flows and mobile 320/360/390/430px have no document horizontal overflow. Native `surface=mobile` retains its mobile composition. Temporary viewport overrides were reset; the canonical app is open unselected. Proof: `/tmp/atria-approvals-optional-selection/initial-final.png` and selected/unselected breakpoint captures in the same directory. Existing 320px mobile amount/priority crowding is outside this desktop interaction change.
- Web TypeScript, scoped ESLint/Prettier and scoped HeroUI styles checks passed. A bounded independent production review found no actionable defect. DESIGN, its sidecar and the approval surface brief describe explicit optional selection.
- Shared story: `ui-desktop-heroui-toolkit--toggleable-row-selection` documents initial empty selection, selection/detail and clearing through the public contract. Graft refreshed after the changes.
