import { db } from "@backend/db";
import {
  auditLog,
  bankAccount,
  cashTransaction,
  materialInventory,
  projectBudgetCategory,
  projectBudgets,
  stockMovement,
  vendorPayment,
} from "@backend/db/schema";
import { parseNumericToCents, fromCents } from "./balance-mutation";

/**
 * Invarian buku besar, stok, dan budget.
 *
 * Runbook UAT membuktikan **satu jalur** sampai rupiah terakhir. Berkas ini
 * membuktikan **satu kelas**: aturan yang harus benar untuk setiap baris, di
 * database mana pun, kapan pun — termasuk data produksi yang tidak pernah
 * dilihat runbook.
 *
 * Semuanya **hanya membaca**. Tidak ada satu pun mutasi di berkas ini, jadi
 * aman dijalankan terhadap database produksi sebagai pemeriksaan malam lewat
 * `bun run db:check-invariants`.
 *
 * Tiap invarian dipecah dua: `evaluate*` yang murni dan bisa diuji tanpa
 * database, dan `check*` tipis yang hanya mengambil baris lalu memanggilnya.
 * Pemeriksa yang belum pernah terbukti menangkap apa pun sama tidak
 * terbuktinya dengan hal yang ia periksa — `ledger-invariants.test.ts`
 * memberinya data rusak buatan dan menuntut ia mengeluh.
 *
 * Uang dijumlahkan sebagai `bigint` sen lewat `parseNumericToCents`, bukan
 * float — aturan yang sama dengan jalur mutasi saldo. Kuantitas stok memakai
 * skala setara supaya `numeric(12,2)` tidak kehilangan presisi.
 */

export type InvariantViolation = {
  /** Baris atau kelompok yang melanggar, dalam bentuk yang bisa dicari orang. */
  readonly subject: string;
  readonly expected: string;
  readonly actual: string;
  readonly detail?: string;
};

export type InvariantResult = {
  readonly id: string;
  readonly title: string;
  /** Apa yang rusak di dunia nyata kalau invarian ini gagal. */
  readonly consequence: string;
  readonly checked: number;
  readonly violations: readonly InvariantViolation[];
};

/** Kuantitas stok `numeric(12,2)` → bigint berskala 100, sama seperti sen. */
function parseQuantityToScaled(value: string): bigint {
  return parseNumericToCents(value);
}

// ==========================================
// I1. Saldo rekening = jumlah buku besar
// ==========================================
export type BankAccountRow = {
  readonly id: string;
  readonly name: string;
  readonly balance: string;
};
export type LedgerRow = {
  readonly bankAccountId: string;
  readonly type: string;
  readonly amount: string;
};

export function evaluateBankBalanceMatchesLedger(
  accounts: readonly BankAccountRow[],
  ledger: readonly LedgerRow[],
): InvariantResult {
  const netByAccount = new Map<string, bigint>();
  for (const row of ledger) {
    const amount = parseNumericToCents(row.amount);
    const signed = row.type === "INFLOW" ? amount : -amount;
    netByAccount.set(row.bankAccountId, (netByAccount.get(row.bankAccountId) ?? 0n) + signed);
  }

  const violations: InvariantViolation[] = [];
  for (const account of accounts) {
    const expected = netByAccount.get(account.id) ?? 0n;
    const actual = parseNumericToCents(account.balance);
    if (expected === actual) continue;

    violations.push({
      subject: `bank_account ${account.name} (${account.id})`,
      expected: fromCents(expected),
      actual: fromCents(actual),
      detail: `selisih ${fromCents(actual - expected)}`,
    });
  }

  return {
    id: "I1",
    title: "Saldo rekening sama dengan jumlah buku besarnya",
    consequence:
      "Saldo di layar berbohong. Setiap keputusan bayar memakai angka yang tidak didukung satu pun baris ledger.",
    checked: accounts.length,
    violations,
  };
}

export async function checkBankBalanceMatchesLedger(): Promise<InvariantResult> {
  const [accounts, ledger] = await Promise.all([
    db
      .select({ id: bankAccount.id, name: bankAccount.name, balance: bankAccount.balance })
      .from(bankAccount),
    db
      .select({
        bankAccountId: cashTransaction.bankAccountId,
        type: cashTransaction.type,
        amount: cashTransaction.amount,
      })
      .from(cashTransaction),
  ]);

  return evaluateBankBalanceMatchesLedger(accounts, ledger);
}

