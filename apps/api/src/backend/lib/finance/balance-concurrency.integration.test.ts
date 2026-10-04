import { afterAll, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import { auditLog, bankAccount, cashTransaction } from "@backend/db/schema";
import { describeIntegration } from "@backend/lib/testing/integration-db";
import { mutateBalance } from "./balance-mutation";

describeIntegration("saldo rekening pada request concurrent", () => {
  const accountId = crypto.randomUUID();
  const actorId = "11111111-1111-1111-1111-111111111111";

  afterAll(async () => {
    // Hanya fixture milik suite ini, tidak memakai rekening seeded bersama.
    await db.transaction(async (tx) => {
      await tx.delete(cashTransaction).where(eq(cashTransaction.bankAccountId, accountId));
      await tx
        .delete(auditLog)
        .where(and(eq(auditLog.targetTable, "bank_account"), eq(auditLog.targetId, accountId)));
      await tx.delete(bankAccount).where(eq(bankAccount.id, accountId));
    });
  });

  test("dua penarikan tidak dapat memakai saldo awal yang sama", async () => {
    await db.insert(bankAccount).values({
      id: accountId,
      name: "Concurrency fixture",
      accountNumber: accountId,
      bankName: "Test",
      holderName: "Test",
    });
    await db.transaction(async (tx) => {
      await mutateBalance({
        tx,
        bankAccountId: accountId,
        type: "INFLOW",
        amount: "1000.00",
        category: "opening_balance",
        referenceType: "opening_balance",
        referenceId: crypto.randomUUID(),
        description: "Fixture opening",
        userId: actorId,
      });
    });
    const firstReady = Promise.withResolvers<void>();
    const releaseFirst = Promise.withResolvers<void>();
    const withdraw = (attempt: number): Promise<typeof cashTransaction.$inferSelect> =>
      db.transaction(async (tx) => {
        const entry = await mutateBalance({
          tx,
          bankAccountId: accountId,
          type: "OUTFLOW",
          amount: "700.00",
          category: "field_claim",
          referenceType: "manual_cash_movement",
          referenceId: crypto.randomUUID(),
          description: `Concurrent fixture ${attempt}`,
          userId: actorId,
        });
        if (attempt === 1) {
          firstReady.resolve();
          await releaseFirst.promise;
        }
        return entry;
      });
    const first = withdraw(1);
    // Tahan transaksi pertama saat request kedua mulai, bukan sekadar
    // mengandalkan dua koneksi yang mungkin ternyata selesai berurutan.
    let results: PromiseSettledResult<typeof cashTransaction.$inferSelect>[];
    try {
      await Promise.race([firstReady.promise, first]);
      const settled = Promise.allSettled([first, withdraw(2)]);
      await Bun.sleep(100);
      releaseFirst.resolve();
      results = await settled;
    } finally {
      releaseFirst.resolve();
    }
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected?.status !== "rejected") throw new Error("Satu penarikan wajib ditolak");
    expect(String(rejected.reason)).toContain("INSUFFICIENT_FUNDS");
    expect(
      (await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, accountId) }))?.balance,
    ).toBe("300.00");
    const ledger = await db
      .select()
      .from(cashTransaction)
      .where(eq(cashTransaction.bankAccountId, accountId));
    expect(ledger).toHaveLength(2);
    expect(ledger.filter((row) => row.type === "OUTFLOW")).toHaveLength(1);
    expect(
      await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.targetTable, "bank_account"), eq(auditLog.targetId, accountId))),
    ).toHaveLength(2);
  });
});
