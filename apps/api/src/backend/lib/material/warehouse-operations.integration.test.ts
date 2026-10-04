import { withTestRequest } from "@backend/lib/testing/request";
import { afterAll, beforeAll, expect, it } from "bun:test";
import { and, eq } from "drizzle-orm";

import { db } from "@backend/db";
import { materialInventory, stockCount, stockMovement } from "@backend/db/schema";
import { auth } from "@backend/lib/auth";
import { postGoodsReceipt } from "@backend/app/actions/material/goods-receipt";
import { createStockTransfer } from "@backend/app/actions/material/warehouse-transfer";
import {
  approveStockCount,
  saveStockCount,
  submitStockCount,
} from "@backend/app/actions/material/warehouse-stock-count";
import { emergencyAdjustStock } from "@backend/app/actions/material/warehouse-adjustment";
import { describeIntegration } from "@backend/lib/testing/integration-db";

/**
 * Bagian 11.2 dan 11.4 `docs/guide/seeded_demo_walkthrough.md`: goods receipt,
 * transfer antar gudang, stock count, dan emergency adjustment.
 *
 * Sengaja memakai material yang tidak disentuh suite lain (LED Strip dan PU
 * Finishing, keduanya tanpa reservasi) supaya urutan file test tidak pernah
 * menjadi penentu hasil.
 */

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