// ==========================================
// I2. Inventaris = jumlah pergerakan stok
// ==========================================
export type InventoryRow = {
  readonly id: string;
  readonly materialId: string;
  readonly locationId: string;
  readonly currentStock: string;
};
export type MovementRow = {
  readonly id: string;
  readonly materialId: string;
  readonly locationId: string;
  readonly movementType: string;
  readonly direction: string;
  readonly quantity: string;
};

export function evaluateInventoryMatchesMovements(
  inventories: readonly InventoryRow[],
  movements: readonly MovementRow[],
): InvariantResult {
  const cellKey = (materialId: string, locationId: string): string => `${materialId}:${locationId}`;

  const netByCell = new Map<string, bigint>();
  for (const row of movements) {
    // RESERVE memindahkan reserved_stock, bukan current_stock — lihat I5.
    if (row.direction === "NEUTRAL") continue;
    const quantity = parseQuantityToScaled(row.quantity);
    const signed = row.direction === "IN" ? quantity : -quantity;
    const cell = cellKey(row.materialId, row.locationId);
    netByCell.set(cell, (netByCell.get(cell) ?? 0n) + signed);
  }

  const violations: InvariantViolation[] = [];
  for (const inventory of inventories) {
    const expected = netByCell.get(cellKey(inventory.materialId, inventory.locationId)) ?? 0n;
    const actual = parseQuantityToScaled(inventory.currentStock);
    if (expected === actual) continue;

    violations.push({
      subject: `material_inventory ${inventory.id}`,
      expected: fromCents(expected),
      actual: fromCents(actual),
      detail: `material ${inventory.materialId} @ lokasi ${inventory.locationId}`,
    });
  }

  return {
    id: "I2",
    title: "Stok tercatat sama dengan jumlah pergerakannya",
    consequence:
      "Buku pergerakan stok dan saldo stok bercerita berbeda. Pengadaan memakai angka yang tidak bisa ditelusuri ke satu pun transaksi.",
    checked: inventories.length,
    violations,
  };
}

export async function checkInventoryMatchesMovements(): Promise<InvariantResult> {
  const [inventories, movements] = await Promise.all([
    db
      .select({
        id: materialInventory.id,
        materialId: materialInventory.materialId,
        locationId: materialInventory.locationId,
        currentStock: materialInventory.currentStock,
      })
      .from(materialInventory),
    db
      .select({
        id: stockMovement.id,
        materialId: stockMovement.materialId,
        locationId: stockMovement.inventoryLocationId,
        movementType: stockMovement.movementType,
        direction: stockMovement.movementDirection,
        quantity: stockMovement.quantity,
      })
      .from(stockMovement),
  ]);

  return evaluateInventoryMatchesMovements(inventories, movements);
}

// ==========================================
// I3. Alokasi kategori konsisten dengan internal budget
// ==========================================
export type BudgetRow = { readonly id: string; readonly internalBudget: string };
export type BudgetCategoryRow = {
  readonly id: string;
  readonly projectBudgetId: string;
  readonly ratioPercentage: string;
  readonly allocatedAmount: string;
};

export function evaluateBudgetAllocations(
  budgets: readonly BudgetRow[],
  categories: readonly BudgetCategoryRow[],
): InvariantResult {
  const internalByBudget = new Map(
    budgets.map((budget) => [budget.id, parseNumericToCents(budget.internalBudget)]),
  );

  const violations: InvariantViolation[] = [];
  for (const category of categories) {
    const internal = internalByBudget.get(category.projectBudgetId);
    if (internal === undefined) {
      violations.push({
        subject: `project_budget_category ${category.id}`,
        expected: "menunjuk project_budgets yang ada",
        actual: `project_budget_id ${category.projectBudgetId} tidak ditemukan`,
      });
      continue;
    }

    // `insertCanonicalProjectBudgetTx` menulis allocatedAmount = internalBudget × ratio,
    // dibulatkan ke dua desimal. Toleransi satu sen menampung pembulatan itu.
    const expected = BigInt(Math.round(Number(internal) * Number(category.ratioPercentage)));
    const actual = parseNumericToCents(category.allocatedAmount);
    const drift = actual > expected ? actual - expected : expected - actual;
    if (drift <= 1n) continue;

    violations.push({
      subject: `project_budget_category ${category.id}`,
      expected: fromCents(expected),
      actual: fromCents(actual),
      detail: `rasio ${category.ratioPercentage} × internal budget ${fromCents(internal)}`,
    });
  }

  return {
    id: "I3",
    title: "Alokasi tiap kategori sama dengan rasionya atas internal budget",
    consequence:
      "Pagu kategori bergeser dari dasar perhitungannya. Peringatan over-budget menyala atau diam pada ambang yang salah.",
    checked: categories.length,
    violations,
  };
}

