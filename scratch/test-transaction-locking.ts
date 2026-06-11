import { db } from "@/db";
import { bankAccount, cashTransaction } from "@/db/schema";
import { eq } from "drizzle-orm";
import { mutateBalance } from "@/lib/finance/balance-mutation";

async function runConcurrencyTest(): Promise<void> {
  console.log("=== MEMULAI PENGUJIAN KONKURENSI TRANSAKSI ===");

  const PETTY_CASH_ID = "66666666-6666-6666-6666-666666666663";
  const USER_BUDI_ID = "33333333-3333-3333-3333-333333333331";
  const PROJECT_MENTENG_ID = "77777777-7777-7777-7777-777777777771";

  // 1. Reset saldo Petty Cash Office ke Rp 13.000.000,00 untuk kebersihan pengujian
  console.log("1. Mereset saldo Petty Cash Office ke Rp 13.000.000,00...");
  await db
    .update(bankAccount)
    .set({ balance: "13000000.00", updatedAt: new Date() })
    .where(eq(bankAccount.id, PETTY_CASH_ID));

  // Ambil data untuk konfirmasi
  const initialAccount = await db.query.bankAccount.findFirst({
    where: eq(bankAccount.id, PETTY_CASH_ID),
  });
  console.log(`   Saldo Awal Terbaca: Rp ${Number(initialAccount?.balance).toLocaleString("id-ID")}`);

  // 2. Siapkan 5 mutasi kas keluar secara konkuren (masing-masing Rp 3.000.000,00)
  // Total penarikan yang diajukan = 5 * Rp 3.000.000,00 = Rp 15.000.000,00
  // Ekspektasi: Hanya 4 yang berhasil (Rp 12.000.000,00 terpotong), sisa saldo Rp 1.000.000,00, dan 1 gagal.
  console.log("2. Menyiapkan 5 transaksi keluar paralel (masing-masing Rp 3.000.000,00)...");
  
  const withdrawalAmount = "3000000.00";
  const tasks = Array.from({ length: 5 }).map((_, index) => {
    return async () => {
      const referenceId = `f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f01${index}`; // Unique reference ID per task
      
      try {
        const result = await db.transaction(async (tx) => {
          return await mutateBalance({
            tx,
            bankAccountId: PETTY_CASH_ID,
            type: "CREDIT",
            amount: withdrawalAmount,
            description: `Penarikan konkuren ke-${index + 1} PM Budi`,
            category: "reimbursement",
            referenceType: "project_cost",
            referenceId,
            userId: USER_BUDI_ID,
          });
        });
        return { success: true, index, result };
      } catch (error: any) {
        return { success: false, index, error: error.message };
      }
    };
  });

  // Jalankan semua task secara paralel/konkuren
  console.log("3. Memicu eksekusi transaksi secara paralel menggunakan Promise.all...");
  const results = await Promise.all(tasks.map((task) => task()));

  // 3. Analisis Hasil
  console.log("\n4. Hasil Eksekusi Mutasi Konkuren:");
  let successCount = 0;
  let failureCount = 0;
  let insufficientFundsCount = 0;

  results.forEach((res) => {
    if (res.success) {
      successCount++;
      console.log(`   [SUCCESS] Transaksi ke-${res.index + 1} berhasil.`);
    } else {
      failureCount++;
      console.log(`   [FAILED] Transaksi ke-${res.index + 1} gagal dengan alasan: ${res.error}`);
      if (res.error.includes("INSUFFICIENT_FUNDS")) {
        insufficientFundsCount++;
      }
    }
  });

  // 4. Verifikasi Akhir Saldo
  const finalAccount = await db.query.bankAccount.findFirst({
    where: eq(bankAccount.id, PETTY_CASH_ID),
  });
  const finalBalance = Number(finalAccount?.balance);

  console.log(`\n5. Verifikasi Saldo Akhir:`);
  console.log(`   Saldo Akhir: Rp ${finalBalance.toLocaleString("id-ID")}`);

  // Validasi Asersi
  const assertions = {
    exactlyFourSuccess: successCount === 4,
    exactlyOneFailure: failureCount === 1,
    failedDueToInsufficientFunds: insufficientFundsCount === 1,
    finalBalanceIsCorrect: finalBalance === 1000000,
  };

  console.log("\n=== RINGKASAN ASERSIL PENGUJIAN ===");
  console.log(`- Tepat 4 transaksi sukses: ${assertions.exactlyFourSuccess ? "✅ PASSED" : "❌ FAILED"} (${successCount}/4)`);
  console.log(`- Tepat 1 transaksi gagal: ${assertions.exactlyOneFailure ? "✅ PASSED" : "❌ FAILED"} (${failureCount}/1)`);
  console.log(`- Gagal karena saldo habis (INSUFFICIENT_FUNDS): ${assertions.failedDueToInsufficientFunds ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(`- Saldo akhir tepat Rp 1.000.000,00: ${assertions.finalBalanceIsCorrect ? "✅ PASSED" : "❌ FAILED"}`);

  const testPassed = Object.values(assertions).every(Boolean);
  if (testPassed) {
    console.log("\n✅ PENGUJIAN KONKURENSI SUKSES: Sistem locking pesimistis berjalan sempurna!");
    process.exit(0);
  } else {
    console.error("\n❌ PENGUJIAN KONKURENSI GAGAL: Terjadi inkonsistensi saldo atau race condition.");
    process.exit(1);
  }
}

runConcurrencyTest().catch((err) => {
  console.error("Terjadi error tak terduga pada runner test:", err);
  process.exit(1);
});
