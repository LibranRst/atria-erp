# Settings Financial Tab UI

## Goal

Refine the Settings financial tab into a mobile-first “understand, then edit” flow while preserving the canonical budget formulas, five expense categories, approval semantics, and existing server actions.

## Direction

- Keep one inverse financial summary for budget cap, target margin, allocated ratio, and buffer.
- Present formula, category allocation, and approval thresholds as calm grouped sections.
- Move formula editing into its own operational sheet; expose the local project-value simulation through an optional disclosure.
- Keep category allocation as a batch inline edit mode with its own save/cancel checkpoint and discard confirmation.
- Keep category metadata in a full-row detail/edit sheet, with separate expense-category permission handling.
- Render approval controls independently from budget-default availability.

## Safety and Verification

- Do not change database schema, formulas, category codes, threshold semantics, or server mutation contracts.
- Reuse public Atria UI primitives and semantic tokens only.
- Cover permissions, read/edit modes, over-allocation, discard confirmation, false dirty state, missing budget defaults, and raw enum prevention.
- Verify focused tests, TypeScript, lint/format, and the 320/360/390/430px layouts.
