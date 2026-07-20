# Core UI Components Implementation Plan

**Goal:** Complete the remaining TSK-010 UI foundation by adding reusable iOS 26 Solid `Card` and `Badge` components for Atria ERP.

**Architecture:** Add small, typed, server-compatible React components under `components/ui/` with no client-only APIs and no runtime dependencies. `Card` provides solid opaque financial containers using existing Tailwind v4 semantic tokens. `Badge` centralizes status color mapping for finance/project states with accessible text labels, 15%-style subdued backgrounds via the existing light status tokens, and no backdrop blur.

**Tech Stack:** Next.js App Router 16.2.9, React 19.2.4, TypeScript strict mode, Tailwind CSS v4, Bun.

---

## File Structure

- Create: `components/ui/card.tsx`
  - Exports `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter`.
  - Uses `React.ComponentPropsWithoutRef` types so all standard HTML attributes remain available without `any`.
  - Provides solid `bg-surface` / `bg-elevated` variants with `border-border`, `rounded-2xl`, and low-cost shadow.
  - Does not use CSS blur or glassmorphism.

- Create: `components/ui/badge.tsx`
  - Exports `Badge`, `type BadgeStatus`, and `type BadgeVariant`.
  - Maps documented statuses to semantic tokens:
    - `PAID`, `APPROVED` -> success
    - `PENDING`, `SUBMITTED`, `UNPAID` -> warning
    - `PARTIALLY_PAID` -> primary
    - `WARNING` -> warning
    - `CRITICAL`, `OVERDUE`, `REJECTED` -> critical
    - `VOID`, `DRAFT` -> muted/elevated
  - Uses compact uppercase label styling suitable for financial rows and approval states.

- Create: `components/ui/index.ts`
  - Re-exports `Card` and `Badge` modules for ergonomic imports.

- Modify: `app/page.tsx`
  - Replace hand-written card containers with the reusable `Card` primitives and add sample `Badge` usage.
  - Keep the page simple; do not create real project/finance data yet.

- Modify: `docs/plans/2026-06-11-core-ui-components.md`
  - Include this plan in the implementation commit.

## Design Direction

The components should feel like **solid finance instrument panels**: dense, dark, tactile blocks with precise borders and readable state chips. They should be reusable building blocks, not a design-system overhaul.

## Implementation Tasks

### Task 1: Create reusable Card primitives

**Files:**
- Create: `components/ui/card.tsx`

- [ ] **Step 1: Create `components/ui/card.tsx` with this complete implementation**

```tsx
import type { ComponentPropsWithoutRef } from "react";

type CardVariant = "surface" | "elevated";

type CardProps = ComponentPropsWithoutRef<"section"> & Readonly<{
  variant?: CardVariant;
}>;

type CardPartProps = ComponentPropsWithoutRef<"div">;

type CardTitleProps = ComponentPropsWithoutRef<"h2">;

type CardDescriptionProps = ComponentPropsWithoutRef<"p">;

function mergeClassNames(...classNames: readonly (string | undefined)[]): string {
  return classNames.filter(Boolean).join(" ");
}

const CARD_VARIANT_CLASS_NAMES: Record<CardVariant, string> = {
  surface: "bg-surface",
  elevated: "bg-elevated",
};

export function Card({
  children,
  className,
  variant = "surface",
  ...props
}: CardProps): React.JSX.Element {
  return (
    <section
      className={mergeClassNames(
        "rounded-2xl border border-border p-4 shadow-[0_4px_12px_rgba(0,0,0,0.15)]",
        CARD_VARIANT_CLASS_NAMES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  children,
  className,
  ...props
}: CardPartProps): React.JSX.Element {
  return (
    <div className={mergeClassNames("space-y-1", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
  ...props
}: CardTitleProps): React.JSX.Element {
  return (
    <h2
      className={mergeClassNames(
        "text-lg font-semibold tracking-tight text-text-primary",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function CardDescription({
  children,
  className,
  ...props
}: CardDescriptionProps): React.JSX.Element {
  return (
    <p className={mergeClassNames("text-sm leading-6 text-secondary", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className,
  ...props
}: CardPartProps): React.JSX.Element {
  return (
    <div className={mergeClassNames("mt-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className,
  ...props
}: CardPartProps): React.JSX.Element {
  return (
    <div
      className={mergeClassNames(
        "mt-4 flex items-center justify-between gap-3 border-t border-border pt-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Confirm component requirements**

Check `components/ui/card.tsx` includes:

```tsx
"rounded-2xl border border-border p-4 shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
```

Check it does not include:

```tsx
backdrop-blur
blur
any
```

### Task 2: Create documented status Badge component

**Files:**
- Create: `components/ui/badge.tsx`

- [ ] **Step 1: Create `components/ui/badge.tsx` with this complete implementation**

```tsx
import type { ComponentPropsWithoutRef } from "react";

