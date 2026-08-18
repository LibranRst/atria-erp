import { afterAll, beforeAll, expect, it, mock } from "bun:test";
import { fileURLToPath } from "node:url";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  bankAccount,
  bankStatementImport,
  bankStatementRow,
  cashTransaction,
  clientInvoice,
  inventoryOpeningBatch,
  materialInventory,
  project,
  projectProfitabilitySnapshot,
  vendorBill,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  approveFieldRequest,
  approveVendorPayment,
  payFieldRequest,
  verifyFieldRequest,
} from "@/app/actions/finance/field-requests";
import { payVendorBill } from "@/app/actions/finance/pay-vendor-bill";
import { recordClientPayment } from "@/app/actions/finance/record-client-payment";
import { transferBetweenBankAccounts } from "@/app/actions/finance/bank-account-movements";
import {
  clearReconciliationException,
  markReconciliationException,
  reconcileCashTransaction,
} from "@/app/actions/finance/reconcile-cash-transaction";
import { importBankStatementCsv } from "@/app/actions/finance/reconciliation-statement-actions";
import { decideInventoryOpening } from "@/app/actions/material/opening-inventory-mutations";
import {
  reserveMaterialForProject,
  returnMaterialFromProject,
  useMaterialForProject,
  wasteMaterialForProject,
} from "@/app/actions/material/inventory-movements";
import { completeProject, getProjectClosingChecklist } from "@/app/actions/project/closing";
import { describeIntegration } from "@/lib/testing/integration-db";

/**
 * Tulang punggung kas `docs/guide/seeded_demo_walkthrough.md` bagian 6 sampai 9,
 * dijalankan berurutan lewat Server Action asli di atas connected demo seed.
 *
 * Walkthrough itu berantai: saldo hasil satu langkah menjadi angka pembuka
 * langkah berikutnya. Karena itu yang diuji bukan tiap aksi sendiri-sendiri,
 * melainkan bahwa seluruh rantai mendarat persis pada saldo yang dijanjikan
 * panduan. Test ini menuntut database demo yang baru saja di-reset.
 */

mock.module("next/headers", () => ({
  cookies: () => ({ toString: () => "mocked-cookies" }),
}));

// Di luar request Next, `revalidatePath` melempar "static generation store
// missing" sesudah transaksi commit — action tampak gagal padahal datanya sudah
// masuk. Yang diuji di sini adalah akibat finansialnya, bukan cache Next.
mock.module("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

const RONALD = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};
const LISA = {
  id: "22222222-2222-2222-2222-222222222222",
  roleId: "00000000-0000-0000-0000-000000000002",
  email: "lisa@dekoria.com",
  name: "Lisa Permata",
};

function actAs(user: typeof RONALD): void {
  (auth.api as unknown as { getSession: unknown }).getSession = async (): Promise<unknown> => ({
    session: {
      id: "mock-session-id",
      userId: user.id,
      expiresAt: new Date(Date.now() + 3_600_000),
      token: "mock-token",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: { ...user, emailVerified: true, isActive: true },
  });
}

const AGUS = {
  id: "33333333-3333-3333-3333-333333333333",
  roleId: "00000000-0000-0000-0000-000000000004",
  email: "agus@dekoria.com",
  name: "Agus Pratama",
};

const BCA = "66666666-6666-6666-6666-666666666661";
const KAS_BUDI = "66666666-6666-6666-6666-666666666662";
const MANDIRI = "66666666-6666-6666-6666-666666666663";

const COST_1050 = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f003";
const COST_5000 = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f001";
const COST_6200 = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f002";
const PAY_4JT = "34043404-3404-3404-3404-340434043401";
const PAY_10JT = "34043404-3404-3404-3404-340434043402";
const INV_002 = "01010101-0101-0101-0101-010101010102";

// 10 — dua pasangan rekonsiliasi bawaan seed.
const TX_850 = "cccccccc-cccc-cccc-cccc-cccccccccc08"; // Kas Budi
const ROW_850 = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee09"; // Kas Budi
const TX_2500 = "cccccccc-cccc-cccc-cccc-cccccccccc10"; // Kas Siti
const ROW_2500 = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10"; // Kas Siti

// 11 — batch opening stock menunggu approval, dan Multipleks di Gudang Utama.
const OPB_PENDING = "95959595-9595-9595-9595-959595959502";
const MULTIPLEKS = "13131313-1313-1313-1313-131313131301";
const GUDANG_UTAMA = "14141414-1414-1414-1414-141414141401";
const MENTENG = "77777777-7777-7777-7777-777777777771";
const SENOPATI = "77777777-7777-7777-7777-777777777776";

async function balance(accountId: string): Promise<string> {
  const row = await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, accountId) });
  if (!row) throw new Error("Rekening fixture tidak ditemukan.");
  return row.balance;
}

