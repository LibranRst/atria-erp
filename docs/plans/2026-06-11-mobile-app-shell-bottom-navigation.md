# Mobile App Shell & Sticky Bottom Navigation Implementation Plan

**Goal:** Build the Phase 1 Task 3 mobile-first app shell with sticky bottom navigation for Atria ERP.

**Architecture:** Keep the app shell as a server-rendered layout wrapper and isolate route-aware navigation in a small client component that uses `usePathname()`. Use the existing Tailwind v4 CSS-first tokens from `app/globals.css` (`bg-deep`, `bg-surface`, `border-border`, `text-primary`, `text-muted`, `text-secondary`) and avoid backdrop blur per `docs/05-ui-ux/IOS26_SOLID_DESIGN_SYSTEM.md`. The shell centers a max-width mobile viewport on desktop, reserves bottom safe-area space, and allows only the content region to scroll.

**Tech Stack:** Next.js App Router 16.2.9, React 19.2.4, TypeScript strict mode, Tailwind CSS v4, Bun, lucide-react.

---

## File Structure

- Create: `components/layout/bottom-nav.tsx`
  - Client Component because it needs `usePathname()` to highlight active routes.
  - Exports `BottomNav(): React.JSX.Element`.
  - Owns a typed navigation item list for Projects, Ledger, Add Expense, and Profile.
  - Uses lucide-react icons and active `text-primary` styling.
  - Enforces at least `48px` touch target via `min-h-12 min-w-12` and a fixed `h-16` navigation bar.

- Create: `components/layout/mobile-shell.tsx`
  - Server Component wrapper.
  - Exports `MobileShell({ children }: MobileShellProps): React.JSX.Element`.
  - Centers the mobile viewport with `mx-auto w-full max-w-md`.
  - Provides a full-height, dark, solid app frame with scrollable content and reserved bottom padding.
  - Renders `<BottomNav />` pinned to the bottom of the mobile frame.

- Modify: `app/layout.tsx`
  - Import `MobileShell`.
  - Wrap `children` in `MobileShell` inside `<body>`.
  - Keep explicit return type `React.JSX.Element`.
  - Keep existing font setup for now; do not introduce new font downloads in this task.

- Modify: `app/page.tsx`
  - Replace boilerplate light/dark placeholder styles with a simple Atria welcome screen that sits inside the shell.
  - Use existing semantic Tailwind tokens.
  - Keep explicit return type `React.JSX.Element`.

- Modify: `package.json`
  - Add `lucide-react` to dependencies if it is not already installed.

## Design Direction

The visual direction is **luxury field-ops minimalism**: dark solid surfaces, high-contrast financial hierarchy, compact premium cards, and thumb-friendly controls. The one memorable detail is a centered mobile device-like shell on desktop that preserves the same one-handed bottom navigation field users will rely on in mobile WebView.

## Implementation Tasks

### Task 1: Install the icon dependency

**Files:**

- Modify: `package.json`
- Modify: `bun.lock`

- [ ] **Step 1: Install lucide-react**

Run:

```bash
bun add lucide-react
```

Expected: `package.json` includes `lucide-react` under `dependencies`, and `bun.lock` is updated.

- [ ] **Step 2: Inspect the dependency entry**

Confirm `package.json` contains a dependency similar to:

```json
"dependencies": {
  "lucide-react": "^0.x.x",
  "next": "16.2.9",
  "react": "19.2.4",
  "react-dom": "19.2.4"
}
```

The exact `lucide-react` version should be whatever Bun resolves.

### Task 2: Create the route-aware sticky bottom navigation

**Files:**

- Create: `components/layout/bottom-nav.tsx`

- [ ] **Step 1: Create `components/layout/bottom-nav.tsx` with this complete implementation**

