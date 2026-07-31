# Project Drawer Structural Refactor

## Goal

Separate project form fields, review presentation, and recovery confirmation from project mutation and upload orchestration while preserving create/edit behavior.

## Structure

- Keep `project-drawer.tsx` responsible for recovery lifecycle, validation, cover upload, mutations, and sheet composition.
- Move shared drawer data contracts into `project-drawer-types.ts`.
- Move editable field sections into `project-drawer-form-fields.tsx`.
- Move review and recovery confirmation surfaces into focused components.

## UI Contract

- Preserve the identity-first form hierarchy, optional operational disclosure, review state, and success state.
- Preserve local recovery, client creation, PM defaulting, cover upload, and close confirmation behavior.
- Motion: retain existing sheet transitions and confirmation tap feedback; add no entrance animation.

## Validation

- Prettier and ESLint for affected project drawer modules.
- Strict TypeScript compilation.
- Relevant project presentation and action tests.
- `git diff --check`.
