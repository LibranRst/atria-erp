# Dashboard and Project Overview Redesign

## Goal

Redesign the Owner/Finance Dashboard and Project Overview as calm, mobile-first operational summaries. Primary values must be readable without wrapping, exceptions must be actionable, and secondary detail must use progressive disclosure.

## Dashboard

- Replace the Budget/Stock/Activity tabs with one financial-first flow: financial pulse, three role-ranked priorities, risky projects, five compact category rows, and five recent transactions.
- Aggregate project budget KPIs from active projects only. Company cash and open receivable/payable balances remain company-wide and exclude void records.
- Calculate receivable and payable outstanding balances after recorded payments.
- Rank Owner priorities as approvals, project/category risk, overdue finance, then material issues. Rank Finance priorities as overdue payables, overdue receivables, finance work, then project/material risk.
- Show AI briefing only when a useful completed insight exists.
- Add focused query links for project health and material needs.

## Project Overview

- Replace the large cover hero with a compact identity header and project-detail bottom sheet.
- Show one financial health card with remaining budget and usage as the primary signals.
- Add compact readiness states for RAB, RAP, Material, and Tagihan.
- Show at most three real blockers/actions.
- Render all five budget categories as compact rows; open full financial detail and contextual navigation in a bottom sheet.
- Remove duplicated metric blocks, generic recommendations, and the always-visible project profile section.

## Verification

- Unit test active-project aggregation, post-payment outstanding balances, and role-specific priority ordering.
- Verify healthy, setup, draft, approved, shortage, overdue, and over-budget project states.
- Verify query deep links, bottom-sheet keyboard behavior, and 320/390/430 px layouts.
- Run the full test suite, ESLint, TypeScript, and production build.
