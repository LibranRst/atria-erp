# Owner Onboarding Workspace Structural Refactor

## Goal

Separate onboarding navigation chrome, step rendering, and workflow actions so the workspace remains a small state-and-action coordinator.

## Structure

- Keep `owner-onboarding-workspace.tsx` responsible for current step, routing, refresh, and server-action transitions.
- Move copy and status presentation maps into `onboarding-workspace-presentation.ts`.
- Move header progress/navigation into `onboarding-workspace-header.tsx`.
- Move step-specific panels and summary readiness into `onboarding-step-content.tsx`.
- Move primary workflow controls and exit confirmation into `onboarding-workspace-actions.tsx`.

## UI Contract

- Preserve the linear setup hierarchy, compact mobile header, readiness summary, and explicit pause/finish actions.
- Preserve source-level error isolation and developer-simulation behavior.
- Motion: retain progress, tap, and modal motion using shared presets; add no decorative entrance motion.

## Validation

- Prettier and ESLint for affected onboarding modules.
- Strict TypeScript compilation.
- Onboarding state, verification, and workspace source tests.
- `git diff --check`.
