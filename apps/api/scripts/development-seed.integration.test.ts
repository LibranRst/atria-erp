import { afterAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db, pool } from "@backend/db";
import {
  bankAccount,
  projectRapItem,
  rabEstimate,
  rabEstimateItem,
  stockMovement,
} from "@backend/db/schema";
import { verifyDevelopmentDataset } from "@backend/db/seed/development-validation";
import { DEMO_IDS } from "@backend/db/seed/demo-contract";
import { disposablePostgresTarget } from "./disposable-postgres-guard";

// Explicit opt-in to a disposable development-profile fixture. Normal workspace
// tests never inherit or alter the operator's development database.
const enabled = process.env.ATRIA_TEST_DEVELOPMENT_SEED === "true";
if (enabled) disposablePostgresTarget(process.env.ATRIA_TEST_DATABASE_URL, process.env.NODE_ENV);
const suite = enabled ? describe : describe.skip;
type SeedTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function rejectsCorruption(
  change: (tx: SeedTx) => Promise<void>,
  message: string,
): Promise<void> {
  const rollback = new Error("ROLLBACK_DEVELOPMENT_SEED_TEST");
  try {
    await db.transaction(async (tx) => {
      await change(tx);
      await expect(verifyDevelopmentDataset(tx)).rejects.toThrow(message);
      throw rollback;
    });
  } catch (error: unknown) {
    if (error !== rollback) throw error;
  }
}

suite("connected development fixture invariants on disposable PostgreSQL", () => {
  afterAll(async (): Promise<void> => {
    await pool.end();
  });

  test("complete finance, stock and planning baseline passes", async (): Promise<void> => {
    const report = await verifyDevelopmentDataset(db);
    expect(report.projects).toBe(9);
    expect(report.rapItems).toBeGreaterThan(200);
    expect(report.rabItems).toBeGreaterThan(250);
  });

  test("detects balance drift without changing the fixture", async (): Promise<void> => {
    await rejectsCorruption(async (tx): Promise<void> => {
      await tx
        .update(bankAccount)
        .set({ balance: "1.00" })
        .where(eq(bankAccount.id, DEMO_IDS.bankAccounts.mandiriMain));
    }, "tidak cocok dengan ledger");
  });

  test("detects a broken RAP quantity/buffer calculation", async (): Promise<void> => {
    await rejectsCorruption(async (tx): Promise<void> => {
      await tx
        .update(projectRapItem)
        .set({ totalQuantity: "1.00" })
        .where(eq(projectRapItem.id, "17171717-1717-1717-1717-171717171701"));
    }, "buffer/quantity/cost tidak cocok");
  });

  test("detects a RAB detail with a source from a different project", async (): Promise<void> => {
    await rejectsCorruption(async (tx): Promise<void> => {
      const [line] = await tx.select().from(rabEstimateItem).limit(1);
      if (!line) throw new Error("Missing development RAB detail");
      const [estimate] = await tx
        .select()
        .from(rabEstimate)
        .where(eq(rabEstimate.id, line.rabEstimateId));
      if (!estimate) throw new Error("Missing development RAB document");
      const otherSource =
        estimate.projectId === DEMO_IDS.projects.menteng
          ? "17171717-1717-1717-1717-171717171704"
          : "17171717-1717-1717-1717-171717171701";
      await tx
        .update(rabEstimateItem)
        .set({ sourceType: "RAP_MATERIAL", sourceProjectRapItemId: otherSource })
        .where(eq(rabEstimateItem.id, line.id));
    }, "sumber RAP/proyek tidak cocok");
  });

  test("detects reserved stock that falsely changes physical stock", async (): Promise<void> => {
    await rejectsCorruption(async (tx): Promise<void> => {
      const [movement] = await tx
        .select()
        .from(stockMovement)
        .where(eq(stockMovement.movementType, "RESERVE"))
        .limit(1);
      if (!movement) throw new Error("Missing development reservation");
      await tx
        .update(stockMovement)
        .set({ movementDirection: "OUT" })
        .where(eq(stockMovement.id, movement.id));
    }, "mengubah stock fisik");
  });
});
