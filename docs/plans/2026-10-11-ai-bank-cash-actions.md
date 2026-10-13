# AI rekening dan kas

Implement the five existing bank/cash behaviors through permission-filtered, read-only AI proposals: create a bank/cash account (including explicit opening balance), edit account metadata/theme, activate/archive, post a company manual cash inflow/outflow, and record an inter-account transfer. Preserve manual public signatures and finance business rules. These are Atria records, not an external bank transfer integration; project expenses/payments retain their dedicated flows.

## Shared authority and transaction

Extract typed transactional bank writers from existing manual actions; both manual and AI use them. Scope every reference by tenant, lock account rows in deterministic ID order, serialize account identity checks, validate exact bounded money, reject inactive movement accounts and insufficient funds, and retain audit/readiness behavior. Preserve optional manual references, while AI requires human-supplied references and dates for money movements and positive opening balances. Record supplied bank references and guard duplicate references under the account locks. Transfer commits both ledger sides together with one transfer identity and unchanged total cash; failure rolls back both sides.

Use server Actor and effective DB permissions, including custom roles. Account/cash resources follow the existing bank module's grant-based tenant scope, not a role-name gate or a project assignment filter. AI lookup/review additionally requires bank-read access. Create/update/status use their existing bank grants; cash/transfer use create:ledger. Status changes via metadata still require the status grant. Revalidate permissions and sources at explicit save; never accept client user IDs, mutable payloads or arbitrary SQL.

## Proposal contract and UI

Add BANK_CASH Zod/DTO contracts in packages/core: strict action input, typed before/after facts, source fingerprint, status and identity-only receipt. getBankCashContext supplies bounded searchable active/inactive references; proposeBankCash only prepares an immutable proof. Ordinary get/confirm operations resolve the owned stored tool result with 30-day expiry, source locks, idempotent receipt and atomic writes. Correcting through chat generates a new complete proposal. No new DB storage or provider is needed.

Reuse ProposalCardShell, ProposalInlineReview, ProposalDiffRow, FactRow, MoneyValue fullDynamic, ProposalReviewFeedback, adaptive SheetFooterActions and ConfirmationDialog. Small metadata/status decisions remain inline; larger metadata patches use the existing two-pane FormSheet/ReviewCollection. Cash, transfers, positive opening balances and sensitive bank identity changes require a short protected confirmation. Show mandatory account identity, amount, date/reference and balances outside optional details. Preserve stale/pending/permission/ownership guards, recovery, saved receipt and a canonical link to bank accounts. Controls inherit the approved quiet correction/primary action hierarchy and unified motion.

## Verification and rollout

Core boundary/precision/permission/policy tests; disposable Postgres integration via ATRIA_TEST_DATABASE_URL for dynamic grants/ownership/tenant isolation, revocation, stale account/balance, inactive accounts, insufficient funds, duplicate references, idempotent double-click/retry, opposite-transfer concurrency, manual races, opening ledger/audit/readiness and all-or-nothing rollback. No business writes through the dev browser.

Use visible @Browser on the dev app for real proposal flow, confirmation cancellation, long labels, inline vs retained reviews and mobile320/360/390/430 plus desktop1024/1280/1440. Update action catalog, tool activity/result adapters, typed API facades/registry, architecture and coverage matrix. Run workspace gates, document evidence and refresh graft.

## Completion

Implemented all five action families with shared transactional writers, owned immutable proposals, actual permission checks, explicit cash confirmation and atomic receipts. No migration or provider change was needed. Verification passed 2,086 workspace tests and 12 disposable-Postgres integration cases. Live dev review prepared eight owned previews without saving business records. The fresh finish reviewer scored both UI fixes resolved with disposition **ship**; one narrow DESIGN rule and matching sidecar document the delivered behavior. Full evidence and gate limitations are recorded in `docs/guide/ai-bank-cash-verification-2026-10-11.md`.
