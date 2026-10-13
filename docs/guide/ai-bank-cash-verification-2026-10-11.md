# AI rekening dan kas verification

## Implemented behavior

`getBankCashContext` and `proposeBankCash` cover account creation with zero/explicit opening cash, metadata/theme correction, active/archive status, company manual inflow/outflow and recorded inter-account transfer. They read actual tenant data and prepare immutable BANK_CASH proofs; model tools do not write business records. Fixed identity-only get/confirm operations are registered through the API and typed web facades.

Bank/cash resources follow existing tenant bank-domain grants, including custom NONE roles with explicit bank rights, without a role-name/project-scope gate. AI additionally needs use:ai_chat and bank-read access. Source/permission/ownership/expiry checks run at save. Metadata patches preserve omitted theme/identity fields, cannot alter balances/status directly, and show complete before/after values. Human dates and references are required for money proposals, including positive opening balances.

Manual and AI actions share bank-cash-writer.ts. Identity checks lock the tenant catalog; account locks use sorted IDs. Supplied references are persisted in ledger rows and checked under account locks. Exact cent arithmetic remains in mutateBalance. Transfer writes both linked sides atomically, preserving total cash; failure rolls back balances, ledger, audit and receipt. Ordinary account creation keeps opening ledger/audit/readiness in the same transaction. No reconciled ledger entry is edited, no stock/project expense is created and no external bank transfer is sent. Manual public signatures remain unchanged.

## Automated evidence

Three Core tests cover monetary precision/bounds, distinct transfer accounts, dates/references, explicit opening cash, forbidden payload fields and preservation of unspecified theme values. Existing bank active-account architecture guards were adapted to shared ownership and lock-before-check-before-post behavior.

Disposable Postgres integration uses explicit ATRIA_TEST_DATABASE_URL through the loopback-only local preload; development DB was never used for these tests. Twelve cases cover zero/positive opening, ledger/audit/reference, metadata/status, current DB grant revocation, custom NONE bank grants, user ownership, malformed confirmation payloads, tenant isolation, stale manual balances, duplicate references, double-click/replay, cash inflow, inactive destination, paired transfer conservation, opposite-transfer concurrency, rollback after the second ledger write, expiry, insufficient funds and manual identity/status races.

The DOM fixture proves money opens confirmation before RPC, pending suppresses duplicate submission/dismissal, confirm sends only owned identity, saved receipt replaces actions and revoked bank-read rights hide financial snapshots. Adaptive-policy tests prove small metadata is direct, changed bank identity protected, larger patches retain review and cash stays protected. Model-facing schemas, capability inventory and read-only tool guards pass.

Workspace tests passed 2,086 tests (987 web), zero failures. After the final UI hierarchy changes, the 11 policy/DOM tests, web typecheck, web production build and scoped ESLint passed again. API/web/mobile type checks and API/web/admin/mobile builds passed. Workspace lint has no errors and retains the existing Material Master accept-dependency warning. Token and scoped HeroUI style checks passed. Global format check reports 108 existing files; changed files use scoped formatting rather than mass reformatting unrelated work.

## Visible @Browser dev review

Live chat on localhost:3003/ai prepared eight real owned preview cards: new zero account, transfer, positive opening account, four-field metadata correction, archive, cash outflow, cash inflow and one-field rename. Only chat/proposal metadata was saved. The first transfer generation had one SDK-invalid attempt followed by a valid proposal; its historical failure remains visible under the existing conservative activity recovery rule, while subsequent QA requests produced all requested proposals without failures. Bank input failure guidance now names bank/cash input instead of search. Business record saving was not performed.

All eight cards were checked at mobile320/360/390/430 and desktop1024/1280/1440: no document overflow, action clipping or wrapped/truncated primary money. Small corrections stay inline; four-field correction uses the shared two-pane desktop sheet and one-column mobile review. Mobile displays the same changed-field count and stored-balance summary as the desktop aside. Transfer confirmation repeats both account identities/numbers and leads with amount/date/reference before balance comparisons. Transfer, bank-identity correction, positive opening and cash confirmations were opened and cancelled without business saves. Money, status and metadata remain on the same owned proof through resize.

Evidence is under output/ai-chat-qa/bank-cash-actions/, with geometry JSON and valid desktop/mobile captures for cash cards, metadata review and transfer confirmation. Temporary viewports are reset and the visible QA conversation remains available for the user's preview.

## Finish verdict

The fresh Impeccable reviewer scored the six recaptures with disposition **ship**. Both material findings were resolved: leading transfer amount/date/reference/account identity in confirmation, and matching mobile metadata summary context. No regressions were observed in the fix batch. The initially requested concept seed was withdrawn because this is an extension of the approved AI proposal family; the skill explicitly excludes a concept roll for local extensions. The documenter added one matching bank/cash review rule in DESIGN.md and its sidecar without changing visual tokens.
