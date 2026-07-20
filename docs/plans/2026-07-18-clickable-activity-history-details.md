# Clickable Activity History & Business Impact Detail

## Summary

Make every visible individual activity/history event open a contextual detail sheet backed by a fresh, permission-scoped server read. The detail explains identity, actor and time, business facts, supported before/after evidence, impact, notes, and an authorized source CTA without exposing raw audit JSON.

## Implementation

- Add a Zod-discriminated `ActivityDetailRequest`, serializable `ActivityDetailView`, and one `getActivityDetail` server query that reads canonical domain records with Better Auth/RBAC and project scoping.
- Add a shared `ActivityDetailSheet` with structural loading, grouped fact/change/impact/note surfaces, safe incomplete-history messaging, retry/restricted/not-found states, and contextual source navigation.
- Convert visible material, finance, invoice, vendor, RAB/change-order, and approval history events into accessible 48px row buttons. Preserve existing specialized drawers and nested actions where they already provide mutation controls.
- Derive business impacts server-side. Never serialize raw audit snapshots, invent missing historical values, or introduce a second mutation path.
- Document the clickable-history rule and the values users should verify in the workflow guide and main surface design language.

## Verification

- Unit-test request validation, fact/impact mapping, missing historical evidence, and safe audit handling.
- Integration-test authentication, permissions, PM project scoping, source CTA authorization, and read-only behavior.
- Component-test click/keyboard behavior, loading/error/retry, nested actions, long text, and money/quantity layout.
- Run TypeScript, focused tests, and mobile visual checks at 320, 360, 390, and 430px.

## Assumptions

- Detail remains contextual; no global Activity Center is introduced.
- Detail is fetched fresh when opened.
- Individual history events are interactive; aggregate summaries and master-data rows are outside this rule.
- Historical gaps are disclosed instead of estimated or backfilled.
