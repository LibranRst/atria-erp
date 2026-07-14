# Lint Quality Gate Cleanup

## Goal

Restore a clean ESLint and TypeScript baseline without changing Atria ERP business behavior, finance safety, permissions, or user-facing workflows.

## Scope

1. Replace synchronous state writes inside effects with derived render values, lazy initial state, event-handler resets, or asynchronous subscription callbacks.
2. Preserve drawer and bottom-sheet enter/exit animations while making their state transitions React 19 lint compliant.
3. Remove unused imports, props, variables, and unsafe `any` usage.
4. Verify with full ESLint, TypeScript, and relevant Bun tests.

## Guardrails

- No changes to server actions, finance mutations, stock transactions, RBAC, or database schema.
- Preserve existing URLs, drawer behavior, form defaults, and toast feedback.
- Keep user changes in the dirty worktree intact.
