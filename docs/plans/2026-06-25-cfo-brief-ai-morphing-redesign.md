# CFO Brief AI Assistant Morphing Redesign

## Goal
Redesign the Ringkasan CFO Brief AI Assistant so it feels more premium and accent-forward while morphing smoothly between compact and expanded states.

## Direction
- Keep the dashboard overview structure unchanged.
- Replace the split compact/expanded AI states with one morphing Framer Motion surface.
- Use `transitionSpringBouncy` for the surface morph and `transitionEaseSmooth` for inner content fades.
- Use a refined monochrome black-to-white blurred gradient for the expanded card.
- Preserve the existing summary text, close behavior, and `/ledger?brief=true` CTA.

## Verification
- Run `npm run lint`.
- Run `npm run build`.
- Browser-check `/ledger` at 320, 390, and 430 px.
- Verify collapsed-to-expanded and expanded-to-collapsed transitions feel seamless.
