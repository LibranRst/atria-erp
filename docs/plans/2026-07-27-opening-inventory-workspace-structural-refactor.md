# Opening Inventory Workspace Structural Refactor

## Goal

Reduce `opening-inventory-workspace.tsx` into a composition root while preserving the existing opening-stock workflow, server-action boundaries, audit requirements, and mobile UI.

## Scope

- Keep the workspace responsible for page-level prerequisites and composing the workflow.
- Move opening-batch entry state and submission orchestration into a dedicated entry form.
- Split manual line editing and CSV import/preview into focused presentation components.
- Move detail, reversal state, and reversal mutation orchestration into a dedicated batch-detail sheet.
- Retain shared detail primitives, metadata fields, history, types, and pure utilities already extracted.
- Keep the public server-action entrypoint stable while moving its read-model types and shared response/revalidation helpers into dedicated modules.
- Move request, approve/reject, and reversal mutations into `opening-inventory-mutations.ts`.
- Move candidate, CSV preview, and batch-history reads into `opening-inventory-queries.ts`.

## UI Contract

- Information hierarchy remains: workflow context, prerequisites, entry method and data, total/risk, history, then contextual batch detail.
- Existing grouped surfaces, form rows, financial values, status labels, and action hierarchy remain unchanged.
- Empty, validation, pending, success, failure, ineligible, and reversal states retain their current copy and behavior.
- History rows continue to open the contextual detail sheet.
- Motion: no page or tab-content animation; retain existing segmented-tab pill, tap feedback, and sheet slide/fade with the existing reduced-motion behavior.

## Validation

- Prettier and ESLint for every affected opening-inventory file.
- Strict TypeScript compilation.
- Relevant material shared primitive tests.
- `git diff --check`.
- Confirm the workspace and extracted modules no longer contain a new oversized mixed-responsibility component.
