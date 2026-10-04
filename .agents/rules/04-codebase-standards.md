# Rule: Codebase Architecture, TypeScript & Next.js Standards

This rule governs coding standards, type safety, server action patterns, and error handling for **Atria ERP**.

## 1. Strict TypeScript Standards
- **No `any`**: The use of `any` is strictly prohibited. Use typed generics, `unknown` with type narrowing, or specific interface types.
- **Explicit Returns & Parameters**: All exported functions, Server Actions, helpers, and hooks must have explicit return type annotations and parameter types.
- **Zod Validation**: Every Server Action taking user/form input must validate arguments through a Zod schema before processing.
- **Type Assertions**: Minimize `as SomeType`. Use Zod schema parsing (`schema.parse` or `schema.safeParse`) to guarantee runtime type safety.

---

## 2. API Business Operations and Web Server Actions
- **Backend operations** live in `apps/api/src/backend/`, use `@backend/*`, validate inputs with Zod and resolve Better Auth sessions/Actors from the current API request. Keep finance/stock transaction bodies entirely inside this process.
- **Web Server Actions** live in `apps/web/app/actions/` and keep `"use server"` on declared async HTTP wrappers. Use `@/lib/api/backend` (`callBackendAction` for ActionResponse contracts); backend execution and database access remain in the API. Forward the current server-side cookie/bearer credentials, never a user ID or role assertion from client input. Register explicit allowed compatibility operations, or typed tRPC procedures, for new backend behavior.
- **Web reads/session helpers** use authenticated `no-store` HTTP calls. Next-specific redirects/revalidation stay in web; API emits portable control/invalidation metadata.
- **Client Components**:
  - Mark only interactive or animation-driven components with `"use client";`. Keep server-rendered shells and layouts wherever possible.

---

## 3. Drizzle ORM Guidelines
- Define schemas in `db/schema/` or modular schema files.
- Never write raw SQL strings in application logic; use Drizzle's type-safe query builder (`db.select()`, `db.insert()`, `db.update()`, `db.delete()`).
- Use transactions (`await db.transaction(async (tx) => { ... })`) for all multi-step and balance-changing operations.
- Handle nullable columns and numeric conversions cleanly (Postgres `numeric` / `decimal` comes back as string from `pg`; parse safely to number or keep structured).

---

## 4. UI Component Conventions
- Place domain-agnostic UI primitives in `components/ui/` (e.g. `MoneyValue`, `Button`, `SegmentedTabs`, `Drawer`, `Badge`).
- Place feature-specific components in `features/<feature>/components/`.
- Follow `05-shared-ui-first.md` before adding a component. The `@/components/ui` barrel is the public inventory; feature code composes that inventory and does not duplicate its interaction infrastructure.
- Use `clsx` and `tailwind-merge` (`cn(...)` helper in `lib/utils.ts`) for conditional class concatenation.
- Avoid ad-hoc inline styles; use semantic Tailwind utility classes defined in `app/globals.css` and `DESIGN.md`.