// Rantai ini mengonsumsi fixture: sesudah dijalankan, saldo dan status sudah
// bergerak. Menjalankannya dua kali tanpa reset akan gagal beruntun dengan
// pesan yang membingungkan, jadi prasyaratnya diperiksa lebih dulu.
const BASELINE: ReadonlyArray<readonly [string, string, string]> = [
  [BCA, "BCA Operasional", "655000000.00"],
  [KAS_BUDI, "Kas Kecil PM Budi", "14150000.00"],
  [MANDIRI, "Mandiri Giro Utama", "500000000.00"],
];

async function stock(): Promise<{ current: string; reserved: string }> {
  const row = await db.query.materialInventory.findFirst({
    where: and(
      eq(materialInventory.materialId, MULTIPLEKS),
      eq(materialInventory.locationId, GUDANG_UTAMA),
    ),
  });
  if (!row) throw new Error("Inventory Multipleks fixture tidak ditemukan.");
  return { current: row.currentStock, reserved: row.reservedStock };
}

/** Sidik jari satu sisi rekonsiliasi: nominal + arah, diurutkan agar bisa dibandingkan. */
function fingerprints(rows: ReadonlyArray<{ amount: string; type: string }>): readonly string[] {
  return rows.map((row) => `${row.type} ${Number(row.amount).toFixed(2)}`).sort();
}

async function unreconciledLedger(accountId: string): Promise<readonly string[]> {
  const rows = await db
    .select({ amount: cashTransaction.amount, type: cashTransaction.type })
    .from(cashTransaction)
    .where(
      and(eq(cashTransaction.bankAccountId, accountId), eq(cashTransaction.reconciled, false)),
    );
  return fingerprints(rows);
}

async function unmatchedStatement(accountId: string): Promise<readonly string[]> {
  const rows = await db
    .select({ amount: bankStatementRow.amount, type: bankStatementRow.type })
    .from(bankStatementRow)
    .innerJoin(bankStatementImport, eq(bankStatementImport.id, bankStatementRow.importId))
    .where(
      and(
        eq(bankStatementImport.bankAccountId, accountId),
        eq(bankStatementRow.isReconciled, false),
      ),
    );
  return fingerprints(rows);
}

async function importDemoCsv(
  accountId: string,
  pattern: string,
): Promise<{ imported: number; duplicates: number }> {
  const dir = fileURLToPath(new URL("../../.atria-demo/", import.meta.url));
  const fileName = (await Array.fromAsync(new Bun.Glob(pattern).scan(dir)))[0];
  if (!fileName) throw new Error(`Fixture CSV ${pattern} tidak ditemukan di .atria-demo/.`);
  const content = await Bun.file(dir + fileName).text();
  const result = await importBankStatementCsv({ bankAccountId: accountId, fileName, content });
  if (!result.success) throw new Error(`Impor ${fileName} gagal: ${result.error.message}`);
  return { imported: result.data.importedCount, duplicates: result.data.duplicateCount };
}

async function cashTransactionCount(): Promise<number> {
  const rows = await db.select({ id: cashTransaction.id }).from(cashTransaction);
  return rows.length;
}

