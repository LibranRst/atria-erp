# AI budget summary inspection and synchronization

The chat action inspects one accessible project's canonical budget summaries. It compares pending, consumed, paid, remaining allocation, usage percentage and risk against recorded `project_expenses` and completed vendor payments. All five normal categories participate; extra category rows use five-row pagination.

## Usage

Ask: “Periksa apakah ringkasan budget proyek [nama] sesuai dengan transaksi.” The assistant resolves scoped project references through `getProjects`, asks for a choice when needed, then calls the read-only `inspectProjectBudgetSummary` tool.

- A matching result shows **Sesuai**, with no synchronization action.
- A differing result shows exact before/after values in the card. **Rincian per kategori** is optional and opens the shared grouped review, with a desktop aside and mobile stack.
- **Sinkronkan ringkasan** opens an explicit confirmation. Each comparison names a field that actually differs, including pending-only, paid-only and risk-only discrepancies; every changed field is named.
- Successful synchronization updates only differing derived summaries, records an audit and idempotent AI receipt, and verifies the result again. Risk remains visible: a matching calculation can still be over budget.
- Changed source, expired proof, inaccessible projects, missing budgets and invalid references remain blocking errors with an appropriate recovery action. A confirmed receipt never repeats the write; newly detected differences require a new inspection.

Read rights: `use:ai_chat`, `view:project`, `view:budget` and current tenant/project scope. Commit additionally requires `update:budget`. The actual session Actor is resolved server-side; confirmation accepts only an owned stored conversation/tool identity. Contract, cap, allocations, Settings, expense states, account balances and stock are not repair targets. Existing manual recalculation uses the same locked, audited writer.

## Verification evidence

Browser QA uses `http://127.0.0.1:3004/ai` and the named disposable `atria_audit_reconciliation` database. The visible conversation is **QA pemeriksaan & sinkronisasi budget**. Real application/UI/API/session/database operations were used with explicitly synthetic stored tool outputs. The live model's tool selection and conversational behavior were not certified in this run.

- Eleven real Postgres integration cases pass: read-only inspection, audited repair, no-op, stale status changes, concurrent replay, expiry/ownership/strict input, revoked grants, assigned/NONE/foreign scope, rollback, new discrepancies after confirmation, invalid/missing sources and the shared manual writer.
- Workspace tests, API/web/mobile typechecks, full workspace build, latest web build, lint and HeroUI styles checks pass. Lint retains one pre-existing Material Master hook warning. Repository-wide formatting still reports unrelated baseline failures; the new seed formatting issue was corrected and modified executable targets pass scoped checks.
- Desktop 1024/1280/1440 and mobile 320/360/390/430 show no document, sheet or money overflow. Coarse-pointer mobile commits and close controls are48px; compact row controls use the shared48px effective target through their pseudo-element. Resizing retains the overlay and open row.
- A real Browser approval repairs two categories and yields exactly one audit and one receipt. The source hash is unchanged across the reviewed operation: project/budget source fields, allocation/reference fields, expenses, cash, stock, banks, vendor payments and Settings are identical. Category identity order is aligned with the baseline so PostgreSQL physical row order after UPDATE cannot appear as a source change.
- Fresh Impeccable finish review: **ship**. Its one material finding—confirmation naming Terpakai even for a pending-only discrepancy—was corrected and verified with a settled pending-only confirmation.

Evidence lives under `output/ai-chat-qa/budget-sync/`: `business-invariants.json`, `viewports.json`, `mobile-viewports.json`, `confirmation-pending-settled.png`, `saved-desktop-settled.png`, `verified-mobile.png`, `stale-identity-settled.png` and compact card captures. Earlier immediate post-click images may show an animation frame; the explicitly settled images are authoritative. `saved-mobile-settled.png` captured the stale card; use `verified-mobile.png` for the actual saved mobile state.

No deployment or production/development business mutation was performed. QA operator scripts enforce the named loopback disposable database and synthetic actor/conversation boundary.
