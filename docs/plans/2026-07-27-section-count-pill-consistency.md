# Section Count Pill Consistency

## Goal

Unify trailing section-header counts across Atria main surfaces without turning status, dates,
progress, or contextual metadata into badges.

## Contract

- Cardinal workload counts use one compact neutral `SectionCountPill`.
- The outer pill carries the noun label; the inner `CountBadge` carries the number.
- Status, period, ratio/progress, and descriptive metadata remain plain text.
- A section action takes precedence over a count when both would compete for the same trailing slot.
- No page, section, or list animation is added.

## Scope

- Shared Dashboard detail sections.
- Material & Stok main sections and opening-inventory history/setup sections.
- Expenses list sections.
- Projects list result section.
- Design-language and control-language documentation.

## Verification

- Static presentation tests for the shared pill and migrated section headers.
- Existing Approval, Material, Expenses, and Dashboard regression tests.
- ESLint, TypeScript, formatting, and diff check.
