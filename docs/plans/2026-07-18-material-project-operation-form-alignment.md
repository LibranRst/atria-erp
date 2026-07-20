# Material Project Operation Form Alignment

## Goal

Align Reservasi, Pemakaian, Pengembalian Sisa, and Material Terbuang with the approved Atria grouped-form language used by Penerimaan Barang, both in the global Material workspace and inside project stock control.

## UI contract

- Hierarchy: operation context, project/RAP/material identity, inventory location, quantity and live stock impact, then the audit note and review step.
- Surfaces: one grouped `FormSection` for context/location and one grouped `FormSection` for quantity/note; stock impact and warnings remain contextual state surfaces outside those groups.
- Controls: grouped selectors, quantity stepper, and textarea stay borderless inside the owning white surface with internal dividers; no nested standalone capsules around ordinary fields.
- States: preserve server errors, incomplete-field guidance, unsaved-change confirmation, explicit review, destructive waste confirmation where already required, durable success, and pending submit behavior.
- Copy: concise Bahasa Indonesia, with the result and stock consequence specific to each operation.
- Motion: existing sheet slide/fade and segmented-tab pill only; no new field, section, or content animation.

## Implementation

1. Recompose the global project material operation sheet with grouped sections, specific helpers, required/optional labels, live inventory context, and a precise disabled reason.
2. Apply the same hierarchy and field grammar to the project-detail stock operation sheet, retaining its fixed-project context and operation switcher.
3. Audit adjacent material operation forms; align the inconsistent emergency adjustment fields while keeping already-grouped receipt, transfer, opname, and location forms intact.
4. Verify strict TypeScript, focused lint/tests, and mobile rendering at 320, 360, 390, and 430 px without triggering a stock mutation.
