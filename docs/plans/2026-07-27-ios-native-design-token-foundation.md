# iOS-Native Design Token Foundation

## Goal

Make Atria's neutral palette, surface depth, and interaction rings feel consistently iOS-native
without changing information hierarchy, layout, finance behavior, or the monochrome black primary
action language.

## Scope

- Replace the warm neutral palette in `app/globals.css` with the iOS light system-gray family.
- Preserve black primary commits, iOS-blue selection/focus, and existing semantic status colors.
- Introduce semantic shadow tokens for surface, raised, floating, overlay, sheet, control, and
  inverse/identity roles.
- Introduce semantic neutral and focus ring tokens, then migrate repeated inline shadow and focus
  recipes to those roles.
- Add a source-level token contract test so warm neutral values, arbitrary UI shadows, and
  non-semantic focus-ring colors do not return.
- Update the active UI docs and `atria-ui-ux` skill so future UI work starts from tokens rather
  than local color, ring, or shadow recipes.

## UI Contract

- Hierarchy: unchanged. Focal, grouped, decision, identity, inline, state, and inset metric
  ownership remain as documented.
- Surfaces: the application canvas uses a bright cool gray, segmented/inset tracks use iOS System
  Gray 6, owning content surfaces remain white, and nested/higher neutral levels use only cool iOS
  gray-family values.
- Rings: an almost imperceptible neutral ring supports the shadow around white surfaces; control
  rings describe interactive chrome; the keyboard/input focus ring is consistently iOS blue.
  Status color is not used as a substitute for focus visibility.
- Shadows: inset metrics and ordinary rows remain flat. Owning surfaces use `surface`; interactive
  or focal owners use `raised`; navigation/menu chrome uses `floating`; sheets and modals use their
  dedicated overlay roles; dark focal/identity surfaces use `inverse`.
- Runtime states: no behavioral change to empty, loading, error, restricted, stale, pending,
  success, or failure states. Skeletons inherit the same neutral and elevation tokens.
- Motion: no new animation. Existing Framer Motion behavior and reduced-motion fallbacks remain
  unchanged.

## Verification

- Run the design-token contract and affected UI presentation tests.
- Run TypeScript and ESLint in proportion to the touched UI source.
- Build the application to verify Tailwind generates every semantic token utility.
- Visually compare Dashboard and Expenses at 320, 360, 390, and 430 px, checking canvas neutrality,
  surface separation, focus visibility, sheet elevation, and unwrapped primary financial values.
