# Project Activation Readiness Prompt

## Decision

Project activation remains an explicit Owner or Finance Admin decision. When a
Draft project has an approved canonical Project Budget, a locked RAP baseline,
and an approved client RAB sourced from that RAP, the project workspace prompts
the operator to activate it.

The prompt is a contextual bottom sheet, not an automatic state transition. It
states the three completed safeguards and the operational consequence: expense,
vendor-bill, invoice, goods-receipt, and project stock workflows become
available after activation.

## Implementation

- Derive readiness from canonical records in the project detail view.
- Render the existing bottom-sheet primitive only for a Draft project with all
  three safeguards and an Owner/Finance Admin viewer; provide an explicit
  `Aktifkan proyek` confirmation action.
- Add a dedicated server action that revalidates every safeguard in a locked
  transaction, sets the project to `ACTIVE`, writes `audit_log`, and refreshes
  the project route.
- Keep the status selector as the existing manual fallback; no database schema
  change or auto-activation is introduced.

## Motion

Existing BottomSheet slide/fade only. No page, tab, list, or decorative motion
is added.
