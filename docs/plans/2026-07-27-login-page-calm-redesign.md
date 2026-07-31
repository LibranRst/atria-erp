# Login Page Calm Redesign

## Goal

Simplify `/login` into a calm, compact entry point that matches Atria's mobile iOS form language
without adding dashboard-like summaries or decorative product marketing.

## UI Contract

- Information hierarchy: Atria identity, one-line orientation, credentials, primary sign-in action,
  and one quiet product line.
- Surface ownership: one grouped form surface owns the email and password rows. No focal summary,
  badge, inset metric grid, decorative card, chart, or illustration is needed.
- Inputs: labeled borderless rows inside the grouped surface with autocomplete and 48px effective
  touch posture.
- Error state: one concise inline alert connected to both credential fields. Avoid a second toast
  that duplicates the same failure.
- Pending state: disable both fields and use the shared primary button pending treatment.
- Success state: preserve the short success toast and immediate redirect to the role-aware home
  route.
- Restricted/access state: authentication failure uses generic Bahasa Indonesia copy and does not
  reveal which credential was incorrect.

## Implementation

- Recompose `app/login/page.tsx` with shared `FormSection`, `FormField`, `TextInput`, and `Button`
  primitives.
- Allow a grouped `FormSection` to omit its visual header when the surrounding page already provides
  sufficient context, without leaving an empty heading in the accessibility tree.
- Keep the shared button gesture registered across server and client rendering while resolving its
  tap scale to `1` under reduced motion, preventing a reduced-motion hydration mismatch.
- Remove the large hero icon, product eyebrow, login badge, separate credentials-card header,
  field-label icons, and two-line legal footer.
- Keep authentication behavior, route refresh, and existing Better Auth integration intact.
- Do not change RBAC, session handling, or redirect decisions.

## Motion

Motion: no page or content animation; only the shared button tap feedback, with its existing
reduced-motion fallback.

## Verification

- Visually inspect fresh, filled, pending, and failed states at 320, 360, 390, and 430px.
- Confirm no horizontal overflow or short-viewport clipping.
- Confirm labels, focus indicators, error announcement, autocomplete, and 48px targets.
- Run targeted ESLint, TypeScript, and proportional browser/build checks.
