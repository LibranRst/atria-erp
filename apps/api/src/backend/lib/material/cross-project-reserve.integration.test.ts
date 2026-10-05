import { withTestRequest } from "@backend/lib/testing/request";
import { afterAll, beforeAll, expect, it } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@backend/db";
import { materialInventory, projectExpenses, stockMovement } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { reserveMaterialForProject } from "@backend/app/actions/material/inventory-movements";
import { useMaterialForProject } from "@backend/app/actions/material/inventory-project-movements";
import { describeIntegration } from "@backend/lib/testing/integration-db";

/**
 * Bagian C "Cross-project reserve" — satu-satunya negative test runbook yang
 * menuntut dua proyek `ACTIVE` sekaligus, sehingga tidak pernah bisa dijalankan
 * lewat UI dalam satu putaran UAT.
 *
 * Yang dibuktikan di sini bukan aritmetikanya (itu sudah dipaku unit test di
 * `@atria/core/material/stock-guards`), melainkan bahwa `useMaterialForProject`
 * memberi guard itu `ownReserved` yang benar: reservasi milik proyek yang
 * sedang bergerak, bukan seluruh reservasi gudang. Salah memetakan di titik ini
 * membuat proyek B memakan stok yang sudah dikunci proyek A.
 */

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

const PURCHASING_USER = {
  id: "33333333-3333-3333-3333-333333333333",
  roleId: "00000000-0000-0000-0000-000000000004",
  email: "agus@dekoria.com",
  name: "Agus Pratama",
};

function mockUserSession(user: typeof PURCHASING_USER): void {
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

// Mirror 5mm Bevel di Gudang Utama: 12 lembar, belum direservasi siapa pun.
const MATERIAL_ID = "13131313-1313-1313-1313-131313131308";
const LOCATION_ID = "14141414-1414-1414-1414-141414141401";
const PROJECT_A = "77777777-7777-7777-7777-777777777771"; // Menteng Villa
const PROJECT_B = "77777777-7777-7777-7777-777777777772"; // Sudirman Suites

async function readInventory(): Promise<{ current: string; reserved: string }> {
  const row = await db.query.materialInventory.findFirst({
    where: and(
      eq(materialInventory.materialId, MATERIAL_ID),
      eq(materialInventory.locationId, LOCATION_ID),
    ),
  });
  if (!row) throw new Error("Inventory fixture Mirror 5mm tidak ditemukan.");
  return { current: row.currentStock, reserved: row.reservedStock };
}

async function countMovements(projectId: string): Promise<number> {
  const rows = await db
    .select({ id: stockMovement.id })
    .from(stockMovement)
    .where(and(eq(stockMovement.projectId, projectId), eq(stockMovement.materialId, MATERIAL_ID)));
  return rows.length;
}

describeIntegration("cross-project reserve guard", () => {
  beforeAll(
    withTestRequest(() => {
      mockUserSession(PURCHASING_USER);
    }),
  );

  // Fixture dikembalikan utuh supaya suite ini dapat dijalankan berulang kali
  // terhadap database demo yang sama.
  afterAll(
    withTestRequest(async () => {
      (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
      const movements = await db
        .select({ id: stockMovement.id })
        .from(stockMovement)
        .where(
          and(
            eq(stockMovement.materialId, MATERIAL_ID),
            inArray(stockMovement.projectId, [PROJECT_A, PROJECT_B]),
          ),
        );
      const movementIds = movements.map((movement) => movement.id);
      if (movementIds.length > 0) {
        await db
          .delete(projectExpenses)
          .where(inArray(projectExpenses.stockMovementId, movementIds));
        await db.delete(stockMovement).where(inArray(stockMovement.id, movementIds));
      }
      await db
        .update(materialInventory)
        .set({ currentStock: "12.00", reservedStock: "0.00" })
        .where(
          and(
            eq(materialInventory.materialId, MATERIAL_ID),
            eq(materialInventory.locationId, LOCATION_ID),
          ),
        );
    }),
  );

  it(
    "locks 8 for project A",
    withTestRequest(async () => {
      const before = await readInventory();
      expect(before.current).toBe("12.00");
      expect(before.reserved).toBe("0.00");

      const result = await reserveMaterialForProject({
        materialId: MATERIAL_ID,
        inventoryLocationId: LOCATION_ID,
        projectId: PROJECT_A,
        quantity: 8,
        note: "Reservasi cermin untuk proyek A.",
      });

      expect(result.success).toBe(true);
      expect(await readInventory()).toEqual({ current: "12.00", reserved: "8.00" });
    }),
  );

  it(
    "refuses project B a usage that would eat into project A's reservation",
    withTestRequest(async () => {
      // Sisa sesudah pakai 5 adalah 7, sementara 8 masih dikunci proyek A.
      const result = await useMaterialForProject({
        materialId: MATERIAL_ID,
        inventoryLocationId: LOCATION_ID,
        projectId: PROJECT_B,
        quantity: 5,
        note: "Proyek B mencoba memakai stok yang dikunci proyek A.",
      });

      expect(result.success).toBe(false);
      if (result.success) throw new Error("unreachable");
      expect(result.error.message).toContain("direservasi untuk project lain");

      // Tidak ada partial write: stok, reservasi, dan movement proyek B utuh.
      expect(await readInventory()).toEqual({ current: "12.00", reserved: "8.00" });
      expect(await countMovements(PROJECT_B)).toBe(0);
    }),
  );

  it(
    "still lets project B use the stock that is genuinely free",
    withTestRequest(async () => {
      // Kontrol positif: sisa sesudah pakai 4 adalah 8, tepat menutup reservasi A.
      const result = await useMaterialForProject({
        materialId: MATERIAL_ID,
        inventoryLocationId: LOCATION_ID,
        projectId: PROJECT_B,
        quantity: 4,
        note: "Proyek B memakai sisa stok bebas.",
      });

      expect(result.success).toBe(true);
      // Reservasi proyek A tidak boleh ikut susut oleh pemakaian proyek B.
      expect(await readInventory()).toEqual({ current: "8.00", reserved: "8.00" });
    }),
  );
});
