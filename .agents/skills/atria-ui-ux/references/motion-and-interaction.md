# Atria Motion and Interaction Policy

Motion must communicate origin, continuity, state, or feedback. If it does not, keep the change instant.

## Allowed Motion

| Interaction      | Existing token/pattern                                        | Constraint                                                                            |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Drawer or sheet  | `transitionSpringSmooth`, existing `BottomSheet`              | Slide from its spatial origin; keep body content stable during close                  |
| Backdrop         | `transitionEaseSmooth` / `fadeVariants`                       | Fade opacity only; avoid decorative blur changes                                      |
| Centered modal   | smooth fade plus restrained scale/vertical offset             | Use existing confirmation primitive rather than new physics                           |
| Meaningful morph | `transitionSpringBouncy` or an existing shared-layout pattern | Use only when the same object changes state or geometry within one context            |
| Disclosure       | existing height/opacity pattern                               | Animate the local reveal, not surrounding sections or the page                        |
| Tap feedback     | `transitionSpringSnappy`                                      | Small active scale on an actual interactive control; disable for reduced motion       |
| Success feedback | restrained `transitionSpringBouncy`                           | One focal confirmation, never confetti or continuous celebration                      |
| Progress change  | existing progress token                                       | Animate a real value change; keep exact value visible                                 |
| Active tab pill  | `transitionSpringBouncy` in `SegmentedTabs`                   | The pill may glide; content swaps instantly without fade, slide, or remount animation |

## Forbidden Motion

- Route or page transitions
- Tab/filter content transitions
- Whole-section or list entrance/stagger sequences
- Decorative floating, pulsing, parallax, shimmer, or looping motion
- Hover/tap motion on non-interactive content
- Animating every card, metric, or ordinary row
- Ad-hoc Framer Motion spring values or CSS keyframes
- Motion that changes reading position or causes layout shift

## Seamless Overlay Rules

- Use the existing portal-backed `BottomSheet` and modal primitives.
- Use `useSheetPresenceValue` or the established presence helper when selected data must remain available through exit.
- Use the established close helper when an async close or nested overlay can otherwise race the exit animation.
- Keep focus trapping, focus restoration, body-scroll locking, Escape handling, swipe/drag behavior, and safe-area spacing intact.
- Do not stack a new local z-index above the documented overlay hierarchy.

## Reduced Motion

Treat reduced motion as a functional mode. Disable transforms and smooth auto-scroll when requested, keep state changes understandable through copy/color/shape, and never make task completion depend on an animation finishing.

## Required Motion Statement

Every UI plan and handoff must include one short motion decision, for example:

- `Motion: no page or tab-content animation; existing tab pill remains.`
- `Motion: existing BottomSheet slide/fade only, with reduced-motion fallback.`
- `Motion: local disclosure height transition; all surrounding content remains instant.`
