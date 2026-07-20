# Phase 1: Project Setup and Design Foundation Implementation Plan

**Goal:** Initialize the Next.js App Router project using Bun, TypeScript, Tailwind CSS, and shadcn/ui, and establish the HSL color palette and base mobile app shell layout.

**Architecture:** A mobile-first Next.js responsive app structure. We'll set up `global.css` with solid HSL tokens (slate background, deep indigo primary, emerald success, amber warning, coral critical) and configure the app shell containing a sticky bottom navigation bar.

**Tech Stack:** Bun, Next.js 14/15, TypeScript, Tailwind CSS, lucide-react.

---

## User Review Required

None. The design tokens match the agreed iOS 26 Solid theme.

## Proposed Changes

We will initialize the project in the root folder `./` and modify/create the following files:
- Create Next.js project structure
- [NEW] `tailwind.config.ts` (or equivalent Tailwind CSS configuration file)
- [NEW] `app/globals.css` (custom HSL color palette and base utility classes)
- [NEW] `app/layout.tsx` (Root layout with global providers)
- [NEW] `app/page.tsx` (Clean placeholder dashboard entry)
- [NEW] `components/layout/mobile-shell.tsx` (App Shell layout wrapper)
- [NEW] `components/layout/bottom-nav.tsx` (Sticky bottom navigation bar)

---

## Tasks

### Task 1: Initialize Next.js Project

**Files:**
- Create: `./` (Next.js initialization)

- [ ] **Step 1: Check create-next-app help options**
  Run: `npx -y create-next-app@latest --help`
  Expected: Prints all CLI flags for create-next-app.

- [ ] **Step 2: Initialize Next.js project**
  Run: `npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-bun`
  Expected: Next.js project scaffolded in the current directory.

- [ ] **Step 3: Verify installation**
  Run: `bun run dev` (run for 2-3 seconds, verify it compiles and runs without errors, then close)
  Expected: Compiles and listens on `http://localhost:3000`.

- [ ] **Step 4: Commit**
  Run: `git add package.json tsconfig.json app/ && git commit -m "chore: initialize Next.js app router project with Bun"`

### Task 2: Configure HSL Colors & Tailwind (Design Tokens)

**Files:**
- Modify: `tailwind.config.ts` (Configure colors, radii, and container)
- Modify: `app/globals.css` (Include solid HSL CSS variables for light/dark mode)

- [ ] **Step 1: Write custom design tokens in CSS**
  Update `app/globals.css` to define HSL slate backgrounds, deep indigos primary (`color-primary`), emerald success, amber warning, coral critical, and responsive layouts. Ensure WCAG contrast standards.
- [ ] **Step 2: Update Tailwind configuration**
  Map the new HSL variables in `tailwind.config.ts` to Tailwind utility classes.
- [ ] **Step 3: Commit**
  Run: `git add tailwind.config.ts app/globals.css && git commit -m "style: configure solid HSL design system tokens"`

### Task 3: Build Sticky Bottom Navigation & Mobile App Shell

**Files:**
- Create: `components/layout/bottom-nav.tsx` (Sticky navigation bar)
- Create: `components/layout/mobile-shell.tsx` (Main shell wrapping bottom navigation)
- Modify: `app/layout.tsx` (Inject the mobile shell wrapper)
- Modify: `app/page.tsx` (Dashboard home screen shell layout)

- [ ] **Step 1: Create Bottom Navigation component**
  Write `components/layout/bottom-nav.tsx` using `lucide-react` icons (Projects, Ledger, Add Expense, Profile) with touch targets strictly $\ge 48\times 48\text{px}$.
- [ ] **Step 2: Create Mobile Shell component**
  Write `components/layout/mobile-shell.tsx` to wrap the app view with a sticky header and sticky bottom bar, enforcing responsive max-width layout on desktop.
- [ ] **Step 3: Update Root Layout**
  Integrate the `MobileShell` wrapper into `app/layout.tsx`.
- [ ] **Step 4: Verify App compiles and runs**
  Run: `bun run dev` (verify navigation works, icons display, colors match, and mobile shell renders correctly)
- [ ] **Step 5: Commit**
  Run: `git add components/ app/layout.tsx app/page.tsx && git commit -m "feat: implement mobile app shell and sticky bottom navigation"`

---

## Verification Plan

### Manual Verification
- Deploy Next.js dev server locally via `bun run dev`.
- Inspect UI at `http://localhost:3000` inside browser mobile simulator.
- Verify touch target dimensions are larger than $44\text{px}$.
- Verify HSL background color matches solid slate/charcoal gray theme and has no transparency/frosted blur.
