# AI workflow verification and remaining business inputs

Approved scope: (1) verify complete chat workflows, ambiguity, corrections, attachments, cancellation/reopen and permission differences; (2) reconcile registered operation coverage with actual capability and confirmation paths; (3) implement the verified high-value gaps: client invoice/schedule creation, linked RAB source refresh and company budget configuration.

## Contracts and implementation

- Preserve the existing responsive chat, adaptive review policy, grouped rows and five-row review pagination. Reuse ProposalCardShell, ProposalReviewSheet, shared proposal details, MoneyValue, FormDisclosure and ConfirmationDialog. Small complete changes remain directly reviewable on their card; company configuration requires protected confirmation.
- Model tools only read context and construct proposals. Business writes require an owned stored proposal, current Actor/permissions/project scope, fresh source fingerprint and explicit user confirmation. Receipt, audit and business writes commit in one transaction. No invoice creation changes cash or marks an invoice paid.
- Extract client invoice/schedule transactional writers from the manual operations while preserving public signatures. Validate positive bounded amounts, distinct numbers and complete installment totals; lock the tenant project before checking active schedules. Preserve the manual domain behavior and prevent concurrent duplicate schedules.
- Extend existing RAB workflow with refresh of linked Draft sources. Preview exact client-safe before/after fields, derived total and affected rows, preserve manual labels/notes/bundles, revalidate the entire source snapshot at confirmation and call the shared writer. Approved/void/noneditable sources remain protected.
- Add budget Settings proposals using the manual validation/resolver and shared transactional writer. Preview cap, margin and category defaults from Settings; reject invalid allocations and unauthorized Purchasing/roles lacking Settings grants. Make clear that defaults affect future setup, without silently recalculating existing projects. Approval/security configuration remains a separate manual workflow.
- Register fixed operations and typed web facades/contracts. Extend permission-filtered capability answers, tool labels, read-only/schema guards, adaptive review and render dispatch.

## Verification

- Deterministic contract and permission tests plus disposable Postgres integration through ATRIA_TEST_DATABASE_URL: ownership, revoked grants, scope, stale source, idempotency, concurrent creation, rollback, audit and unchanged cash/stock.
- Live chat through @Browser against the dev app: bounded representative requests covering ambiguity, correction, reopen/cancel and new proposals. Business confirmation tests use disposable data; no dev business saves during browser QA.
- Inspect final cards/reviews together on mobile 320/360/390/430 and desktop 1024/1280/1440. Keep provider configuration unchanged. Record precise evidence and any genuine provider limits without hiding failures.
- Reconcile every registered action: supported aliases map to actual proposals; infrastructure/read adapters and intentionally manual paths remain distinct from business gaps. Add an executable inventory consistency check and update architecture/coverage docs.
- Run workspace tests, types/build, lint, scoped formatting and existing style gates; report preexisting unrelated warnings/drift. Finish the Impeccable review/documentation workflow and refresh Graft.

Status: complete. All three approved workstreams are implemented and verified.

UAT finding: historical PostgreSQL UUID-shaped IDs were rejected by RFC UUID validation on AI input schemas. The model-facing AI identifier contracts now accept PostgreSQL GUID shape without changing ownership, tenant or permission checks. Named invoice-context lookup was also added to return verified project IDs and scoped ambiguous candidates. Actual live over-invoicing is refused with an explicit contract-ceiling reason.

## Completion evidence

- Live Browser QA covered ambiguity, correction, six complete monthly terms with month-end dates, company-default confirmation cancellation, linked Draft RAB refresh, supported TXT upload, material draft correction/selection and reload persistence. Business records were not saved in the dev database. The evidence and observed limits are recorded in `docs/guide/ai-chat-workflow-verification-2026-10-11.md`.
- The actual TXT audit exposed an unnecessary second provider mapping call and prose/header candidates. Recognized text tables now use the shared deterministic mapper with original physical row provenance; neutral analysis instructions and explicit no-vendor values are supported. Unprocessed legacy checkpoints normalize once, while completed checkpoints are retained.
- Coverage now reconciles all 314 fixed registered operations with an executable inventory check; partial, manual, legacy and infrastructure classifications remain explicit.
- Workspace tests: 2,065 passed, zero failures. Disposable PostgreSQL integration: 20 passed, zero failures. API, web and mobile type/build checks passed; full workspace build and lint passed. Lint retains one preexisting Material Master effect-dependency warning. Scoped formatting, style guards and diff checks passed; unrelated repository formatting drift remains outside this change.
- Browser checks covered 320/360/390/430 and 1024/1280/1440 px. Final malformed screenshot captures were replaced with settled viewport evidence. Fresh Impeccable finish review returned `ship` with no material fixes; DESIGN.md and .impeccable/design.json retain the inherited Operate grammar and shared primitives.
