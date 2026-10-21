# Notification popover dismissal

## Scope

Fix the shared desktop `ContextPopover` used by notifications. Preserve its anchored, non-modal HeroUI presentation, Atria motion, native keyboard/focus behavior, and existing mobile morph dialog.

## Reproduction and diagnosis

- Real desktop browser: clicking non-focusable page content leaves notifications open; refocusing and pressing the bell closes then reopens it.
- The DOM regression reproduces the outside-click failure for the public shared control.
- HeroUI delegates to React Aria. Non-modal popovers dismiss on focus loss but disable pointer outside dismissal. Returning focus to the trigger closes before its press toggles. Forced `isOpen` on Content also creates a second controlled state that survives during the exit animation.

## Implementation

1. Keep the HeroUI Root as the single open-state owner. Retain Content only for Framer exit painting, using React Aria's exiting contract.
2. Extend the adapter with React Aria's pointer-outside helper, excluding its trigger and respecting nested portal layers.
3. Exclude trigger refocus from native blur dismissal; preserve caller refs, Escape and focus restoration.
4. Verify controlled/uncontrolled use, inside/outside interactions, repeated trigger presses, keyboard dismissal, nested overlays and mobile.

## Validation

Run the public DOM regression before/after, notification and shared-overlay tests, scoped lint/format, web TypeScript/build, and the same browser reproduction. No database changes or notification read mutations are required.

## Result

- Extended the public shared `ContextPopover` desktop adapter; notification feature state/mobile dialog were preserved. Caller trigger refs are merged with the adapter ref. Content uses Root state and `isExiting` only for Framer presence.
- React Aria's `useInteractOutside` handles pointers. Trigger refocus is excluded from native blur dismissal, and other HeroUI popover portals retain their interactions. Declared the already-installed `react-aria@3.52.1` as a direct web dependency for this public hook.
- DOM regression: controlled/uncontrolled opening, non-focusable outside click, refocus/press toggle, inside interaction, nested select, actionable outside button, and Escape passed. Real browser additionally confirmed focus restoration and no body scroll lock.
- Browser: outside dismissal passed at 1024/1280/1440px; mobile open/Escape passed at 320/360/390/430px. Reduced-motion toggle dismissal passed. Temporary viewport/media emulation restored.
- Workspace tests passed, including 979 web tests. API/web/mobile TypeScript, workspace lint (one existing warning in `material-master-proposal-card.tsx`), web build, scoped HeroUI/token checks and scoped formatting passed.
- Repository-wide format check still reports 110 unrelated files; the files changed for this fix pass scoped formatting. No database or notification-read mutations ran.

Status: complete.
