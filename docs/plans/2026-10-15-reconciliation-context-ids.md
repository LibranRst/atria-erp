# Reconciliation context identity fix

## Scope

The real development `/reconciliation` bank-row detail returns “Identitas pasangan rekonsiliasi tidak valid.” for the existing statement ID `eeeeeeee-eeee-eeee-eeee-eeeeeeeeee09`. Reproduce the exact identity through the shared input contract and API read seam before changing validation. Inspect the desktop account filter for the same identity-contract mismatch.

Align these read-only contracts with the repository's canonical database UUID syntax while retaining malformed-ID rejection, exactly-one-source validation, actor permission, GLOBAL scope, tenant isolation, and account/direction/cents candidate matching. No UI redesign, writer changes, database reset, seed, balance change or matching mutation is authorized for QA.

## Verification

1. Add and run a regression that fails on the real historical ID.
2. Test the minimal cause, apply the scoped validation fix, and rerun contract/API tests with malformed, dual/missing IDs and access fences.
3. Retry the selected detail and the sibling source/account filters in the actual dev website without confirming a match.
4. Run scoped type/lint/format checks, update this record and refresh Graft. Leave the real app open for the user.

## Status

Completed. Plan was saved before executable changes.

The strict Zod UUID validator rejected historical PostgreSQL IDs without RFC version/variant bits before the context reader could query candidates. The desktop account filter had the same mismatch. Both read contracts now reuse one private database-ID validator with the canonical hexadecimal UUID shape; malformed identities and the exactly-one-source rule remain enforced. No UI primitives or mutation behavior changed.

## Evidence

- RED: the exact observed statement ID and a historical account ID failed the shared contract tests. The API seam also failed on a stored historical statement ID. The real website reproduced the error before the fix.
- GREEN: five shared contract tests (24 assertions) and the API read regression passed. The API fixture covers both source directions, historical account filtering, malformed/missing/dual identities rejected before reads, inactive/denied/assigned-scope actors, tenant-fenced queries, and exact account/direction/cents candidate matching.
- Real development app: both bank rows now show their corresponding Atria candidates; the reverse Catatan Atria view also loads its bank candidate. Filtering to Kas Kecil PM Budi returns one result with its detail. The dev client was reloaded to pick up the changed shared validation. No match was confirmed and no financial data was changed.
- Core and API TypeScript checks passed. Scoped core/API ESLint and formatting checks passed. Browser proof is saved in `/tmp/atria-reconciliation-context-proof/`.
- The existing web reconciliation DOM regression passed (focus, URL filters, response ordering, narrow selection and history dates). Graft was refreshed after the changes.
