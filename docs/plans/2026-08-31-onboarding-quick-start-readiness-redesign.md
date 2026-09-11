# Onboarding Quick Start + Operational Readiness

## Outcome

- Owner reaches first value in 10–15 minutes through `Welcome -> Default Finansial -> Project Pertama -> Sukses`.
- Quick start creates a real Draft project, canonical category budget, audit trail, and immutable completion state atomically.
- Team, bank account, material foundation, and opening-stock decision move to a permanent, role-aware Settings readiness workspace.
- Dashboard and Settings share one progress/readiness projection and one feature component with different density.

## Implementation Sequence

1. Add versioned quick-start state and a compatibility mapper from `owner_onboarding_v1`. Completed v1 state stays complete; incomplete state derives its next quick-start step from actual finance/project data.
2. Make `project.project_manager_id` nullable for Draft compatibility, while keeping the regular create-project action PM-required and adding an activation guard for an active PM.
3. Extract the transactional project + canonical-budget insert helper. Add a quick-start action that row-locks onboarding state, creates the Draft project and budget, writes audit/event rows, and marks quick start complete in one transaction.
4. Add a light `OrganizationSetupOverview` read model: quick-start journey, four required readiness groups, two recommended groups, and role-aware actions.
5. Replace the sequential six-step workspace with Welcome, finance defaults, first-project, and success panels. Reuse shared settings/project form infrastructure and shared UI primitives.
6. Refactor the unused Settings readiness workspace into a real `readiness` tab. Move team, bank, material, and opening-stock setup there without duplicating their canonical mutations.
7. Replace Dashboard and Settings banners with one neutral `OrganizationSetupCard`; journey position and operational readiness are displayed separately.
8. Split loaders by current quick-start step/Settings tab, add completion fast paths, precise revalidation, and loader benchmarks.
9. Add first-party onboarding events without form values, names, emails, or financial amounts.

## Safety and Compatibility

- Existing v1 data is read-only fallback and never forces a user to repeat onboarding.
- Completed quick start cannot be advanced, paused, or reopened; `/onboarding` redirects to Settings readiness.
- Project Draft may have no PM only through quick start. Activation requires an active PM plus existing Budget/RAP/RAB readiness.
- Project and budget writes stay transactional and audited; quick start does not move cash or stock.
- Opening inventory retains maker-checker, transaction, stock movement, and audit invariants.
- Optional Vendor and Library readiness never reduce required completion.
- Route/read-model failures fail closed with a retryable error, not a silent redirect to Ledger.

## Verification

- Unit: v1 mapping, v2 parsing, immutable completion, optional readiness, journey progress, role-aware actions, nullable Draft PM.
- Integration: atomic first-project creation, rollback/idempotency/concurrency, audit/events, pause/resume locking, activation PM guard, approval-to-readiness.
- Component: shared card densities, Vendor reachability, explicit opening-stock decision, non-Owner actions, ARIA/touch targets, raw-enum boundary.
- Browser: 320/360/390/430px, keyboard/focus, reduced motion, fresh install, pause/resume, v1 compatibility, quick-start completion, role-aware readiness.
- Gates: focused tests, full test suite, TypeScript, ESLint, format check, production build, Impeccable detector, loader timing report, demo invariants.
