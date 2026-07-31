# Server Boundary Architecture Refactor

## Context

The repository currently uses `app/actions` as the public Server Action boundary, but several
feature-local `actions` folders contain page loaders, read-model composition, access helpers, and
pure mappers rather than callable Server Actions. The ambiguous naming makes it easy to apply
`"use server"` to the wrong file or to create a re-export barrel that Next.js rejects.

## Target architecture

- `app/actions/**` contains public Server Action entrypoints and their closely scoped private
  implementation modules.
- A file with `"use server"` exports only directly declared async runtime functions. Compatibility
  barrels may re-export Server Actions, but must not contain `"use server"`.
- `features/<feature>/server/**` contains page loaders, server-side read models, authorization-aware
  data shaping, and server-only orchestration. Every runtime module in this folder declares
  `import "server-only"`.
- `features/<feature>/utils/**` contains pure mapping and presentation helpers that are safe to use
  without a server boundary.
- `features/<feature>/hooks/**` contains client-side state and event orchestration. UI handler names
  may use “actions”, but they are not stored in a feature-level `actions` directory.

## Executable changes

1. Move Expenses, Onboarding, and Project Detail page loaders from `actions` to `server`.
2. Move the Project Detail pure mapper from `actions` to `utils`.
3. Update all route, component, test, and relative imports.
4. Add explicit `server-only` guards to feature server modules.
5. Add an architecture regression test covering feature folder naming, server-only declarations,
   and the Next.js `"use server"` export restriction.
6. Move remaining route-level data composition into feature server loaders for Expenses New,
   Projects List, Settings, Profile, Approvals, Finance Dashboard, and Onboarding Review.
7. Keep route files responsible for route parameters, redirects, and rendering, while loaders own
   session-aware reads, role scoping, query composition, and data mapping.
8. Extend the architecture regression test so route pages cannot query Drizzle directly.
9. Run formatting, lint, independent TypeScript validation, the complete Bun suite, and a
   production Next.js build.

## Compatibility and safety

- Public Server Action import paths remain stable.
- No finance or stock mutation behavior changes.
- Session, RBAC, project scoping, transaction, and audit behavior remain unchanged.
- This is an internal module-boundary refactor; user-facing workflows and UI remain unchanged.
