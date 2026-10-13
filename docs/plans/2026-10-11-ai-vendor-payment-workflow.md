# Complete AI vendor payment workflow

Approved scope: finish vendor payment scheduling, approval/rejection and payment through chat. Each stage is a separate owned preview and explicit human action. No automatic cash movement, bank connection or emergency self-approval is added.

## Implementation

- Extract shared schedule and decision transactional writers from the existing manual actions; retain public signatures, Settings thresholds, outstanding/commitment checks, project scope, maker/checker, audit and notifications. Harden tenant checks and final-state races on both manual and AI paths.
- Add core typed schedule/decision/payment proposal contracts, live scoped context, immutable source proof, identity-only read/confirm operations and receipts. Reuse the existing payment writer. Scheduling and approval leave cash and stock unchanged; only payment creates its existing ledger transaction.
- Read-only tools discover verified bills/payments/accounts, prepare complete previews and expose only actions allowed by current database grants. A rejected or unapproved payment cannot be paid. Approvals do not silently trigger payment; user-supplied bank reference is required for payment.
- Compose compact inline cards from ProposalCardShell, ProposalInlineReview, FactRow, MoneyValue and ConfirmationDialog. Show bill/vendor/project, amount/date/account, outstanding, approval requirement or decision, and cash impact where relevant. Preserve shared state, feedback and motion.
- Keep legacy stored payment cards readable; their confirmation continues through existing compatibility operation with current server validation.

## Verification and completion

- Tests cover dynamic grants, project assignment/NONE, foreign tenant/ownership, revocation, expiry/stale source, maker/checker, rejection, outstanding/partial payments, duplicate references, concurrent manual/AI scheduling and atomic receipt/audit/ledger rollback.
- Disposable PostgreSQL only through ATRIA_TEST_DATABASE_URL; dev Browser QA uses preview/cancellation, without business saves. Verify 320/360/390/430 and 1024/1280/1440 px in @Browser.
- Update capability catalog, coverage matrix, architecture and design rules; run workspace gates and bounded visual finish review, then refresh Graft.

Status: complete.

## Completion evidence

- Separate scheduling, approval/rejection and payment recording now use owned immutable previews, fixed identity-only operations and shared manual/AI transactional writers. All three stages are permission filtered. Emergency self-approval remains manual; payment requires a supplied bank reference.
- Live @Browser QA prepared all three previews on the connected Menteng bills, opened and cancelled approval/payment confirmations, and checked the seven required viewport widths without horizontal overflow. An API watch restart during editing interrupted the first stream; ordinary Retry recovered the complete stored previews. No business records were saved in dev.
- 2,069 workspace tests passed, zero failures. Nine disposable PostgreSQL integration tests passed, including independent approval, partial payment/replay, Settings changes, rejection, concurrent AI/manual schedules, revoked grants/scope/ownership, stale/expired/foreign sources, duplicate reference and post-write rollback. The temporary test container was removed.
- API/web/mobile type checks, full workspace build, lint, token synchronization and HeroUI style guards passed. Lint retains one preexisting Material Master effect-dependency warning. Scoped formatting passed; global formatting reports 107 unrelated existing files and was not broadly rewritten.
- The coverage inventory includes both new fixed operations and supported schedule/decision/payment routes. Architecture and verification notes are current. The Impeccable documenter preserved the existing design system while adding the vendor payment rule; fresh finish review returned `ship` with no material fixes.

Evidence: `docs/guide/ai-vendor-payment-verification-2026-10-11.md` and `output/ai-chat-qa/vendor-payment-workflow/`.