export type BadgeStatus =
  | "APPROVED"
  | "CRITICAL"
  | "DRAFT"
  | "OVERDUE"
  | "PAID"
  | "PARTIALLY_PAID"
  | "PENDING"
  | "REJECTED"
  | "SUBMITTED"
  | "UNPAID"
  | "VOID"
  | "WARNING";

export type BadgeVariant = "critical" | "muted" | "primary" | "success" | "warning";

type BadgeProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & Readonly<{
  status: BadgeStatus;
  children?: string;
}>;

function mergeClassNames(...classNames: readonly (string | undefined)[]): string {
  return classNames.filter(Boolean).join(" ");
}

const STATUS_VARIANTS: Record<BadgeStatus, BadgeVariant> = {
  APPROVED: "success",
  CRITICAL: "critical",
  DRAFT: "muted",
  OVERDUE: "critical",
  PAID: "success",
  PARTIALLY_PAID: "primary",
  PENDING: "warning",
  REJECTED: "critical",
  SUBMITTED: "warning",
  UNPAID: "warning",
  VOID: "muted",
  WARNING: "warning",
};

const VARIANT_CLASS_NAMES: Record<BadgeVariant, string> = {
  critical: "bg-critical-light text-critical",
  muted: "bg-elevated text-muted",
  primary: "bg-primary-light text-primary",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
};

function formatStatusLabel(status: BadgeStatus): string {
  return status.replaceAll("_", " ");
}

