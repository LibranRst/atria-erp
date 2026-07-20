# Unified Form Input System Redesign

## Summary
Unify all non-login form and filter controls around a shared mobile-first Atria form system. Inputs should feel calm, premium, operational, and clear in empty, pre-filled, edit, disabled, and read-only states.

## Key Changes
- Add shared controls in `components/ui/form-controls.tsx` for persistent field labels, text/textarea inputs, money inputs, quantity steppers, sheet selects, comboboxes with custom values, custom date picking, choice rows/groups, search fields, and compact filter selects.
- Replace native-looking select, date, and number controls across drawers, bottom sheets, embedded forms, settings forms, stock operations, finance flows, project forms, and input-like filters.
- Preserve existing server actions, schemas, and stored string fields. Unit and area/room fields use seeded suggestions plus custom values without requiring schema migration.

## Test Plan
- Run `bun run lint`.
- Run `bun run build`.
- Manually verify Add Expense, Project create/edit, Vendor Bill, payment/disbursement, Client Invoice, stock operations, RAP/RAB forms, Settings forms, and list filters at mobile shell width.

## Assumptions
- Login form is excluded.
- No new dependency is introduced.
- Existing form data model remains unchanged unless a small type-safe prop is needed to render useful option metadata.
