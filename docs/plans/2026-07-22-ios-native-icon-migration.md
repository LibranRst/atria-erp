# iOS-Native Icon Migration

## Objective

Replace every user-facing Material Symbols glyph with a typed React icon from Phosphor Icons. Preserve each control's business behavior, accessible name, visual hierarchy, and established motion.

## Inventory

- Baseline audit: 240 Material Symbols references across active `app`, `components`, `features`, and `lib` UI source.
- Icon roles include navigation, tab bars, section and row chevrons, finance/material/project domain cues, status indicators, sheet controls, uploads, and empty states.

## Delivery Order

1. Add a canonical typed `AppIcon` mapping from legacy semantic names to Phosphor icons, including accessible decorative behavior and class passthrough.
2. Migrate shared shell, shared UI primitives, then each active domain. Keep dynamic icon selection typed at the presentation boundary rather than rendering raw icon names.
3. Remove the Material Symbols font import/configuration once no active UI references remain.
4. Update the control-language documentation and UI skill with the Lucide-only policy; add a policy test preventing reintroduction.
5. Verify source scan, component tests, TypeScript, ESLint, production build, and representative 320–430px routes.

## Visual Contract

- Use Phosphor's rounded geometry with `regular` as the default operational weight and `fill` for active navigation only.
- Match the existing visual size, color token, container, and hierarchy; do not make every icon the same size or add decorative icon motion.
- Icons inside labeled controls are decorative (`aria-hidden`); icon-only controls retain explicit accessible labels.
- Keep chevrons optically tight. Use the shared cropped chevron where space is constrained.

## Exceptions

- Product logos, uploaded media, and non-UI technical strings are out of scope.
- Navigation, tabs, option choices, and rows retain their specialized control semantics; only their icon renderer changes.

## Motion

No new icon animation. Existing Framer Motion tap feedback, sheet/backdrop transitions, and reduced-motion behavior remain unchanged.
