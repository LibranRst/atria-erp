# Reconciliation Workspace Structural Refactor

## Goal

Separate the reconciliation queue, reusable evidence presentation, history detail, and mutation orchestration without changing finance behavior.

## Structure

- Keep `reconciliation-workspace.tsx` responsible for workflow state, mutation orchestration, and composing sheets.
- Move the summary, tabs, prioritized cash/statement lists, and history queue into `reconciliation-queue.tsx`.
- Move row, money, evidence, empty-state, formatting, and draft primitives into `reconciliation-primitives.tsx`.
- Move history presentation and presence-safe sheet lifecycle into `reconciliation-history-sheet.tsx`.
- Keep all server actions authoritative and preserve existing reconciliation and exception behavior.

## UI Contract

- Preserve the existing queue hierarchy, grouped/decision surfaces, financial formatting, and copy.
- Preserve pending, error, empty, exception, import, manual entry, match, and history states.
- Motion: retain only existing sheet slide/fade and tab-pill behavior; queue content remains instant.

## Validation

- Prettier and ESLint on affected reconciliation modules.
- Strict TypeScript compilation.
- Relevant reconciliation tests.
- `git diff --check`.
