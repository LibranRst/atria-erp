---
name: atria-qa
description: Runs diagnostic checks, automated quality gates, TypeScript validation, ESLint canonical checks, demo database reset, and seed invariant verification for Atria ERP. Use when verifying changes, checking build health, resetting test databases, or validating financial/demo seed integrity.
---

# Atria ERP Quality Assurance & Diagnostic Runbook

This skill provides step-by-step guidance for running quality assurance, type checks, linting, and database verification scripts in **Atria ERP**.

---

## 1. Automated Quality Gates

Run these commands before declaring any feature or bugfix complete:

### A. TypeScript Type Check
Ensure strict type safety across all files (no `any`, valid server action returns):
```bash
bun x tsc --noEmit
```

### B. ESLint & Tailwind Canonical Classes Check
Ensure code formatting and canonical Tailwind class order:
```bash
bun run lint
```
To auto-fix linting issues:
```bash
bun run lint:fix
bun run tailwind:canonical
```

### C. Formatting Check
```bash
bun run format:check
```

---

## 2. Database & Seed Invariant Verification

### Reset and Seed Minimal Database
```bash
bun run db:reset
bun run db:seed
```

### Reset Demo Database (Connected Dataset for Verification)
```bash
bun run db:demo:reset
```

### Verify Demo Seed Integrity
Runs automated checks ensuring cash balances, project budgets, and stock levels match expected demo invariants:
```bash
bun run db:demo:verify
```

---

## 3. Storybook UI Component Verification
To test and visually inspect isolated UI components:
```bash
bun run storybook
```

---

## 4. Pre-Release Acceptance Checklist

- [ ] `pnpm tsc --noEmit` passes with 0 errors.
- [ ] `bun run lint` passes with 0 errors.
- [ ] `bun run db:demo:verify` confirms financial and inventory invariants.
- [ ] Tested on 375px mobile viewport dimensions.
- [ ] No raw enum strings or English technical terms exposed in Indonesian user-facing views.
