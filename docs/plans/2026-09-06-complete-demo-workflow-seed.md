# Complete Demo Workflow Seed

## Objective

Turn the connected demo database into a reliable UI acceptance dataset for project lifecycle,
budget approval, RAP setup, client RAB, Change Order approval, finance approvals, material control,
and notification states. Keep the existing finance and reconciliation walkthrough intact.

## Scenario matrix

| Project              | Baseline state                                                                  | UI flow covered                                                 |
| -------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Pakubuwono Apartment | Draft project, Project Budget pending approval                                  | Owner budget approve/reject and locked downstream tabs          |
| Cipete House         | Approved budget, RAP draft at Review with complete Material/Tukang/Subcon scope | Finalize internal plan, generate initial RAB                    |
| Brawijaya Residence  | Approved budget, locked RAP, mixed-source initial RAB draft                     | RAB item editing, bundle, hidden line, approval                 |
| Sudirman Suites      | Approved RAB R1, RAP/RAB R2, client-confirmed Change Order pending approval     | Revision comparison, maker-checker approval, superseded history |
| Menteng Villa        | Approved execution baseline plus a cancelled RAB revision                       | Live finance/material detail and cancelled revision history     |
| Senopati Office      | Fully settled active project                                                    | Closing readiness and completion                                |
| Kemang / BSD / PIK   | On hold / completed / cancelled                                                 | Project list lifecycle filters                                  |

The approval queue also receives baseline-visible verified field-cost cases so its normal and
critical filters can be tested before the walkthrough mutates any data. Existing submitted costs,
vendor payment approval, and inventory-opening approval remain unchanged.

## Implementation

1. Extend stable demo IDs for the two new projects and their workflow documents.
2. Seed coherent canonical budgets and category allocations for every active workflow scenario.
3. Seed RAP material rows and Tukang/Subcon packages using only implemented setup stages.
4. Seed client-safe RAB rows from Material, category package, manual, bundle, and hidden-line sources.
5. Seed pending and cancelled Change Orders without inventing approval stages.
6. Add baseline-visible approval items isolated from the existing finance walkthrough.
7. Strengthen the read-only verifier for project/RAP/RAB/Change Order relationships and scenario
   states.
8. Restore canonical Project Budget submit/approve/reject controls in the current Overview so the
   seeded pending state is actionable without reviving legacy budget mutations.
9. Rewrite the seeded demo guide around exact starting states, roles, actions, reset effects, and
   expected transitions.

## Verification and reset

- Run seed contract, project/RAP/RAB, approval, finance, and material regression tests.
- Run TypeScript, lint, formatting, and production build.
- Run `bun run db:demo:reset --confirm-reset` only after code verification.
- Run `bun run db:demo:verify` and inspect the seeded routes on the connected demo database.
- Do not run the destructive generic database reset and do not modify user databases outside the
  guarded demo reset target.
