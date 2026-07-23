# Atria Control Language

This is the canonical contract for actions, status treatments, and color tokens. Read it with the active main-surface design language before introducing or changing a UI control.

## Action Hierarchy

| Role                  | Primitive                           | Visual contract                                     | Use                                                  |
| --------------------- | ----------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Primary commit        | `Button` `primary`                  | Black capsule, 48px minimum                         | One obvious action per surface or sheet              |
| Secondary safe action | `Button` `secondary`                | White grouped-surface capsule                       | Supporting action when it must remain visible        |
| Tertiary navigation   | `Button`/`SectionAction` `tertiary` | Accent-blue text; section action is a light-blue capsule | Drill-down, view-all, reversible low-emphasis action |
| Risk entry            | `Button` `criticalQuiet`            | Restrained critical container                       | Opens a destructive confirmation or risky review     |
| Irreversible commit   | `Button` `critical`                 | Solid critical capsule                              | Only after explicit confirmation/reason              |
| Context icon          | `IconButton`                        | 48px target and mandatory accessible label          | A familiar, contextual action only                   |

Compact visible controls may be 32–40px only when their interactive target remains 48px. Do not use a generic button for tabs, filters, row navigation, toggles, or option selection.

## Sheets and Forms

`SheetFooterActions` orders content as status/reason, then its actions. A single primary action is full-width. When a safe secondary action is present, render it beside the primary in two equal columns; both remain 48px capsule controls with no wrapping. A sheet header provides close/navigation only; it never submits or commits. Existing `OperationalFormSheet`, `WorkflowFormSheet`, and confirmation primitives use this contract.

## Badges, Counts, and Metadata

| Type                     | Primitive      | Contract                                                                      |
| ------------------------ | -------------- | ----------------------------------------------------------------------------- |
| Semantic state           | `StatusBadge`  | 24px capsule, 9px label, semantic tone, dot only for pending/warning/critical |
| Actionable count         | `CountBadge`   | Compact numeric counter; requires an accessible item label                    |
| Compact neutral metadata | `MetadataChip` | Neutral only; use sparingly when plain context text is insufficient           |

Status badge tones are `healthy`, `warning`, `critical`, `pending`, `completed`, `neutral`, and `inactive`. Domain data is mapped into this vocabulary at presentation boundaries; never cast a database enum into a badge or display a raw code. Omit a neutral badge when it does not improve scanning.

## Color Tokens

- `primary` / `on-primary`: commit actions.
- `accent` / `accent-container`: iOS-blue focus, selection, tertiary navigation, and selected options.
- `success`, `warning`, `critical` and their `-container` tokens: operational status only.
- `error`: field validation and failed input feedback; it is not an alternative primary action.
- Surface and outline tokens own neutral backgrounds, borders, and inverse focal surfaces.

Raw semantic palette utilities and hex values are prohibited in UI source. Allowed exceptions are the CSS token definitions, configured bank-card gradient values, image/media content, and inverse-surface opacity layers that cannot be expressed by an existing token.

## Icon Policy

- Use the shared typed `AppIcon` mapping backed by Phosphor Icons for every user-facing UI icon. Default to `regular`; use `fill` only for an explicit active navigation state.
- Do not introduce Material Symbols, icon fonts, or raw glyph-name text into UI markup.
- Keep icon-only controls accessible through `IconButton` labels; icons beside visible labels are decorative.
- Preserve semantic icon choice, tone, and local size. Do not add icon animation unless an existing motion contract already requires it.

## Audit Matrix

| Domain                                               | Existing control families                                        | Migration target                                          | Status / exception                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| Shared UI and shell                                  | form actions, bottom sheets, tabs, filters, page states          | Button family, SheetFooterActions, StatusBadge/CountBadge | Shared primitives migrated; tabs and filters remain specialized |
| Dashboard, approvals, reconciliation, bank accounts  | section actions, review/commit actions, operational status pills | SectionAction, Button hierarchy, status presentation      | Bank gradients remain identity exceptions                       |
| Expenses and finance forms                           | draft, review, payment, receipt, vendor bill actions             | SheetFooterActions and typed status presentation          | Financial mutation logic unchanged                              |
| Materials and inventory                              | stock operation sheets, low-stock status, selection actions      | Button hierarchy and StatusBadge                          | Material category/budget context remains unchanged              |
| Projects (list/detail/Budget/RAP/RAB/stock/invoices) | workflow actions, lifecycle chips, client-safe actions           | Button hierarchy and domain status mapping                | Client-safe RAB boundaries unchanged                            |
| Settings, onboarding, profile, administration        | setup actions, role/status chips, configuration forms            | Button hierarchy and StatusBadge                          | No finance-default permission changes                           |

Each implementation change should update the applicable row when a new exception is introduced.
