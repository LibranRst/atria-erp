# Complete remaining AI RAP actions

Approved scope: finish remaining internal RAP actions and soften the desktop table header to match its owning surface. RAB, procurement, inventory and cash flows remain separate domains.

- Add immutable owned lifecycle proposals for explicit Edit Lagi / delete Draft package batches and new Draft revisions of locked RAP / selected locked packages. Read all category budgets first; disclose exact targets, reason and baseline consequences. Never revise historical/superseded sources or infer selected scopes.
- Extract transactional revision writers shared by ordinary manual actions and AI. Serialize with project/latest RAP/package locks, check dynamic permissions and assignment, reject existing revisions and preserve locked source records. AI subset revision commits RAP and selected package copies, audit and receipt together. Package-only revision also prepares the editable RAP revision needed for subsequent package edits, retaining Material baseline values.
- Complete Material library copies and manual items through ADD_MATERIAL lifecycle proposals, with shared Settings resolver/writer, explicit quantities and reasoned cost overrides. Preserve source library and suggested client price snapshots without generating RAB.
- Extend saved Draft RAP edits to explicit identity/detail fields accepted by manual inputs. Resolve changed Material Master identities server-side with authoritative name/unit; preserve unspecified values, validate active references and expose before/after differences. No automatic unit conversion.
- Register fixed owned read/confirm operations, typed HTTP facades, model read-only tools, capability/prompt/response handling and coverage documentation. Stored proof expiry is 30 days; confirmation accepts identity only, rebuilds against fresh context, locks all affected references, and coalesces retries. Delete requires a second confirmation.
- Reuse ProposalCardShell, FormSheet, GroupedSurface, FactRow, FormDisclosure, DesktopTable, MoneyValue and ConfirmationDialog. Keep natural sheet height, responsive table/aside, five/ten-row pagination and resize state.
- Desktop header inherits the table owner's low surface; white embedded review tables retain the slightly distinct low header. Sorting, focus, density and mobile semantics remain unchanged.

Verification: core contracts; lifecycle ownership/permission/expiry/stale/closed-project checks; disposable Postgres through ATRIA_TEST_DATABASE_URL for revision/reopen/delete, concurrent manual/AI writes, replay/atomic rollback and unchanged cash/stock; component confirmation protection. Dev Browser at 320/360/390/430 and 1024/1280/1440. Workspace gates, documentation parity and graph refresh. No development business data is mutated for QA.

## Delivered verification

- Lifecycle revision/reopen/delete and manual/library Material additions, plus explicit saved-item identity/detail corrections, are registered in the model catalog and fixed typed operations. Manual revision/template operations share transactional writers. Locked baselines, money, inventory and financial usage remain unchanged.
- Workspace tests: 1,977 passed. Disposable PostgreSQL regression: 31 passed across lifecycle, saved RAP changes, package planning and finalization; includes manual/AI races, replay, dynamic role revocation, rollback, active library snapshots and unit-change guards. DOM confirmation checks cover delete/cancel/double-click/stale cases and action-specific saved guidance.
- API/web/mobile typechecks, workspace lint and all application builds pass. Lint retains one pre-existing Material Master effect-dependency warning. Changed files pass formatting; global formatting still reports unrelated pre-existing files.
- Dev Browser confirms the table header and owning surface both use RGB239/239/242 with RGB58/58/60 labels. Review has no document overflow at all seven supported widths. Mobile/desktop pagination keeps its anchor and expanded detail across resize. Synthetic stale and saved-state QA records contain no business RAP/package/material mutation; saved receipts are clearly marked visual simulations.
- Evidence is under `output/ai-chat-qa/rap-remaining/`. Existing design rules and sidecar retain exact parity; graph refreshed. Finish review's sole copy finding is resolved in source and saved-state captures; final disposition is ship with no remaining material findings.

## Revision budget detail placement

User requested expanded financial detail in the wide left review area on desktop, retaining the concise budget verdict/plan/cap and protected actions on the right. Revision details remain inside the budget summary on mobile. Reuse the incumbent `px-4` disclosure wrapper and `FactRow inset={false}` pattern from RAP draft and category package review; no new shared primitive is needed. Controlled disclosure state follows the review across resize. Other lifecycle actions retain their existing detail location with the same fixed inset.

Verification: Dev Browser at all seven canonical widths plus the annotated535px viewport confirms16px left/right disclosure clearance, retained expansion through resize and no document overflow. Collapsed/expanded evidence is in `output/ai-chat-qa/rap-detail-layout/`. Existing confirmation DOM test, scoped lint, web typecheck/build and layout detector pass. Design rule/sidecar parity is retained.

## Consistent budget detail placement across reviews

User extended the adjustment to every AI review with secondary budget detail. Apply it to RAP create/append, Tukang/Subcon package create/edit, RAP readiness/finalization (“Kategori & realisasi”), and all lifecycle actions. Desktop main content owns financial disclosures after reviewed rows; the aside keeps primary budget/risk facts and actions. Mobile retains disclosures inside the owning summaries with one16px inset. Retain independent category expansion and all editing/pagination state; shared FormSheet, FormDisclosure, FactRow, GroupedSurface and MoneyValue remain authoritative. Saved RAP changes have only primary budget facts, so no detail is moved there. No business calculations, permissions or mutations change.

Verification: all four review types in dev Browser at320/360/390/430/1024/1280/1440 retain disclosure state without document overflow. Each trigger has16px clearance on both sides; desktop main controls span640–688px. Tukang/Subcon retain independent expansion. Evidence: `output/ai-chat-qa/all-budget-detail/`. Four existing DOM guard tests, scoped lint/format, web typecheck/build and layout detector pass. Four design-rule updates retain exact sidecar parity; no development business mutations were performed.

Finish review reports ship with no material findings; the shared control, editor-state and confirmation contracts remain intact.
