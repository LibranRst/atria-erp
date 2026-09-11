# Status Enums - Atria ERP

## Project Status

| Enum        | Meaning                                                                                       |
| :---------- | :-------------------------------------------------------------------------------------------- |
| `DRAFT`     | Project is being prepared.                                                                    |
| `ACTIVE`    | Project is running and can receive budgets, RAP, expenses, vendor bills, and stock movements. |
| `ON_HOLD`   | Project is paused.                                                                            |
| `COMPLETED` | Project work and administration are closed.                                                   |
| `CANCELLED` | Project is cancelled.                                                                         |

## Owner Quick Start Status

| Enum          | Meaning                                                                 |
| :------------ | :---------------------------------------------------------------------- |
| `IN_PROGRESS` | Owner sedang mereview default atau menyiapkan project pertama.          |
| `PAUSED`      | Quick start dijeda; data tersimpan dan Dashboard menyediakan resume.    |
| `COMPLETED`   | Project Draft pertama sudah dibuat; state ini tidak dapat dibuka ulang. |

Operational readiness tidak memakai status quick-start. Ia selalu dihitung dari tim, rekening,
fondasi material, dan keputusan saldo awal aktual.

## Project Financial Health

| Enum       | Meaning                                                    |
| :--------- | :--------------------------------------------------------- |
| `HEALTHY`  | Budget and material usage are under warning threshold.     |
| `WARNING`  | Budget/material risk needs attention.                      |
| `CRITICAL` | Project is over budget, materially short, or margin-risky. |

## Project Budget Status

| Enum               | Meaning                                                         |
| :----------------- | :-------------------------------------------------------------- |
| `DRAFT`            | Internal budget is being prepared.                              |
| `PENDING_APPROVAL` | Budget is waiting for Owner/Finance approval.                   |
| `APPROVED`         | Budget is approved and should be treated as a control baseline. |
| `REJECTED`         | Legacy/history state retained for compatibility.                |

Pada workflow canonical, keputusan **Minta revisi** mengembalikan
`PENDING_APPROVAL → DRAFT` dan menyimpan alasan pada audit trail agar budget
langsung dapat diperbaiki lalu diajukan kembali.

## Budget Category Risk Status

| Enum          | Meaning                                               |
| :------------ | :---------------------------------------------------- |
| `SAFE`        | Used percentage is below 75%.                         |
| `WATCH`       | Used percentage is at least 75% and below 95%.        |
| `CRITICAL`    | Used percentage is at least 95% and at or below 100%. |
| `OVER_BUDGET` | Used percentage is above 100%.                        |

## Expense Category Code

| Enum          | Meaning                                                  |
| :------------ | :------------------------------------------------------- |
| `MATERIAL`    | Material purchases and material-linked project spending. |
| `TUKANG`      | Labor/worker spending.                                   |
| `OPERASIONAL` | Operational project spending.                            |
| `LAIN_LAIN`   | Other project spending.                                  |
| `SUBCON`      | Subcontractor spending. Optional per project budget.     |

## Budget Allocation Setting Status

| Enum       | Meaning                                                         |
| :--------- | :-------------------------------------------------------------- |
| `ACTIVE`   | Setting is used as the default for new Project Budget creation. |
| `INACTIVE` | Setting is archived or not used for new budgets.                |

## Item Price Library Type

| Enum             | Meaning                                                                |
| :--------------- | :--------------------------------------------------------------------- |
| `MATERIAL_ITEM`  | Reusable material estimate reference that may link to Material Master. |
| `WORK_PACKAGE`   | Reusable Tukang package reference.                                     |
| `SUBCON_PACKAGE` | Reusable Subcon/vendor package reference.                              |
| `CLIENT_LINE`    | Manual client-safe quotation line reference.                           |

## Canonical Expense Status

| Enum        | Meaning                             |
| :---------- | :---------------------------------- |
| `DRAFT`     | Expense is being prepared.          |
| `SUBMITTED` | Expense has been submitted.         |
| `VERIFIED`  | Finance/Admin verified proof.       |
| `APPROVED`  | Owner/Admin approved when required. |
| `PAID`      | Expense has cash impact recorded.   |
| `REJECTED`  | Expense is rejected.                |

