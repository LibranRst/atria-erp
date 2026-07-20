# Production Workflow Audit and Zero-Data Simulation Guide

## Goal

Validate Atria ERP's current finance and material-control workflow against the PRD, close high-confidence workflow or safety gaps, and replace the seed-centric finance guide with a production-style, role-based walkthrough that starts from an empty business dataset.

## Scope

1. Map the implemented workflow from schema, permissions, Server Actions, pages, and tests.
2. Audit project setup, budget/RAP/RAB governance, expenses, vendor bills, cash, client invoices/payments, stock, approvals, closing, RBAC, project scoping, and audit logging.
3. Classify findings by production risk and distinguish code defects from intentional MVP limitations.
4. Implement focused fixes for confirmed, bounded defects without rewriting preserved workflows.
5. Run relevant unit/integration tests, lint, and TypeScript/build checks in proportion to the changes.
6. Rewrite `docs/guide/financial_workflow_guide.md` as a from-scratch, multi-role simulation with prerequisites, test data, actions, expected state/value changes, invariants, negative tests, reconciliation checkpoints, and final closing checks.
7. Align supporting flow/technical documentation when implementation behavior differs materially.

## Audit Method

- Treat `docs/01-product/PRD.md` and `AGENTS.md` as product and safety constraints.
- Treat schema, current Server Actions, permissions, and executable tests as implementation evidence.
- Verify every balance or stock mutation for transaction boundaries, reconciliation guards, explicit authorization, and audit logs.
- Verify every project-linked mutation for server-side session and project scoping.
- Verify category-specific links: Material only for RAP/material/stock, Tukang/Subcon only for matching packages.
- Verify approved baselines and reconciled records cannot be silently rewritten.

## Deliverables

- Audit findings and fixes in code/tests.
- Updated production workflow guide.
- Verification results and clearly documented remaining limitations or follow-up recommendations.

## Execution Checklist

- [x] Establish baseline test/type/lint status and inspect current data model.
- [x] Audit auth, RBAC, and project-scoping boundaries.
- [x] Audit project, budget, RAP, RAB, revision, and closing workflows.
- [x] Audit expenses, approvals, vendor bills, invoices, payments, bank accounts, and ledger mutations.
- [x] Audit inventory, goods receipt, reservation, usage, transfer, adjustment, waste, and reversal workflows.
- [x] Implement and test confirmed production-risk fixes.
- [x] Rewrite the zero-data, role-based end-to-end simulation guide.
- [x] Run final verification and record remaining gaps.
