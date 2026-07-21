# Operational Form Audit — 2026-07-13

| Flow group                             |  Frequency |     Risk | Current friction                                                                                   | Target phase |
| -------------------------------------- | ---------: | -------: | -------------------------------------------------------------------------------------------------- | ------------ |
| Expense + receipt OCR                  |  Very high |     High | Full editors are stacked, mixed-language copy, no recovery, icon-only submit, OCR can replace work | Phase 1      |
| Expense verification/payment           |       High | Critical | Feedback and confirmations vary; submitted records lack a clear immutable/edit policy              | Phase 1/3    |
| Goods Receipt                          |       High | Critical | Long repeated item cards, mixed copy, no input draft, review hidden behind icon action             | Phase 2      |
| Project stock reserve/use/return/waste |       High | Critical | Select-heavy flows, inconsistent before/after stock preview, uneven confirmation                   | Phase 2      |
| Transfer, adjustment, stock count      |     Medium | Critical | Draft behavior exists only for stock count; audit copy and review patterns differ                  | Phase 2      |
| Vendor bill + payment scheduling       |       High | Critical | No recoverable input draft, generic validation, no consistent balance/category review              | Phase 3      |
| Client invoice + receipt               |     Medium | Critical | Form feedback and review differ from vendor/cash flows                                             | Phase 3      |
| Bank account, movement, transfer       |     Medium | Critical | Good local previews but inconsistent close protection and success handling                         | Phase 3      |
| Project create/edit                    |     Medium |     High | Safe defaults exist, but upload and unsaved-change behavior are isolated                           | Phase 4      |
| Budget setup and approval              |     Medium | Critical | Business draft exists, but field validation/review patterns are not unified                        | Phase 4      |
| RAP Material + Tukang/Subcon packages  |     Medium |     High | Long sheets, mixed language, repeated fields remain expanded                                       | Phase 4      |
| RAB source, item, bundle, revision     |     Medium | Critical | Several nested editors and inconsistent save/review surfaces                                       | Phase 4      |
| Settings masters and defaults          | Low/Medium |     High | Shared controls exist, but copy, destructive actions, and dirty guards vary                        | Phase 4      |

## Cross-cutting findings

- `OperationalFormSheet` and shared controls provide a useful base, but primary actions are often icon-only and form completion states are inconsistent.
- `DRAFT` business statuses do not recover partially completed input; there is no general local/server draft contract.
- Repeated Expense and Goods Receipt items are rendered as fully expanded cards, creating long mobile scroll and weak scanability.
- Indonesian and English labels are mixed within the same task.
- Close, backdrop, route change, reload, offline, upload failure, and server conflict do not share one protection pattern.
- Validation is usually summarized in a toast instead of mapping server issues back to the exact field or item.
- Existing finance and stock transaction helpers are sound boundaries and must remain the only path that mutates balances or inventory.

## Migration order

1. Shared draft/workflow foundation and Expense vertical slice.
2. Material operational forms.
3. Finance documents and cash actions.
4. Project, Budget, RAP/RAB, and Settings forms.
5. Final copy, accessibility, raw-control, and legacy-pattern audit. Dashboard redesign remains out of scope.

## Phase 3 audit detail

- Vendor bills currently create the final payable and canonical project expense from a single form submit. The amount and category impact are not reviewed, and close/reload loses the work.
- Vendor scheduling and disbursement use safe transactional actions, but both auto-close after a toast. The operator cannot inspect a durable result or compare the selected account balance before and after payment.
- Client invoices use helpful defaults, but an invoice is created before a dedicated review. Client receipts do not warn when the entered amount exceeds the remaining invoice value.
- Field expense disbursement, manual cash movement, and account transfer all mutate cash only after an explicit button, but their UI pattern differs. Manual movement and transfer also discard typed data on close.
- Bank account creation can create an audited opening-balance ledger row, so its review and close protection must be stronger than ordinary Settings edits.

## Phase status

| Phase                                        | Status  | Verification                                                                                                                                                                                           |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Phase 1 — Expense                            | Stable  | Server/local draft recovery, OCR merge handling, compact line items, atomic submit, browser and regression gates complete                                                                              |
| Phase 2 — Material operations                | Stable  | Before/after stock review, compact repeated items, explicit posting/reversal behavior, browser and regression gates complete                                                                           |
| Phase 3 — Finance documents and cash         | Stable  | Vendor server draft, local recovery for short forms, prepare/review/final actions, durable success, 127 tests and production build complete                                                            |
| Phase 4 — Project, budget, RAP/RAB, Settings | Stable  | Project recovery/review, progressive RAP/RAB and Settings forms, centered confirmations, immutable status guards, 129-test full suite, lint, production build, and browser QA at 320/390/430 px passed |
| Phase 5 — Final consistency audit            | Pending | Dashboard redesign remains out of scope                                                                                                                                                                |

## Stabilization gate before Phase 4

- Goods Receipt vendor-bill selection now remains visible and atomically refreshes project, linked material/RAP, amount, and notes from the selected Material bill.
- Replacing a selected bill cannot silently overwrite meaningful receipt input; cancel retains the old bill context and confirm applies the new context as one update.
- Confirmation prompts now share a centered, accessible overlay modal. Bottom sheets remain reserved for data entry, selectors, review surfaces, and detail exploration.
- Browser checks at 320 and 390 px covered selection, cancel/confirm replacement, dirty-close protection, focus semantics, and console errors without posting a receipt.
- Gate result: strict TypeScript, ESLint, `git diff --check`, 127 tests, and production build passed.

## Phase 4 implementation detail

- Project create/edit prepares a recoverable local draft before submission, defaults the only eligible PM when unambiguous, validates timeline and cover uploads early, and presents a concise review before create/update. Completed and cancelled projects are no longer offered as ordinary edits; Project Closing remains the completion path.
- Project Budget item entry is compact until opened, shows the calculated subtotal while editing, and consistently distinguishes the internal Project Budget from the client-facing RAB. Submit, approve, reject, and dirty-close decisions use the centered confirmation pattern.
- RAP Material and Tukang/Subcon entry now follow source → identity/lingkup → quantity/cost sections, with live need-to-buy and cost previews. RAB source selection, manual items, item editing, bundles, revisions, and Change Orders use the same progressive structure; approved corrections still continue through revision or Change Order, and client-safe schemas still exclude internal cost, margin, stock, vendor, and internal notes.
- Alokasi Budget now combines a formatted value simulator with before/after previews. Category, Material Master, inventory defaults, and Library Item & Harga use progressive sections, compact repeated cost components, dirty protection, and labeled footer actions.
- Final gate result: `git diff --check`, strict TypeScript, ESLint, all 129 tests across 28 files, and the Next.js production build passed. Browser QA at 320, 390, and 430 px covered Project create, RAP revision, RAB source selection, Material Master, Library Item & Harga, Category, and Alokasi Budget surfaces. Console errors were zero and QA did not create, approve, post, or otherwise mutate final finance, stock, or project records.