export function Badge({
  status,
  children,
  className,
  ...props
}: BadgeProps): React.JSX.Element {
  const variant = STATUS_VARIANTS[status];
  const label = children ?? formatStatusLabel(status);

  return (
    <span
      className={mergeClassNames(
        "inline-flex min-h-6 items-center rounded-lg px-2 py-1 text-[0.625rem] font-bold uppercase leading-none tracking-[0.12em]",
        status === "VOID" ? "line-through" : undefined,
        VARIANT_CLASS_NAMES[variant],
        className,
      )}
      {...props}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Confirm documented status mappings**

Check these mappings are present:

```tsx
PAID: "success"
APPROVED: "success"
PENDING: "warning"
SUBMITTED: "warning"
UNPAID: "warning"
PARTIALLY_PAID: "primary"
CRITICAL: "critical"
OVERDUE: "critical"
VOID: "muted"
```

Check the variant classes use existing semantic tokens:

```tsx
bg-success-light text-success
bg-warning-light text-warning
bg-primary-light text-primary
bg-critical-light text-critical
bg-elevated text-muted
```

### Task 3: Add UI component barrel exports

**Files:**
- Create: `components/ui/index.ts`

- [ ] **Step 1: Create `components/ui/index.ts` with this complete implementation**

```ts
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
export { Badge } from "@/components/ui/badge";
export type { BadgeStatus, BadgeVariant } from "@/components/ui/badge";
```

- [ ] **Step 2: Confirm exports resolve through `@/*` alias**

Run:

```bash
bun run build
```

Expected at this intermediate point: build may fail only if `app/page.tsx` has not yet imported these components. TypeScript should not report path alias errors for `components/ui/index.ts`.

### Task 4: Use Card and Badge on the welcome page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx` with this complete implementation**

```tsx
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function Home(): React.JSX.Element {
  return (
    <section className="flex min-h-[calc(100dvh-7rem)] flex-col justify-between gap-8">
      <div className="space-y-6">
        <Card className="rounded-3xl p-5 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              Atria ERP
            </p>
            <CardTitle className="pt-4 text-3xl">
              Finance-first control room for interior projects.
            </CardTitle>
            <CardDescription>
              Pantau proyek, ledger kas, dan pengeluaran lapangan dari satu shell seluler yang siap dipakai Project Manager di lapangan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge status="APPROVED">Shell Ready</Badge>
            <Badge status="PENDING">UI Foundation</Badge>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          <Card variant="elevated">
            <CardHeader>
              <p className="text-xs font-medium text-muted">Primary workflow</p>
              <CardTitle className="text-base">
                Projects → Ledger → Add Expense → Profile
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <p className="text-xs font-medium text-muted">Design foundation</p>
              <CardTitle className="text-base">
                iOS 26 Solid tokens, 48px touch targets, and sticky thumb navigation.
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      <p className="pb-2 text-center text-xs leading-5 text-muted">
        Gunakan navigasi bawah untuk berpindah ke modul utama Atria ERP.
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Confirm page uses reusable components**

Check `app/page.tsx` imports from:

```tsx
"@/components/ui"
```

Check it uses at least one `<Card>` and one `<Badge>`.

### Task 5: Verify linting, build, and dev startup

**Files:**
- No code changes expected unless verification finds a concrete compile or lint error.

- [ ] **Step 1: Run ESLint**

Run:

```bash
bun run lint
```

Expected: ESLint exits successfully with no errors.

- [ ] **Step 2: Run production build**

Run:

```bash
bun run build
```

Expected: Next.js build exits successfully with no TypeScript or compilation errors.

- [ ] **Step 3: Start dev server briefly**

Run:

```bash
bun run dev -- -p 3001
```

Expected: Next.js dev server starts and logs `http://localhost:3001`. Stop it after readiness is confirmed.

### Task 6: Inspect final diff and commit

**Files:**
- All changed files from prior tasks.

- [ ] **Step 1: Review working tree status**

Run:

```bash
git status --short
```

Expected changed files:

```text
M app/page.tsx
A components/ui/badge.tsx
A components/ui/card.tsx
A components/ui/index.ts
A docs/plans/2026-06-11-core-ui-components.md
```

If the previous Task 3 commit is still unpushed, `git status --branch` may also show `ahead 1` or `ahead 2` after this task is committed.

- [ ] **Step 2: Review diff**

Run:

```bash
git diff -- app/page.tsx components/ui/badge.tsx components/ui/card.tsx components/ui/index.ts docs/plans/2026-06-11-core-ui-components.md
```

Expected: Diff only contains the planned UI components, welcome page component usage, and this plan.

- [ ] **Step 3: Commit with this message**

Run:

```bash
git add app/page.tsx components/ui/badge.tsx components/ui/card.tsx components/ui/index.ts docs/plans/2026-06-11-core-ui-components.md
git commit -m "feat: add core solid UI components"
```

Expected: Commit succeeds.

## Self-Review

1. **Spec coverage:**
   - Adds reusable solid Card component matching documented `bg-surface`, `border-border`, `rounded-2xl`, `p-4`, and low-cost shadow guidance.
   - Adds Badge component with documented status-to-color mappings and muted `VOID` strike-through behavior.
   - Uses existing semantic Tailwind tokens from `app/globals.css`.
   - Avoids backdrop blur/glassmorphism.
   - Keeps TypeScript strict and explicit React component return types.
   - Updates the welcome page to prove components compile and render through the app shell.
   - Verification covers lint, production build, and dev server startup.

2. **Placeholder scan:** No `TODO`, `TBD`, `implement later`, or incomplete code appears in this plan.

3. **Type consistency:**
   - `BadgeStatus`, `BadgeVariant`, `CardVariant`, and props types are defined before use.
   - Components use `ComponentPropsWithoutRef` and no `any`.
   - Barrel exports match actual component/type names.