## Payment Status

| Enum             | Meaning                                                                             |
| :--------------- | :---------------------------------------------------------------------------------- |
| `UNPAID`         | No payment recorded.                                                                |
| `PARTIALLY_PAID` | Some payment recorded.                                                              |
| `PAID`           | Fully paid.                                                                         |
| `NON_CASH`       | Cost recognized without a project-period cash movement, such as stock usage/return. |

## RAP Status

| Enum             | Meaning                                                 |
| :--------------- | :------------------------------------------------------ |
| `DRAFT`          | RAP is editable.                                        |
| `PENDING_REVIEW` | RAP is ready for owner/finance review.                  |
| `LOCKED`         | RAP is locked as internal cost/material baseline.       |
| `SUPERSEDED`     | RAP has been formally replaced by an approved revision. |

## RAP Item Status

| Enum               | Meaning                                                     |
| :----------------- | :---------------------------------------------------------- |
| `PLANNED`          | Material need is planned but not yet checked against stock. |
| `READY`            | Required material is available or reserved.                 |
| `SHORTAGE`         | Available stock is below total needed.                      |
| `WAITING_PURCHASE` | Purchase is needed or in progress.                          |
| `USED`             | Material has been used for the project.                     |
| `CLOSED`           | Item is finished and no further action is expected.         |

## Category Plan Item Status

| Enum         | Meaning                                                                                              |
| :----------- | :--------------------------------------------------------------------------------------------------- |
| `DRAFT`      | Tukang/Subcon package is still editable and not yet treated as active scope.                         |
| `ACTIVE`     | Package is marked **Siap** in the UI and can become a RAB source; reopen it to Draft before editing. |
| `LOCKED`     | Package is an immutable source of an approved RAB.                                                   |
| `SUPERSEDED` | Package was replaced by an approved revision.                                                        |
| `DONE`       | Package scope is completed.                                                                          |
| `CANCELLED`  | Package scope is no longer used.                                                                     |

## RAB Estimate Status

| Enum            | Meaning                                                                                                  |
| :-------------- | :------------------------------------------------------------------------------------------------------- |
| `DRAFT`         | Client-facing estimate is editable.                                                                      |
| `READY_TO_SEND` | Estimate is reviewed and client-safe.                                                                    |
| `APPROVED`      | Estimate is accepted as client-facing value.                                                             |
| `SUPERSEDED`    | Estimate was formally replaced by an approved Change Order revision.                                     |
| `VOID`          | A draft estimate/revision was cancelled; it remains in history and cannot replace the approved baseline. |

## RAB Item Source Type

| Enum            | Meaning                                                           |
| :-------------- | :---------------------------------------------------------------- |
| `RAP_MATERIAL`  | Client-safe quotation row generated from a RAP Material item.     |
| `CATEGORY_PLAN` | Client-safe quotation row generated from a Tukang/Subcon package. |
| `MANUAL`        | Client-safe quotation row entered manually.                       |

## Stock Movement Type

| Enum                           | Meaning                                                  |
| :----------------------------- | :------------------------------------------------------- |
| `STOCK_IN`                     | Material enters inventory.                               |
| `STOCK_OUT`                    | Material leaves inventory without project usage context. |
| `RESERVE`                      | Stock is reserved for a project/RAP item.                |
| `USE`                          | Stock is consumed by a project.                          |
| `RETURN`                       | Leftover material returns from project to inventory.     |
| `TRANSFER`                     | Material moves between locations or project context.     |
| `ADJUSTMENT`                   | Manual correction with audit note.                       |
| `TRANSFER_OUT` / `TRANSFER_IN` | Paired movements for an atomic location transfer.        |
| `STOCK_COUNT_ADJUSTMENT`       | Approved physical-count variance.                        |
| `GOODS_RECEIPT_REVERSAL`       | Compensating movement for a reversed receipt.            |

Stock Count lifecycle: `DRAFT → PENDING_APPROVAL → POSTED/REJECTED`.

Goods Receipt lifecycle: `POSTED → REVERSAL_REQUESTED → REVERSED`; rejected requests return to `POSTED` while audit history remains.
| `WASTE` | Material is damaged, lost, or unusable. |
| `GOODS_RECEIPT` | Purchased material was physically received and posted to inventory. |

