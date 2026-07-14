# Main Surface UI Audit & Redesign

## Goal

Mature the existing Atria ERP mobile experience without replacing its top bar, bottom navigation, contextual FAB, finance workflow, project scoping, or stock-control behavior.

## Delivery Slices

1. **Foundation + P0 surfaces** — shared state language, derived project health, overflow-aware tabs, Dashboard, Projects list, and Project Detail shell/overview.
2. **Finance decisions** — compact Finance Inbox and queue-first Approvals with progressive detail.
3. **Material operations** — remove duplicated quick actions, prioritize attention items, and compact inventory rows.
4. **Supporting surfaces** — Settings, Profile, Login, route states, offline feedback, and motion cleanup.

## Product Decisions

- Keep the fixed `max-w-md` mobile shell for this pass; large-screen adaptation is a later phase.
- Show lifecycle status separately from derived financial health.
- Effective project health is the most severe of stored health and canonical budget/margin signals; it never mutates stored data.
- Do not add standalone Search, Reports, Notifications, Activity, or Procurement routes.
- Cards are reserved for top-level summaries; repeated operational content uses compact rows and dividers.
- All touched motion uses Framer Motion presets from `lib/utils/motion.ts`.

## Verification

- Unit test effective health precedence and reasons.
- Verify Owner, Finance Admin, Project Manager, and Purchasing visibility/scoping.
- Check 320, 390, and 430 px widths for overflow, safe-area clearance, amount legibility, tab discoverability, and first-viewport priorities.
- Run ESLint, TypeScript, full Bun tests, production build, and Playwright smoke tests after the slices are complete.
