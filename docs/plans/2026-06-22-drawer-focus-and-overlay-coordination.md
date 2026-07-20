# Drawer Focus and Overlay Coordination

## Goal

Stabilize keyboard focus inside every shared bottom sheet and make drawer-to-drawer transitions reliable, especially from an RAB item editor to the global client invoice form.

## Implementation

- Keep the latest `onClose` callback in a ref so controlled input renders do not restart focus management.
- Coordinate shared sheets through one stack: only the top sheet handles Escape and focus trapping, and newer sheets render above older sheets.
- Reference-count body scroll locking and avoid restoring focus into a drawer when another dialog is already active.
- Disable pointer interaction as soon as a sheet begins closing.
- Move the global client invoice form onto the shared `BottomSheet` primitive and keep its host mounted so exit animation and URL state remain synchronized.
- Audit the remaining drawer implementations for the same callback-driven focus reset and overlay collision pattern.

## Verification

- Type a multi-character value continuously in Paket RAB and Change Order fields.
- Open and close an RAB item editor, then open Add Invoice and confirm the invoice is visible and interactive.
- Check Escape, Tab/Shift+Tab focus trapping, body scroll lock, and rapid drawer transitions.
- Run ESLint, TypeScript, relevant tests, and production build.
