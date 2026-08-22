# Rule: Shared UI First

This rule governs every UI change in `apps/web`. Its purpose is to keep one interaction contract, one accessibility implementation, and one visual language instead of accumulating feature-local copies.

## 1. Inventory Before Implementation

Before creating or styling a control, form field, status, card, list row, navigation element, money display, overlay, or motion wrapper:

1. Read the public inventory in `apps/web/components/ui/index.ts`.
2. Search `apps/web/components/ui/**` and its stories/tests for a component with the same user intent or interaction contract.
3. Read the relevant taxonomy in `DESIGN.md`; for overlays and selection controls, use the contextual surface rules there.
4. Inspect an existing production call site before deciding that a new primitive is necessary.

The required decision order is:

1. **Reuse** the existing primitive unchanged.
2. **Compose or extend** it through a small, generally useful prop or semantic wrapper.
3. **Create** a new shared primitive only when the existing interfaces cannot represent the behavior without changing their meaning.

Do not create a feature-local parallel primitive because its markup appears quicker to write. If deleting the proposed component would leave only a small composition of existing shared primitives, use that composition instead.

## 2. Ownership Boundary

- Domain-agnostic behavior belongs in `components/ui/**` and is imported by application code only from `@/components/ui`.
- Feature components may own business copy, data mapping, workflow state, and compositions of shared primitives.
- Feature components must not duplicate portal, focus-management, dismissal, collision, keyboard, tooltip, listbox, dialog, sheet, money-formatting, touch-target, or motion infrastructure already owned by shared UI.
- A new shared primitive is justified when its interaction contract is materially distinct and it has a cross-cutting owner or at least two credible consumers. A one-off domain composition stays in its feature.
- Extending a shared primitive must preserve current call sites and keep domain-specific rules out of the primitive API.

## 3. Canonical Contextual Surfaces

Use the existing taxonomy rather than recreating an overlay locally:

- Local commands: `ActionMenu`.
- Short single selection: `AdaptiveSelect` anchored listbox.
- Contextual 3–6 option selection: `SelectionDialog`.
- Search, grouping, custom values, combobox, or larger option sets: `SearchDialog` / `ComboboxField`.
- One or two compact form fields: `CompactFormDialog`.
- Date selection: `CalendarDialog` / `DatePickerField`.
- Irreversible decision: `ConfirmationDialog`.
- Operation result: `SuccessDialog` / `OperationSuccessDialog`.
- Two secondary draft filters: `AnchoredFilterPanel`.
- Three or more related form fields: `FormSheet`, usually through `OperationalFormSheet` or `WorkflowFormSheet`.
- Read-only contextual detail needing room or scroll: `DetailSheet`.
- Lightweight disclosure/help: `ContextPopover` or `Tooltip` according to `DESIGN.md`.

Raw `BottomSheet`, `DialogFrame`, portals, Floating UI, and overlay stack internals are implementation details of `components/ui`; consumer code does not use them directly.

## 4. Adding or Extending Shared UI

When a new primitive is genuinely required:

- Implement it under the appropriate `components/ui/**` family and export it from `apps/web/components/ui/index.ts`.
- Reuse semantic tokens, `AppIcon`, motion presets, and existing focus/touch-target contracts.
- Add focused tests and a story or representative fixture for meaningful visual states.
- Update `DESIGN.md` when the component introduces a new interaction rule or changes the taxonomy.
- Extend an architecture test when the ownership boundary can be enforced mechanically.

In the final handoff, state which existing primitive was reused or extended. If a new primitive was added, state why the current inventory could not represent the behavior and name its intended consumers.