const RONALD = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};
const AGUS = {
  id: "33333333-3333-3333-3333-333333333333",
  roleId: "00000000-0000-0000-0000-000000000004",
  email: "agus@dekoria.com",
  name: "Agus Pratama",
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

const LED = "13131313-1313-1313-1313-131313131307";
const PU = "13131313-1313-1313-1313-131313131306";
const GUDANG_UTAMA = "14141414-1414-1414-1414-141414141401";
const WORKSHOP_CIKUPA = "14141414-1414-1414-1414-141414141402";
// Satu-satunya material selain Multipleks yang punya baris inventory di dua
// lokasi sekaligus, dan Multipleks sudah dipakai suite walkthrough.
const CABINET_HARDWARE = "13131313-1313-1313-1313-131313131305";
const MENTENG = "77777777-7777-7777-7777-777777777771";

const GRN_NUMBER = "GRN-DEMO-WALK-001";
const TRANSFER_NUMBER = "TRF-DEMO-WALK-001";
const COUNT_NUMBER = "SC-DEMO-WALK-001";

async function currentStock(materialId: string, locationId: string): Promise<number> {
  const row = await db.query.materialInventory.findFirst({
    where: and(
      eq(materialInventory.materialId, materialId),
      eq(materialInventory.locationId, locationId),
    ),
  });
  return row ? Number(row.currentStock) : 0;
}

describeIntegration("gudang — goods receipt, transfer, stock count, adjustment", () => {
  beforeAll(
    withTestRequest(() => {
      actAs(AGUS);
    }),
  );

  afterAll(
    withTestRequest(() => {
      (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
    }),
  );

  // 11.2 — quantity yang diposting muncul sebagai movement masuk.
  it(
    "11.2 posts a goods receipt and raises stock by the received quantity",
    withTestRequest(async () => {
      actAs(AGUS);
      const before = await currentStock(LED, GUDANG_UTAMA);

      const result = await postGoodsReceipt({
        projectId: MENTENG,
        inventoryLocationId: GUDANG_UTAMA,
        receiptNumber: GRN_NUMBER,
        receivedAt: new Date(),
        note: "Penerimaan LED strip untuk walkthrough demo.",
        items: [{ materialId: LED, quantity: 5, unitCost: 320000 }],
      });

      expect(result.success).toBe(true);
      expect(await currentStock(LED, GUDANG_UTAMA)).toBe(before + 5);
    }),
  );

  // 11.2 — "posting ulang record yang sama harus ditolak".
  it(
    "11.2 refuses a second posting under the same receipt number",
    withTestRequest(async () => {
      actAs(AGUS);
      const before = await currentStock(LED, GUDANG_UTAMA);

      const result = await postGoodsReceipt({
        projectId: MENTENG,
        inventoryLocationId: GUDANG_UTAMA,
        receiptNumber: GRN_NUMBER,
        receivedAt: new Date(),
        note: "Posting ulang penerimaan yang sama.",
        items: [{ materialId: LED, quantity: 5, unitCost: 320000 }],
      });

      expect(result.success).toBe(false);
      expect(await currentStock(LED, GUDANG_UTAMA)).toBe(before);
    }),
  );

  // 11.4 — transfer memindahkan, bukan menciptakan atau menghapus.
  it(
    "11.4 transfers stock out of one location and into another",
    withTestRequest(async () => {
      actAs(AGUS);
      const sourceBefore = await currentStock(CABINET_HARDWARE, GUDANG_UTAMA);
      const targetBefore = await currentStock(CABINET_HARDWARE, WORKSHOP_CIKUPA);

      const result = await createStockTransfer({
        transferNumber: TRANSFER_NUMBER,
        fromLocationId: GUDANG_UTAMA,
        toLocationId: WORKSHOP_CIKUPA,
        transferredAt: new Date(),
        note: "Pemindahan cabinet hardware untuk walkthrough demo.",
        items: [{ materialId: CABINET_HARDWARE, quantity: 2 }],
      });

      expect(result.success).toBe(true);
      expect(await currentStock(CABINET_HARDWARE, GUDANG_UTAMA)).toBe(sourceBefore - 2);
      expect(await currentStock(CABINET_HARDWARE, WORKSHOP_CIKUPA)).toBe(targetBefore + 2);
      // Total perusahaan tidak berubah: yang terjadi hanya perpindahan.
      expect(
        (await currentStock(CABINET_HARDWARE, GUDANG_UTAMA)) +
          (await currentStock(CABINET_HARDWARE, WORKSHOP_CIKUPA)),
      ).toBe(sourceBefore + targetBefore);
    }),
  );

  // Kendala yang tidak disebut panduan: material harus sudah punya baris
  // inventory di kedua lokasi. UI menonaktifkan tombolnya dengan alasan yang
  // jelas, tetapi action-nya juga harus menolak.
  it(
    "11.4 refuses a transfer to a location that does not stock the material",
    withTestRequest(async () => {
      actAs(AGUS);
      const result = await createStockTransfer({
        transferNumber: "TRF-DEMO-WALK-UNSTOCKED",
        fromLocationId: GUDANG_UTAMA,
        toLocationId: WORKSHOP_CIKUPA,
        transferredAt: new Date(),
        note: "Memindahkan material yang belum pernah ada di lokasi tujuan.",
        items: [{ materialId: PU, quantity: 1 }],
      });

      expect(result.success).toBe(false);
      if (result.success) throw new Error("unreachable");
      expect(result.error.message).toContain("belum tersedia");
    }),
  );

  it(
    "11.4 refuses a transfer into the same location",
    withTestRequest(async () => {
      actAs(AGUS);
      const result = await createStockTransfer({
        transferNumber: "TRF-DEMO-WALK-SAME",
        fromLocationId: GUDANG_UTAMA,
        toLocationId: GUDANG_UTAMA,
        transferredAt: new Date(),
        note: "Mencoba memindahkan ke lokasi yang sama.",
        items: [{ materialId: CABINET_HARDWARE, quantity: 1 }],
      });
      expect(result.success).toBe(false);
    }),
  );

  // 11.4 — hanya variance non-zero yang menghasilkan adjustment, dan stock
  // count menuntut approver yang berbeda dari penghitungnya.
  it(
    "11.4 posts an adjustment only for the item whose count differs",
    withTestRequest(async () => {
      actAs(AGUS);
      const ledSystem = await currentStock(LED, GUDANG_UTAMA);
      const puSystem = await currentStock(PU, GUDANG_UTAMA);

      const saved = await saveStockCount({
        countNumber: COUNT_NUMBER,
        inventoryLocationId: GUDANG_UTAMA,
        countedAt: new Date(),
        note: "Stock opname walkthrough demo.",
        items: [
          // LED kurang satu dari catatan; PU tepat.
          { materialId: LED, countedQuantity: ledSystem - 1 },
          { materialId: PU, countedQuantity: puSystem },
        ],
      });
      expect(saved.success).toBe(true);
      if (!saved.success) throw new Error("unreachable");
      const stockCountId = saved.data.id;

      expect((await submitStockCount({ stockCountId, emergencyOverride: false })).success).toBe(
        true,
      );

      // Penghitungnya sendiri tidak boleh menyetujui.
      const selfApproval = await approveStockCount({ stockCountId, emergencyOverride: false });
      expect(selfApproval.success).toBe(false);

      actAs(RONALD);
      const approved = await approveStockCount({ stockCountId, emergencyOverride: false });
      expect(approved.success).toBe(true);

      const posted = await db.query.stockCount.findFirst({
        where: eq(stockCount.id, stockCountId),
      });
      expect(posted?.status).toBe("POSTED");

      // LED turun satu; PU tidak bergerak sama sekali.
      expect(await currentStock(LED, GUDANG_UTAMA)).toBe(ledSystem - 1);
      expect(await currentStock(PU, GUDANG_UTAMA)).toBe(puSystem);

      const adjustments = await db
        .select({ id: stockMovement.id, materialId: stockMovement.materialId })
        .from(stockMovement)
        .where(
          and(
            eq(stockMovement.referenceType, "STOCK_COUNT"),
            eq(stockMovement.referenceId, stockCountId),
          ),
        );
      expect(adjustments.length).toBe(1);
      expect(adjustments[0]?.materialId).toBe(LED);
    }),
  );

  // 11.4 — emergency adjustment wajib punya alasan audit.
  it(
    "11.4 refuses an emergency adjustment without a real reason",
    withTestRequest(async () => {
      actAs(RONALD);
      const before = await currentStock(LED, GUDANG_UTAMA);

      const result = await emergencyAdjustStock({
        materialId: LED,
        inventoryLocationId: GUDANG_UTAMA,
        direction: "DECREASE",
        quantity: 1,
        note: "rusak",
      });

      expect(result.success).toBe(false);
      expect(await currentStock(LED, GUDANG_UTAMA)).toBe(before);
    }),
  );

  it(
    "11.4 posts an emergency adjustment that carries its reason",
    withTestRequest(async () => {
      actAs(RONALD);
      const before = await currentStock(LED, GUDANG_UTAMA);

      const result = await emergencyAdjustStock({
        materialId: LED,
        inventoryLocationId: GUDANG_UTAMA,
        direction: "DECREASE",
        quantity: 1,
        note: "Satu unit rusak saat pemindahan gudang, dicatat manual.",
      });

      expect(result.success).toBe(true);
      expect(await currentStock(LED, GUDANG_UTAMA)).toBe(before - 1);
    }),
  );
});