```tsx
"use client";

import Link from "next/link";
import { ClipboardList, FolderKanban, PlusCircle, UserCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  readonly label: string;
  readonly href: string;
  readonly icon: NavIcon;
  readonly match: (pathname: string) => boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
    match: (pathname: string): boolean => pathname === "/" || pathname.startsWith("/projects"),
  },
  {
    label: "Ledger",
    href: "/ledger",
    icon: ClipboardList,
    match: (pathname: string): boolean => pathname.startsWith("/ledger"),
  },
  {
    label: "Add Expense",
    href: "/expenses/new",
    icon: PlusCircle,
    match: (pathname: string): boolean => pathname.startsWith("/expenses/new"),
  },
  {
    label: "Profile",
    href: "/profile",
    icon: UserCircle,
    match: (pathname: string): boolean => pathname.startsWith("/profile"),
  },
];

export function BottomNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="sticky bottom-0 z-20 h-16 border-t border-border bg-surface px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.24)]"
    >
      <ul className="grid h-full grid-cols-4 items-center gap-1">
        {NAV_ITEMS.map((item: NavItem): React.JSX.Element => {
          const Icon = item.icon;
          const isActive = item.match(pathname);

          return (
            <li key={item.href} className="h-full">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[0.68rem] leading-none font-semibold transition-colors duration-150 ${
                  isActive
                    ? "bg-primary-light text-primary"
                    : "text-muted hover:bg-elevated hover:text-secondary"
                }`}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={2.25} />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Verify key requirements in the component**

Check the code includes:

```tsx
className = "sticky bottom-0 ... h-16 border-t border-border bg-surface ...";
```

Check every navigation `Link` includes at least:

```tsx
className = "flex min-h-12 min-w-12 ...";
```

This makes each tab target at least `48px` in both dimensions.

### Task 3: Create the mobile app shell wrapper

**Files:**

- Create: `components/layout/mobile-shell.tsx`

- [ ] **Step 1: Create `components/layout/mobile-shell.tsx` with this complete implementation**

```tsx
import { BottomNav } from "@/components/layout/bottom-nav";

type MobileShellProps = Readonly<{
  children: React.ReactNode;
}>;

export function MobileShell({ children }: MobileShellProps): React.JSX.Element {
  return (
    <div className="bg-deep min-h-dvh text-text-primary">
      <div className="bg-deep mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden border-x border-border shadow-2xl shadow-black/30">
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-6">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify scroll and desktop centering requirements**

Confirm the outer frame includes:

```tsx
className = "mx-auto flex min-h-dvh w-full max-w-md flex-col ...";
```

Confirm the content area includes:

```tsx
className = "flex-1 overflow-y-auto ...";
```

This keeps content vertically scrollable without being covered by the sticky navigation.

### Task 4: Integrate the mobile shell into the root layout

**Files:**

- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace `app/layout.tsx` with this complete implementation**

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MobileShell } from "@/components/layout/mobile-shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atria ERP",
  description: "Finance-first mobile operating system for interior contractors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="bg-deep min-h-full">
        <MobileShell>{children}</MobileShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Confirm explicit return type remains present**

Check the function signature remains:

```tsx
export default function RootLayout(...): React.JSX.Element
```

### Task 5: Replace the home page with shell-native welcome content

**Files:**

- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx` with this complete implementation**

