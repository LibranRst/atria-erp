---
name: atria-finance
description: Guides the implementation, auditing, and debugging of financial workflows in Atria ERP, including cash ledger transactions, project budget calculations, category spending, vendor bills, client payment receipts, and bank reconciliation. Use when modifying or auditing any finance logic, ledger actions, or balance calculations.
---

# Atria ERP Finance & Cash Ledger Workflow Runbook

This skill provides step-by-step guidance for building and auditing financial mutations, budget tracking, and reconciliation flows following the **Option A Ledger Model**.

Backend implementations and transactions now live in `apps/api/src/backend/` and use `@backend/*`. Web actions are typed HTTP facades. Read `docs/06-technical/ARCHITECTURE.md` before changing transport boundaries.

---

## 1. Golden Invariants for Balance Changes

Whenever an operation modifies account balances, records an expense, settles a bill, or logs client income:

1. **Wrap in `db.transaction`**:
   ```typescript
   import { db } from "@backend/db";
   import { cashTransaction, bankAccount, auditLog } from "@backend/db/schema";
   import { eq, sql } from "drizzle-orm";

   await db.transaction(async (tx) => {
     // 1. Lock bank account row
     const [account] = await tx
       .select()
       .from(bankAccount)
       .where(eq(bankAccount.id, accountId))
       .for("update");

     if (!account) throw new Error("Account not found");

     // 2. Validate balance (for outflows)
     if (type === "EXPENSE" && account.balance < amount) {
       throw new Error("Saldo rekening tidak mencukupi");
     }

     // 3. Update account balance
     const newBalance = type === "INCOME" ? account.balance + amount : account.balance - amount;
     await tx
       .update(bankAccount)
       .set({ balance: newBalance, updatedAt: new Date() })
       .where(eq(bankAccount.id, accountId));

     // 4. Create immutable cash_transaction row
     const [trx] = await tx
       .insert(cashTransaction)
       .values({
         bankAccountId: accountId,
         projectId,
         amount,
         type,
         category,
         description,
         reconciliationStatus: "UNRECONCILED",
         createdBy: session.user.id,
       })
       .returning();

     // 5. Write audit_log entry
     await tx.insert(auditLog).values({
       entityType: "cash_transaction",
       entityId: trx.id,
       action: "CREATE",
       actorId: session.user.id,
       payload: { amount, type, category, accountId, previousBalance: account.balance, newBalance },
     });
   });
   ```

---

## 2. Project Budget & Category Allocations

- Canonical Categories: `MATERIAL`, `TUKANG`, `OPERASIONAL`, `LAIN_LAIN`, `SUBCON`.
- **Budget Metrics Hierarchy**:
  - `Project Value` (Nilai Kontrak / Project Ceiling)
  - `Approved RAB Value` (Client estimate)
  - `Internal Budget Cap` (Plafon Biaya Dekoria / Target Margin)
  - `Category Allocation` (Alokasi per kategori)
  - `Consumed Budget` (Total realisasi pengeluaran tercatat)
  - `Paid Amount` (Kas aktual yang sudah keluar dari rekening)
  - `Remaining Budget` (Sisa pagu budget = `Allocation - Consumed`)
  - `Margin Visibility` (`Project Value - Consumed Budget`)

---

## 3. Bank Statement Reconciliation Flow

1. **Import CSV**: Parses bank statements into `bank_mutation` rows (`PENDING_RECONCILIATION`).
2. **Matching**:
   - Compares mutation amount, date, and description against `cash_transaction` (`UNRECONCILED`).
   - Match types: 1-to-1 exact, 1-to-N aggregated, or manual mapping with exception note.
3. **Settlement**: Sets `reconciliationStatus = 'RECONCILED'` and records `reconciliation_match` link.
4. **Immutability Guarantee**: Reconciled rows are permanently locked against direct editing or deletion.

---

## 4. Verification Checklist

- [ ] All mutations execute inside `db.transaction`.
- [ ] Account row locked with `.for("update")` before modifying balance.
- [ ] Invariant check: `audit_log` row is written for every state or money change.
- [ ] No direct raw SQL used.
- [ ] API verifies Better Auth session/Actor before executing business operations; web forwards current session credentials.
