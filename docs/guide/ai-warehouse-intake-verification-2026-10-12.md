# AI warehouse intake verification — 12 October 2026

The procurement/warehouse AI family now supports project goods receipt, company warehouse stock-in and opening-stock request, approval, rejection and reversal. AI prepares server-owned proposals; explicit human confirmation calls the same transactional writers as manual actions.

## Supported flow

1. Resolve actual project, material and warehouse sources with `getWarehouseIntakeContext`. Search accepts one character; source pages contain 20 items and continuation. Missing project/location selection requests a choice instead of taking the first row.
2. Prepare `proposeWarehouseIntake` with explicit source reference, receiving/opening date, quantities, supplied costs and required notes/reasons. Batches support 1–100 rows. Project receipts may repeat a material across distinct RAP lines; duplicate tuples are rejected. Company stock-in requires unique materials.
3. Read all stock/cost effects in the existing card or grouped review. Retained sheets show five rows per page, a right summary/action panel on desktop and summary-first mobile. Money uses shared `fullDynamic` formatting. Physical stock changes require the shared short confirmation; opening requests leave stock unchanged until another user approves.
4. Confirm only the stored conversation/tool identity. The API rechecks current permissions, source access, source fingerprint and expiry. Movement, inventory update, audit and idempotent confirmation receipt commit atomically. A newly created or changed source requires a fresh preview.
5. Follow the saved warehouse/opening destination. Company stock-in retains a unique `warehouse_intake` source header and readable movement history. A missing inventory pair is disclosed and initialized only in the receiving transaction; absent/inactive masters or warehouses are never created silently. Opening inventory requires actual existing IDs and no stock, reservation or movement history.

Opening approval uses a different checker. Rejection records the supplied reason. Reversal blocks reservations or any later movement. Receipt/opening writes do not create payments, cash transactions or project actuals. Existing count approval remains the ordinary stock-correction workflow; emergency adjustment remains manual.

## Automated checks

| Check                                | Result                                                          |
| ------------------------------------ | --------------------------------------------------------------- |
| Root `bun run test`                  | 2,102 passed, zero failures                                     |
| New warehouse intake integration     | 12 passed on disposable PostgreSQL                              |
| Legacy receipt-reversal integration  | 7 passed, including real rollback/shared-writer behavior        |
| Existing procurement integration     | 12 passed                                                       |
| Final web review/flow subset         | 13 passed                                                       |
| API/web/mobile TypeScript            | Passed                                                          |
| Workspace API/web/admin/mobile build | Passed; final changed web build rerun                           |
| Root lint                            | Zero errors; existing Material Master hook dependency warning   |
| Shared HeroUI scoped styles          | Passed                                                          |
| Scoped Prettier                      | Passed                                                          |
| Repository-wide Prettier             | Existing105-file baseline fails; unrelated files were preserved |

The integration suites cover schema bounds/precision, exact dates/references, duplicate receipts, repeated material with distinct RAP lines, new receiving inventory, tenant/project permissions and custom warehouse roles, revocation, maker/checker, source changes, manual/AI races, rollback, replay, weighted costs, opening eligibility and guarded reversal. Live Postgres tests use `ATRIA_TEST_DATABASE_URL`; normal tests do not use development data.

## Browser and database evidence

Visible dev preview: `http://127.0.0.1:3004/ai`, API 3005. It uses the named disposable `atria_audit_reconciliation` database and the synthetic QA conversation “QA penerimaan & stok gudang · database disposable”. The normal development app remains available at `http://localhost:3003/ai`; additive migration0048 was applied there without changing business stock.

The QA conversation contains eight real owned proposals: project receipt, company stock-in, opening request/approval/rejection/reversal, single stock-in and stock-in at a new inventory location. Synthetic dates explicitly use 11 October 2026. The last proposal was confirmed through the visible Browser:

| Record                                         | Verified result       |
| ---------------------------------------------- | --------------------- |
| Reference                                      | `SJ-QA-BARU-02e7db35` |
| Current stock                                  | `2.00`                |
| Average cost                                   | `125000.00`           |
| Movement / header audit / confirmation receipt | One each              |
| Cash rows before → after                       | 49 → 49               |
| Project expense rows before → after            | 0 → 0                 |

Cancelling opening approval preserves the pending source and stock. Exact Rp1.290.000 and material count are visible in the initial approval confirmation. Reference labels remain whole words in the narrow desktop summary. Mobile primary amounts align right below row identity.

Evidence is saved under `output/ai-chat-qa/warehouse-intake/`: `receipt-desktop.png`, `receipt-mobile.png`, `stock-in-desktop.png`, `opening-request-desktop.png`, `opening-approval-mobile.png`, `opening-confirm-desktop.png`, `opening-confirm-mobile.png`, `new-inventory-confirm-desktop.png` and saved-state captures. `viewport-checks.json` records desktop 1024/1280/1440 and mobile 320/360/390/430: five rows, in-viewport dialogs and uncut amounts.

The disposable preview intentionally disables model-provider credentials. It verifies the card → API → database → saved receipt path with prepared authentic proofs; it does not claim a live-model conversation test. Real provider routing was not changed. UI continues to use `ProposalCardShell`, `ReviewCollection`/`ReviewItem`, `FactRow`, `MoneyValue`, `FormSheet`, `SheetFooterActions`, `FormDisclosure` and `ConfirmationDialog`; there is no separate warehouse overlay or selection system.

The independent Impeccable finish verdict is **ship**. All three bounded visual findings were resolved: right-aligned mobile primary amounts, whole desktop reference labels and initially visible exact opening value/material count. The final fix batch introduced no visible regression. Static captures establish visual fidelity; they are not motion recordings. Existing shared Framer Motion presets and stable overlay ownership remain in use.
