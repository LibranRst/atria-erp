# Rule: Codebase Architecture, TypeScript & Next.js Standards

This rule governs coding standards, type safety, server action patterns, and error handling for **Atria ERP**.

## 1. Strict TypeScript Standards
- **No `any`**: The use of `any` is strictly prohibited. Use typed generics, `unknown` with type narrowing, or specific interface types.
- **Explicit Returns & Parameters**: All exported functions, Server Actions, helpers, and hooks must have explicit return type annotations and parameter types.
- **Zod Validation**: Every Server Action taking user/form input must validate arguments through a Zod schema before processing.
- **Type Assertions**: Minimize `as SomeType`. Use Zod schema parsing (`schema.parse` or `schema.safeParse`) to guarantee runtime type safety.

---

## 2. Next.js 16 App Router & Server Actions
- **Server Actions**:
  - File convention: place actions in `features/<feature>/actions/` or `lib/actions/`.
  - Must begin with `"use server";`.
  - Server actions MUST read and verify the Better Auth session server-side:
    ```typescript
    import { getSession } from "@/lib/auth/session";
    const session = await getSession();
    if (!session?.user) throw new Error("Unauthorized");
    ```
  - Never trust client-provided user IDs or role assertions.
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
- Use `clsx` and `tailwind-merge` (`cn(...)` helper in `lib/utils.ts`) for conditional class concatenation.
- Avoid ad-hoc inline styles; use semantic Tailwind utility classes defined in `app/globals.css` and `DESIGN.md`.