describeIntegration("seeded demo walkthrough — tulang punggung kas", () => {
  beforeAll(async () => {
    for (const [id, name, expected] of BASELINE) {
      const actual = await balance(id);
      if (actual !== expected) {
        throw new Error(
          `Fixture demo tidak berada di baseline (${name} = ${actual}, seharusnya ${expected}). ` +
            "Jalankan `bun run db:demo:reset --confirm-reset` terhadap ATRIA_TEST_DATABASE_URL sebelum suite ini.",
        );
      }
    }
    actAs(RONALD);
  });

  afterAll(() => {
    (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
  });

  // 6.1 — expense Rp1.050.000 sudah APPROVED, tinggal dicairkan Finance.
  it("6.1 pays the Rp1.050.000 expense from Kas Budi", async () => {
    expect(await balance(KAS_BUDI)).toBe("14150000.00");
    actAs(LISA);

    const result = await payFieldRequest(COST_1050, KAS_BUDI, "DEMO-EXP-1050");

    expect(result.success).toBe(true);
    expect(await balance(KAS_BUDI)).toBe("13100000.00");
  });

  // 6.2 — maker Budi, verifier Lisa, approver Ronald, payer Lisa.
  it("6.2 runs the Rp5.000.000 expense through verify, approve, and pay", async () => {
    actAs(LISA);
    expect((await verifyFieldRequest(COST_5000)).success).toBe(true);

    actAs(RONALD);
    const approved = await approveFieldRequest({
      projectCostId: COST_5000,
      status: "APPROVED",
      notes: "Disetujui untuk walkthrough demo.",
      emergencyOverride: false,
    });
    expect(approved.success).toBe(true);

    actAs(LISA);
    const paid = await payFieldRequest(COST_5000, KAS_BUDI, "DEMO-EXP-5000");

    expect(paid.success).toBe(true);
    expect(await balance(KAS_BUDI)).toBe("8100000.00");
  });

  // 6.3 — over-budget Subcon milik Sudirman, dibayar dari Mandiri.
  it("6.3 runs the Rp6.200.000 over-budget expense and pays it from Mandiri", async () => {
    expect(await balance(MANDIRI)).toBe("500000000.00");

    actAs(LISA);
    expect((await verifyFieldRequest(COST_6200)).success).toBe(true);

    actAs(RONALD);
    const approved = await approveFieldRequest({
      projectCostId: COST_6200,
      status: "APPROVED",
      notes: "Perbaikan waterproofing disetujui.",
      emergencyOverride: false,
    });
    expect(approved.success).toBe(true);

    actAs(LISA);
    const paid = await payFieldRequest(COST_6200, MANDIRI, "DEMO-EXP-6200");

    expect(paid.success).toBe(true);
    expect(await balance(MANDIRI)).toBe("493800000.00");
  });

  // 7.1 — payment Rp4.000.000 tidak menuntut Owner.
  it("7.1 pays the Rp4.000.000 vendor payment and leaves the bill partially paid", async () => {
    expect(await balance(BCA)).toBe("655000000.00");
    actAs(LISA);

    const result = await payVendorBill({
      vendorPaymentId: PAY_4JT,
      referenceNumber: "DEMO-VENDOR-4000",
      bankAccountId: BCA,
    });

    expect(result.success).toBe(true);
    expect(await balance(BCA)).toBe("651000000.00");

    const bill = await db.query.vendorBill.findFirst({
      where: eq(vendorBill.billNumber, "BILL-2026-091"),
    });
    expect(bill?.status).toBe("PARTIALLY_PAID");
  });

  // 7.2 — Rp10.000.000 harus ditolak sebelum Owner menyetujui.
  it("7.2 refuses the Rp10.000.000 payment before approval, then releases it", async () => {
    actAs(LISA);
    const premature = await payVendorBill({
      vendorPaymentId: PAY_10JT,
      referenceNumber: "DEMO-VENDOR-10000",
      bankAccountId: BCA,
    });

    expect(premature.success).toBe(false);
    expect(await balance(BCA)).toBe("651000000.00");

    actAs(RONALD);
    const approval = await approveVendorPayment(PAY_10JT, "Disetujui Owner.", "APPROVED", false);
    expect(approval.success).toBe(true);

    actAs(LISA);
    const paid = await payVendorBill({
      vendorPaymentId: PAY_10JT,
      referenceNumber: "DEMO-VENDOR-10000",
      bankAccountId: BCA,
    });

    expect(paid.success).toBe(true);
    expect(await balance(BCA)).toBe("641000000.00");
  });

  // 8 — pelunasan kumulatif: Rp120 juta + Rp200 juta menutup invoice Rp320 juta.
  it("8 records the Rp200.000.000 client payment and closes the invoice", async () => {
    actAs(LISA);

    const result = await recordClientPayment({
      clientInvoiceId: INV_002,
      bankAccountId: BCA,
      amountPaid: 200_000_000,
      paymentDate: new Date(),
      referenceNumber: "DEMO-CLIENT-200M",
    });

    expect(result.success).toBe(true);
    expect(await balance(BCA)).toBe("841000000.00");

    const invoice = await db.query.clientInvoice.findFirst({
      where: eq(clientInvoice.id, INV_002),
    });
    expect(invoice?.status).toBe("PAID");
  });

  // 8 lanjutan — pembayaran tambahan harus ditolak sebagai overpayment.
  it("8 refuses a further payment on the settled invoice", async () => {
    actAs(LISA);
    const overpay = await recordClientPayment({
      clientInvoiceId: INV_002,
      bankAccountId: BCA,
      amountPaid: 1_000_000,
      paymentDate: new Date(),
      referenceNumber: "DEMO-CLIENT-OVERPAY",
    });

    expect(overpay.success).toBe(false);
    expect(await balance(BCA)).toBe("841000000.00");
  });

  // 9 — transfer internal: kas perusahaan tidak berubah, hanya berpindah.
  it("9 transfers Rp5.000.000 from BCA to Kas Budi without changing net cash", async () => {
    actAs(LISA);

    const result = await transferBetweenBankAccounts({
      fromBankAccountId: BCA,
      toBankAccountId: KAS_BUDI,
      amount: 5_000_000,
      description: "Top up kas kecil demo",
      transactionDate: new Date(),
      referenceNumber: "DEMO-TRANSFER-5M",
    });

    expect(result.success).toBe(true);
    expect(await balance(BCA)).toBe("836000000.00");
    expect(await balance(KAS_BUDI)).toBe("13100000.00");
  });

  // 10.1 — pengecualian mendokumentasikan, bukan mencocokkan.
  it("10.1 documents a reconciliation exception without touching the balance", async () => {
    actAs(LISA);
    const before = await balance(KAS_BUDI);

    const marked = await markReconciliationException({
      cashTransactionId: TX_850,
      reason: "Menunggu konfirmasi tanggal dari kasir proyek.",
    });
    expect(marked.success).toBe(true);

    const flagged = await db.query.cashTransaction.findFirst({
      where: eq(cashTransaction.id, TX_850),
    });
    expect(flagged?.reconciled).toBe(false);
    expect(await balance(KAS_BUDI)).toBe(before);

    const cleared = await clearReconciliationException({ cashTransactionId: TX_850 });
    expect(cleared.success).toBe(true);
  });

  it("10.1 refuses an exception reason shorter than ten characters", async () => {
    actAs(LISA);
    const result = await markReconciliationException({
      cashTransactionId: TX_850,
      reason: "typo",
    });
    expect(result.success).toBe(false);
  });

  // 13 — nominal sama saja tidak cukup; rekening harus sama juga. Harus diuji
  // selagi kedua transaksi masih terbuka: sesudah dicocokkan, penolakan datang
  // dari penjagaan "sudah direkonsiliasi" dan tidak membuktikan apa pun.
  it("10.2 refuses a match across two different bank accounts", async () => {
    actAs(LISA);
    const result = await reconcileCashTransaction({
      cashTransactionId: TX_850,
      bankStatementRowId: ROW_2500,
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("unreachable");
    expect(result.error.message).toContain("tidak sama");
  });

  // 10.2 — mencocokkan tidak menggerakkan saldo.
  it("10.2 matches both seeded pairs without moving any balance", async () => {
    actAs(LISA);
    const budiBefore = await balance(KAS_BUDI);
    const sitiBefore = await balance("66666666-6666-6666-6666-666666666664");

    expect(
      (await reconcileCashTransaction({ cashTransactionId: TX_850, bankStatementRowId: ROW_850 }))
        .success,
    ).toBe(true);
    expect(
      (await reconcileCashTransaction({ cashTransactionId: TX_2500, bankStatementRowId: ROW_2500 }))
        .success,
    ).toBe(true);

    expect(await balance(KAS_BUDI)).toBe(budiBefore);
    expect(await balance("66666666-6666-6666-6666-666666666664")).toBe(sitiBefore);

    const matched = await db.query.cashTransaction.findFirst({
      where: eq(cashTransaction.id, TX_850),
    });
    expect(matched?.reconciled).toBe(true);
  });

  // 13 — transaksi yang sudah direkonsiliasi tidak dapat disentuh lagi oleh
  // satu pun dari ketiga jalur yang boleh menulis ke cash_transaction.
  it("10.2 freezes a reconciled transaction against all three write paths", async () => {
    actAs(LISA);

    const rematch = await reconcileCashTransaction({
      cashTransactionId: TX_850,
      bankStatementRowId: ROW_850,
    });
    expect(rematch.success).toBe(false);

    const exception = await markReconciliationException({
      cashTransactionId: TX_850,
      reason: "Mencoba menandai transaksi yang sudah cocok.",
    });
    expect(exception.success).toBe(false);

    const cleared = await clearReconciliationException({ cashTransactionId: TX_850 });
    expect(cleared.success).toBe(false);

    const frozen = await db.query.cashTransaction.findFirst({
      where: eq(cashTransaction.id, TX_850),
    });
    expect(frozen?.reconciled).toBe(true);
    expect(frozen?.reconciliationExceptionReason).toBeNull();
  });

  // 10.3 — inti janji bagian ini: setiap transaksi yang dibuat walkthrough
  // punya tepat satu lawan di rekening koran, pada rekening dan arah yang sama.
  it("10.3 imports all three statements and every walkthrough transaction finds its counterpart", async () => {
    actAs(LISA);
    const balancesBefore = [await balance(BCA), await balance(KAS_BUDI), await balance(MANDIRI)];

    const bca = await importDemoCsv(BCA, "bca-operasional-*.csv");
    const budi = await importDemoCsv(KAS_BUDI, "kas-pm-budi-*.csv");
    const mandiri = await importDemoCsv(MANDIRI, "mandiri-utama-*.csv");
    expect([bca.imported, budi.imported, mandiri.imported].every((n) => n > 0)).toBe(true);

    for (const account of [BCA, KAS_BUDI, MANDIRI]) {
      const ledger = await unreconciledLedger(account);
      // Tanpa penjagaan ini, dua sisi yang sama-sama kosong akan lolos diam-diam.
      expect(ledger.length).toBeGreaterThan(0);
      expect(await unmatchedStatement(account)).toEqual(ledger);
    }

    // Impor rekening koran tidak pernah menggerakkan saldo ledger.
    expect([await balance(BCA), await balance(KAS_BUDI), await balance(MANDIRI)]).toEqual(
      balancesBefore,
    );
  });

  it("10.3 skips every row when the same file is imported twice", async () => {
    actAs(LISA);
    const balanceBefore = await balance(BCA);
    const again = await importDemoCsv(BCA, "bca-operasional-*.csv");

    expect(again.imported).toBe(0);
    expect(again.duplicates).toBeGreaterThan(0);
    expect(await balance(BCA)).toBe(balanceBefore);
  });

  // 11.1 — maker Purchasing, approver harus orang lain.
  it("11.1 refuses the opening batch approval by its own maker", async () => {
    actAs(AGUS);
    const result = await decideInventoryOpening({
      batchId: OPB_PENDING,
      decision: "APPROVE",
      reason: "Mencoba menyetujui batch buatan sendiri.",
      emergencyOverride: false,
    });
    expect(result.success).toBe(false);
  });

  it("11.1 posts the opening batch once Owner approves it", async () => {
    actAs(RONALD);
    const result = await decideInventoryOpening({
      batchId: OPB_PENDING,
      decision: "APPROVE",
      reason: "Opening stock Workshop Cikupa sudah dicek fisik.",
      emergencyOverride: false,
    });

    expect(result.success).toBe(true);
    const batch = await db.query.inventoryOpeningBatch.findFirst({
      where: eq(inventoryOpeningBatch.id, OPB_PENDING),
    });
    expect(batch?.status).toBe("POSTED");
  });

  // 11.3 — reserve, use, return, waste tidak pernah menyentuh kas.
  it("11.3 runs reserve, use, return, and waste without creating a cash transaction", async () => {
    actAs(AGUS);
    const opening = await stock();
    const cashBefore = await cashTransactionCount();

    const reserved = await reserveMaterialForProject({
      materialId: MULTIPLEKS,
      inventoryLocationId: GUDANG_UTAMA,
      projectId: MENTENG,
      quantity: 2,
      note: "Reservasi tambahan walkthrough demo.",
    });
    expect(reserved.success).toBe(true);
    // Reserve hanya mengunci: stok fisik tidak bergerak.
    expect((await stock()).current).toBe(opening.current);
    expect(Number((await stock()).reserved)).toBe(Number(opening.reserved) + 2);

    const used = await useMaterialForProject({
      materialId: MULTIPLEKS,
      inventoryLocationId: GUDANG_UTAMA,
      projectId: MENTENG,
      quantity: 2,
      note: "Pemakaian walkthrough demo.",
    });
    expect(used.success).toBe(true);
    expect(Number((await stock()).current)).toBe(Number(opening.current) - 2);
    expect(Number((await stock()).reserved)).toBe(Number(opening.reserved));

    const returned = await returnMaterialFromProject({
      materialId: MULTIPLEKS,
      inventoryLocationId: GUDANG_UTAMA,
      projectId: MENTENG,
      quantity: 1,
      note: "Pengembalian sisa walkthrough demo.",
    });
    expect(returned.success).toBe(true);
    expect(Number((await stock()).current)).toBe(Number(opening.current) - 1);

    const wasted = await wasteMaterialForProject({
      materialId: MULTIPLEKS,
      inventoryLocationId: GUDANG_UTAMA,
      projectId: MENTENG,
      quantity: 1,
      note: "Material rusak saat pemotongan walkthrough demo.",
    });
    expect(wasted.success).toBe(true);
    expect(Number((await stock()).current)).toBe(Number(opening.current) - 2);

    expect(await cashTransactionCount()).toBe(cashBefore);
  });

  it("11.3 refuses a usage larger than the stock on hand", async () => {
    actAs(AGUS);
    const before = await stock();

    const result = await useMaterialForProject({
      materialId: MULTIPLEKS,
      inventoryLocationId: GUDANG_UTAMA,
      projectId: MENTENG,
      quantity: Number(before.current) + 1,
      note: "Mencoba memakai lebih banyak dari isi gudang.",
    });

    expect(result.success).toBe(false);
    expect(await stock()).toEqual(before);
  });

  it("11.3 refuses a waste without an audit note", async () => {
    actAs(AGUS);
    const result = await wasteMaterialForProject({
      materialId: MULTIPLEKS,
      inventoryLocationId: GUDANG_UTAMA,
      projectId: MENTENG,
      quantity: 1,
      note: "x",
    });
    expect(result.success).toBe(false);
  });

  // 12.2 — Senopati siap ditutup, Menteng tidak.
  it("12.2 reports Senopati as closable and Menteng as blocked", async () => {
    actAs(RONALD);

    const senopati = await getProjectClosingChecklist(SENOPATI);
    expect(senopati.success).toBe(true);
    if (!senopati.success) throw new Error("unreachable");
    expect(senopati.data.blockers).toEqual([]);
    expect(senopati.data.canComplete).toBe(true);

    const menteng = await getProjectClosingChecklist(MENTENG);
    expect(menteng.success).toBe(true);
    if (!menteng.success) throw new Error("unreachable");
    expect(menteng.data.canComplete).toBe(false);
    expect(menteng.data.blockers.length).toBeGreaterThan(0);
  });

  // Ditutup dua kali sekaligus dengan sengaja. Checklist kesiapan dibangun di
  // luar transaksi penutupan, jadi dua permintaan yang berlomba sama-sama lolos
  // `canComplete`; tanpa kunci baris proyek keduanya menyisipkan snapshot final
  // dan proyek berakhir dengan dua catatan margin permanen.
  it("12.2 closes Senopati exactly once even when two closings race", async () => {
    actAs(RONALD);
    const input = {
      projectId: SENOPATI,
      closingNote: "Seluruh dokumen final sudah diperiksa.",
    };

    const [a, b] = await Promise.all([completeProject(input), completeProject(input)]);
    expect([a.success, b.success].filter(Boolean).length).toBe(1);

    const closed = await db.query.project.findFirst({ where: eq(project.id, SENOPATI) });
    expect(closed?.status).toBe("COMPLETED");
    expect(closed?.endDate).not.toBeNull();

    const snapshots = await db
      .select({ id: projectProfitabilitySnapshot.id })
      .from(projectProfitabilitySnapshot)
      .where(eq(projectProfitabilitySnapshot.projectId, SENOPATI));
    expect(snapshots.length).toBe(1);
  });

  it("12.2 refuses to close Menteng while blockers remain", async () => {
    actAs(RONALD);
    const result = await completeProject({
      projectId: MENTENG,
      closingNote: "Mencoba menutup proyek yang masih berjalan.",
    });
    expect(result.success).toBe(false);
  });
});
