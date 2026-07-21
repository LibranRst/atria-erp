# Architecture Cleanup Refactor

## Summary

- Add feature-owned folders for finance dashboard, project detail, materials, expenses, and settings.
- Preserve App Router routes, Server Actions, database schema, and existing product behavior.
- Keep compatibility re-export shims under existing `components/*` paths so old imports remain valid.

## Implementation

- Move domain-heavy client components into `features/*/components`.
- Extract repeated page authentication/session access into `lib/server/session.ts`.
- Move project-detail and expenses page query/mapping logic into feature server loaders.
- Keep finance and material mutation code untouched.
- Add small shared utilities only where output and behavior already match.

## Verification

- `bun run lint`
- `bun run build`

## Safety

- No schema, route, env var, dependency, or permission changes.
- Preserve dirty worktree changes and avoid destructive git operations.
