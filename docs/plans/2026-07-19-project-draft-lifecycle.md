# Project Draft Lifecycle

## Decision

New projects start as `DRAFT`. Draft is a setup phase: the team may complete
project identity, Project Budget, RAP, and RAB, but may not create operational
financial transactions or project-linked stock movements.

An Owner or Finance Admin activates the project manually by changing its status
to `ACTIVE` in the existing project edit workflow. No budget or RAB approval is
required to activate the project.

## Implementation

- Default the new-project form and server validation to `DRAFT`.
- Explain in the form review and success state that activation is required
  before operational work begins.
- Use a shared server-side operational-status assertion for expense requests,
  vendor bills, client invoices, goods receipts, and project-linked stock
  operations. UI filters remain a convenience only.
- Preserve existing projects and all Draft planning actions; no migration is
  required.

## Verification

- Test the Draft default in the form model and server schema.
- Test that Draft projects are rejected by operational status guards and that
  active projects continue through the same guard.
- Verify Draft projects remain visible and editable in the project workspace,
  while expense selectors continue to expose Active projects only.