export async function checkBudgetAllocationsMatchInternalBudget(): Promise<InvariantResult> {
  const [budgets, categories] = await Promise.all([
    db
      .select({ id: projectBudgets.id, internalBudget: projectBudgets.internalBudget })
      .from(projectBudgets),
    db
      .select({
        id: projectBudgetCategory.id,
        projectBudgetId: projectBudgetCategory.projectBudgetId,
        ratioPercentage: projectBudgetCategory.ratioPercentage,
        allocatedAmount: projectBudgetCategory.allocatedAmount,
      })
      .from(projectBudgetCategory),
  ]);

  return evaluateBudgetAllocations(budgets, categories);
}

// ==========================================
// I4. Setiap mutasi saldo meninggalkan jejak audit
// ==========================================
export type AuditRow = {
  readonly action: string;
  readonly targetId: string;
  readonly targetTable: string;
};

export function evaluateEveryLedgerEntryHasAudit(
  ledger: readonly LedgerRow[],
  audits: readonly AuditRow[],
): InvariantResult {
  const ledgerCount = new Map<string, number>();
  for (const row of ledger) {
    const bucket = `${row.bankAccountId}:${row.type}`;
    ledgerCount.set(bucket, (ledgerCount.get(bucket) ?? 0) + 1);
  }

  const auditCount = new Map<string, number>();
  for (const row of audits) {
    if (row.targetTable !== "bank_account") continue;
    const direction =
      row.action === "INFLOW_BANK_ACCOUNT"
        ? "INFLOW"
        : row.action === "OUTFLOW_BANK_ACCOUNT"
          ? "OUTFLOW"
          : null;
    if (direction === null) continue;
    const bucket = `${row.targetId}:${direction}`;
    auditCount.set(bucket, (auditCount.get(bucket) ?? 0) + 1);
  }

  const violations: InvariantViolation[] = [];
  for (const [bucket, expected] of ledgerCount) {
    const actual = auditCount.get(bucket) ?? 0;
    if (actual >= expected) continue;

    const separator = bucket.lastIndexOf(":");
    violations.push({
      subject: `bank_account ${bucket.slice(0, separator)} arah ${bucket.slice(separator + 1)}`,
      expected: `${expected} baris audit`,
      actual: `${actual} baris audit`,
      detail: "ada entri buku besar yang ditulis di luar mutateBalance",
    });
  }

  return {
    id: "I4",
    title: "Setiap entri buku besar punya pasangan jejak audit",
    consequence:
      "Ada uang yang bergerak tanpa jejak siapa yang menggerakkan. Ini tanda jalur tulis yang melewati mutateBalance.",
    checked: ledger.length,
    violations,
  };
}

export async function checkEveryLedgerEntryHasAudit(): Promise<InvariantResult> {
  const [ledger, audits] = await Promise.all([
    db
      .select({
        bankAccountId: cashTransaction.bankAccountId,
        type: cashTransaction.type,
        amount: cashTransaction.amount,
      })
      .from(cashTransaction),
    db
      .select({
        action: auditLog.action,
        targetId: auditLog.targetId,
        targetTable: auditLog.targetTable,
      })
      .from(auditLog),
  ]);

  return evaluateEveryLedgerEntryHasAudit(ledger, audits);
}

// ==========================================
// I5. Tidak ada pergerakan stok tanpa arah
// ==========================================
/**
 * Sengaja daftar-larangan, bukan daftar-izin.
 *
 * `RESERVE` satu-satunya tipe yang sah bertanda `NEUTRAL`: ia memindahkan
 * `reserved_stock`, bukan `current_stock`. Tipe pergerakan baru karena itu
 * dianggap mengubah stok sampai terbukti sebaliknya — arah yang aman untuk
 * salah, karena tipe yang lupa diberi arah tidak ikut dijumlahkan I2 dan
 * membuat ketidakcocokan stok menghilang dari radar alih-alih muncul.
 */