```tsx
export default function Home(): React.JSX.Element {
  return (
    <section className="flex min-h-[calc(100dvh-7rem)] flex-col justify-between gap-8">
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
          <p className="text-xs font-semibold tracking-[0.24em] text-muted uppercase">Atria ERP</p>
          <div className="mt-5 space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              Finance-first control room for interior projects.
            </h1>
            <p className="text-sm leading-6 text-secondary">
              Pantau proyek, ledger kas, dan pengeluaran lapangan dari satu shell seluler yang siap
              dipakai Project Manager di lapangan.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-border bg-elevated p-4">
            <p className="text-xs font-medium text-muted">Primary workflow</p>
            <p className="mt-1 text-base font-semibold text-text-primary">
              Projects → Ledger → Add Expense → Profile
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-muted">Design foundation</p>
            <p className="mt-1 text-base font-semibold text-text-primary">
              iOS 26 Solid tokens, 48px touch targets, and sticky thumb navigation.
            </p>
          </div>
        </div>
      </div>

      <p className="pb-2 text-center text-xs leading-5 text-muted">
        Gunakan navigasi bawah untuk berpindah ke modul utama Atria ERP.
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Confirm page uses semantic design tokens**

Check the page no longer contains generic boilerplate classes such as:

```tsx
bg - zinc - 50;
text - black;
dark: bg - black;
```

The page should use token classes such as `bg-surface`, `bg-elevated`, `border-border`, `text-text-primary`, `text-secondary`, and `text-muted`.

### Task 6: Verify linting, build, and local dev startup

**Files:**

- No code changes expected unless verification finds a concrete compile or lint error.

- [ ] **Step 1: Run ESLint**

Run:

```bash
bun run lint
```

Expected: ESLint exits successfully with no errors.

- [ ] **Step 2: Run the production build**

Run:

```bash
bun run build
```

Expected: Next.js build exits successfully with no TypeScript or compilation errors.

- [ ] **Step 3: Start the development server just long enough to confirm boot**

Run:

```bash
bun run dev
```

Expected: Next.js dev server starts and logs a local URL, commonly `http://localhost:3000`. Stop the server after confirming startup.

- [ ] **Step 4: If `bun run dev` fails because port 3000 is already in use**

Run:

```bash
bun run dev -- -p 3001
```

Expected: Next.js dev server starts on `http://localhost:3001`. Stop the server after confirming startup.

### Task 7: Inspect the final diff and commit

**Files:**

- All changed files from prior tasks.

- [ ] **Step 1: Review working tree status**

Run:

```bash
git status --short
```

Expected changed files:

```text
M package.json
M bun.lock
M app/layout.tsx
M app/page.tsx
A components/layout/bottom-nav.tsx
A components/layout/mobile-shell.tsx
A docs/plans/2026-06-11-mobile-app-shell-bottom-navigation.md
```

If `bun.lock` does not change because `lucide-react` was already installed, that is acceptable.

- [ ] **Step 2: Review diff**

Run:

```bash
git diff -- app/layout.tsx app/page.tsx components/layout/bottom-nav.tsx components/layout/mobile-shell.tsx package.json
```

Expected: Diff only contains the planned mobile shell, bottom nav, welcome page, and icon dependency changes.

- [ ] **Step 3: Commit using the requested message**

Run:

```bash
git add package.json bun.lock app/layout.tsx app/page.tsx components/layout/bottom-nav.tsx components/layout/mobile-shell.tsx docs/plans/2026-06-11-mobile-app-shell-bottom-navigation.md
git commit -m "feat: implement mobile app shell and sticky bottom navigation"
```

Expected: Commit succeeds.

## Self-Review

1. **Spec coverage:**
   - `components/layout/bottom-nav.tsx` is created with 4 lucide-react menu items: Projects, Ledger, Add Expense, Profile.
   - Bottom nav is sticky, uses `bg-surface`, `border-t border-border`, and active `text-primary`.
   - Touch targets are at least `48x48px` via `min-h-12 min-w-12`.
   - `components/layout/mobile-shell.tsx` is created, centered with `max-w-md`, and uses a scrollable content region.
   - `app/layout.tsx` wraps children with `MobileShell`.
   - `app/page.tsx` becomes a shell-native welcome page.
   - Verification covers lint, production build, and dev server startup with Bun.
   - Commit message matches the user request.

2. **Placeholder scan:** No `TODO`, `TBD`, `implement later`, or incomplete code appears in this plan.

3. **Type consistency:**
   - `BottomNav`, `MobileShell`, `RootLayout`, and `Home` all return `React.JSX.Element`.
   - Navigation item and icon types are defined before use.
   - Component import paths use the configured `@/*` alias.