## Change Order Status

| Enum               | Meaning                                                                       |
| :----------------- | :---------------------------------------------------------------------------- |
| `DRAFT`            | Internal revision reason/scope is being prepared.                             |
| `PENDING_CLIENT`   | Waiting for client confirmation evidence.                                     |
| `PENDING_APPROVAL` | Client confirmation is recorded; waiting for Owner/Finance approval.          |
| `APPROVED`         | RAB revision, contract, budget, and source locks were updated atomically.     |
| `REJECTED`         | Internal approval rejected the change.                                        |
| `CANCELLED`        | Change Order was abandoned, including when its linked RAB revision is voided. |

## Goods Receipt Status

| Enum     | Meaning                                                |
| :------- | :----------------------------------------------------- |
| `DRAFT`  | Receipt is being prepared and has no stock effect.     |
| `POSTED` | Physical receipt updated inventory and stock movement. |
| `VOID`   | Receipt was voided through an audited reversal flow.   |

## Inventory Status

| Enum           | Meaning                                           |
| :------------- | :------------------------------------------------ |
| `AVAILABLE`    | Available stock is above minimum/buffer.          |
| `LOW_STOCK`    | Available stock is at or below buffer.            |
| `OUT_OF_STOCK` | No available stock.                               |
| `RESERVED`     | Stock exists but is mostly committed to projects. |

## Cost Approval Status

| Enum        | Meaning                                       |
| :---------- | :-------------------------------------------- |
| `SUBMITTED` | Expense is submitted.                         |
| `VERIFIED`  | Finance/Admin verified the expense proof.     |
| `APPROVED`  | Owner/Admin approved if required.             |
| `PAID`      | Expense has been paid and ledger was updated. |
| `REJECTED`  | Expense is rejected.                          |

## Vendor Bill Status

| Enum             | Meaning                         |
| :--------------- | :------------------------------ |
| `UNPAID`         | Bill exists and has no payment. |
| `PARTIALLY_PAID` | Bill has partial payment.       |
| `PAID`           | Bill is fully paid.             |
| `OVERDUE`        | Bill is past due.               |
| `VOID`           | Bill is cancelled.              |

## Vendor Payment Status

| Enum         | Meaning                                        |
| :----------- | :--------------------------------------------- |
| `PENDING`    | Payment is scheduled/proposed.                 |
| `PROCESSING` | Payment is being processed.                    |
| `COMPLETED`  | Payment has been completed and ledger updated. |
| `FAILED`     | Payment failed.                                |

## Cash Transaction Type

| Enum      | Meaning   |
| :-------- | :-------- |
| `INFLOW`  | Cash in.  |
| `OUTFLOW` | Cash out. |

Legacy rows using `DEBIT`/`CREDIT` are migrated by `0026_cash_direction_semantics`. Those terms are reserved for a future double-entry accounting journal and are not used for cash-direction UX.

## Reconciliation Presentation State

This is derived from cash-transaction fields rather than stored as a free-form status.

| User-facing state       | Canonical condition                                                                 |
| :---------------------- | :---------------------------------------------------------------------------------- |
| `Belum cocok`           | `reconciled = false` and no reconciliation exception                                |
| `Pengecualian tercatat` | `reconciled = false` with reason, reviewer, and timestamp                           |
| `Sudah cocok`           | `reconciled = true` with reconciliation date/reviewer and one matched statement row |

An exception never means reconciled. Clearing an exception returns the transaction to `Belum cocok`; confirming a real pair clears any exception evidence from the current row while the audit history remains immutable.

## Cash Transaction Category

| Enum             | Meaning                           |
| :--------------- | :-------------------------------- |
| `client_payment` | Client payment received.          |
| `vendor_payment` | Vendor bill payment.              |
| `cash_advance`   | Advance for field work.           |
| `reimbursement`  | Reimbursement of project expense. |
| `stock_purchase` | Material purchase payment.        |
| `other`          | Other cash movement.              |

## Alert Severity

| Enum       | Meaning                 |
| :--------- | :---------------------- |
| `INFO`     | Informational.          |
| `WARNING`  | Needs attention soon.   |
| `CRITICAL` | Requires urgent action. |
