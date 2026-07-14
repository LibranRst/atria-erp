# Dynamic Bottom Sheet Snap

## Intent
- Upgrade all bottom sheets/drawers with mobile-native snap behavior.
- Preserve existing `BottomSheet` call sites, business logic, forms, Server Actions, schemas, and RBAC.
- Keep the visual language compact, calm, and operational.

## Rules
- Initial sheet height is derived from actual content height and capped below full viewport.
- Long forms should open taller by default; short pickers/details should stay compact.
- Users can drag the handle upward to expand near full height and drag downward to return to the measured initial height.
- Dragging down from the initial height should not accidentally close the sheet; close remains explicit via backdrop or close button.
- Use project motion tokens and the existing rounded iOS sheet style.
