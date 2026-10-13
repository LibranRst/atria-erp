# Smooth sheet scroll edges

Local web refinement: reuse the page topbar/bottom bar's eight-stop
`scroll-edge-scrim` ramp in the shared `BottomSheet` behind FormSheet,
OperationalFormSheet, WorkflowFormSheet and DetailSheet.

Keep the sheet's own canvas token. Fade from the pull-bar band through the
header/body inset, and mirror the ramp behind footer controls rather than
rendering a solid footer panel. Use the existing raised shadow token for sheet
buttons, including desktop adapters, to make their floating depth visible.
Scrims remain decorative
and ignore pointers. Header/footer measurement, body spacers, focus, keyboard
avoidance, dismissal and resize ownership retain their existing contracts.

Verify a long shared-sheet fixture at mobile 320/360/390/430 and desktop
1024/1280/1440, including scroll start/end and focused controls. Run existing
overlay regression checks, web typecheck and scoped lint. No deployment,
database operation, new visual primitive or business-action change.

Verified in isolated Storybook: all seven viewport widths render without
horizontal overflow; desktop controls receive the raised shadow; the last field
ends above the footer fade; focusing an earlier input brings it below the header.
The existing overlay suite passes (10 tests), as do web typecheck, scoped lint
and formatting. This is browser fixture evidence, not a physical iPhone check.