export const NEUTRAL_BY_DESIGN: ReadonlySet<string> = new Set(["RESERVE"]);

export function evaluateStockMovementsHaveDirection(
  movements: readonly MovementRow[],
): InvariantResult {
  const violations = movements
    .filter((row) => row.direction === "NEUTRAL" && !NEUTRAL_BY_DESIGN.has(row.movementType))
    .map((row) => ({
      subject: `stock_movement ${row.id}`,
      expected: "IN atau OUT",
      actual: "NEUTRAL",
      detail: `movement_type ${row.movementType}`,
    }));

  return {
    id: "I5",
    title: "Pergerakan yang mengubah stok punya arah",
    consequence:
      "Pergerakan tanpa arah tidak ikut dijumlahkan, sehingga I2 diam-diam lulus padahal stoknya salah. Cacat ini pernah nyata untuk USE, WASTE, dan RETURN.",
    checked: movements.length,
    violations,
  };
}

export async function checkStockMovementsHaveDirection(): Promise<InvariantResult> {
  const movements = await db
    .select({
      id: stockMovement.id,
      materialId: stockMovement.materialId,
      locationId: stockMovement.inventoryLocationId,
      movementType: stockMovement.movementType,
      direction: stockMovement.movementDirection,
      quantity: stockMovement.quantity,
    })
    .from(stockMovement);

  return evaluateStockMovementsHaveDirection(movements);
}

// ==========================================
// I6. Pembayaran vendor yang selesai punya entri kas
// ==========================================
export type VendorPaymentRow = {
  readonly id: string;
  readonly status: string;
  readonly cashTransactionId: string | null;
  readonly amountPaid: string;
};

export function evaluateCompletedVendorPaymentsHaveCashEntry(
  payments: readonly VendorPaymentRow[],
  ledgerIds: ReadonlySet<string>,
): InvariantResult {
  const completed = payments.filter((payment) => payment.status === "COMPLETED");

  const violations: InvariantViolation[] = [];
  for (const payment of completed) {
    if (payment.cashTransactionId === null) {
      violations.push({
        subject: `vendor_payment ${payment.id}`,
        expected: "cash_transaction_id terisi",
        actual: "null",
        detail: `nominal ${payment.amountPaid} berstatus COMPLETED`,
      });
      continue;
    }
    if (ledgerIds.has(payment.cashTransactionId)) continue;

    violations.push({
      subject: `vendor_payment ${payment.id}`,
      expected: "menunjuk cash_transaction yang ada",
      actual: `cash_transaction ${payment.cashTransactionId} tidak ditemukan`,
    });
  }

  return {
    id: "I6",
    title: "Pembayaran vendor yang selesai punya entri kas nyata",
    consequence:
      "Tagihan tercatat lunas tanpa uang yang benar-benar keluar. Vendor menagih lagi dan tidak ada baris yang membantah.",
    checked: completed.length,
    violations,
  };
}

export async function checkCompletedVendorPaymentsHaveCashEntry(): Promise<InvariantResult> {
  const [payments, ledger] = await Promise.all([
    db
      .select({
        id: vendorPayment.id,
        status: vendorPayment.status,
        cashTransactionId: vendorPayment.cashTransactionId,
        amountPaid: vendorPayment.amountPaid,
      })
      .from(vendorPayment),
    db.select({ id: cashTransaction.id }).from(cashTransaction),
  ]);

  return evaluateCompletedVendorPaymentsHaveCashEntry(
    payments,
    new Set(ledger.map((row) => row.id)),
  );
}

export const LEDGER_INVARIANTS = [
  checkBankBalanceMatchesLedger,
  checkInventoryMatchesMovements,
  checkBudgetAllocationsMatchInternalBudget,
  checkEveryLedgerEntryHasAudit,
  checkStockMovementsHaveDirection,
  checkCompletedVendorPaymentsHaveCashEntry,
] as const;

export async function runAllInvariants(): Promise<readonly InvariantResult[]> {
  const results: InvariantResult[] = [];
  for (const check of LEDGER_INVARIANTS) results.push(await check());
  return results;
}
