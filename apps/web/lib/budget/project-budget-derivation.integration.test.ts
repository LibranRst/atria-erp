import { afterAll, expect, it, mock } from "bun:test";
import { eq, inArray, like } from "drizzle-orm";

import { db } from "@/db";
import {
  budgetAllocationSetting,
  client,
  budgetAllocationSettingCategory,
  cashTransaction,
  project,
  projectBudgetCategory,
  projectBudgets,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { createProjectAction } from "@/app/actions/project/crud";
import { describeIntegration } from "@/lib/testing/integration-db";

/**
 * Penurunan anggaran kanonis saat proyek dibuat — bagian B1 dan B3
 * `docs/guide/financial_workflow_guide.md`.
 *
 * Runbook itu dijalankan manual, dan pemeriksaan manual tidak bertahan
 * melewati refactor berikutnya. Yang dipaku di sini adalah bagian yang tidak
 * pernah disentuh walkthrough demo, karena seed-nya sudah membawa anggaran
 * jadi: proyek yang lahir dari nol harus menurunkan internal budget dan kelima
 * alokasi kategori dari pengaturan alokasi yang sedang aktif.
 *
 * Ekspektasinya dihitung dari tabel pengaturan, bukan dari angka yang
 * ditanam di test — kalau rasio default berubah, test ini ikut berubah dan
 * tetap menguji hubungan yang benar, bukan konstanta lama.
 */

mock.module("next/headers", () => ({ cookies: () => ({ toString: () => "mocked-cookies" }) }));
mock.module("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

const RONALD = {
  id: "11111111-1111-1111-1111-111111111111",
  roleId: "00000000-0000-0000-0000-000000000001",
  email: "ronald@dekoria.com",
  name: "Ronald Wijaya",
};
const PM_BUDI_ID = "33333333-3333-3333-3333-333333333331";

(auth.api as unknown as { getSession: unknown }).getSession = async (): Promise<unknown> => ({
  session: {
    id: "mock-session-id",
    userId: RONALD.id,
    expiresAt: new Date(Date.now() + 3_600_000),
    token: "mock-token",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: { ...RONALD, emailVerified: true, isActive: true },
});

const CONTRACT = 850_000_000;
const RUN_ID = Date.now();
const createdProjectIds: string[] = [];

afterAll(async () => {
  (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
  if (createdProjectIds.length === 0) return;
  const budgets = await db
    .select({ id: projectBudgets.id })
    .from(projectBudgets)
    .where(inArray(projectBudgets.projectId, createdProjectIds));
  const budgetIds = budgets.map((row) => row.id);
  if (budgetIds.length > 0) {
    await db
      .delete(projectBudgetCategory)
      .where(inArray(projectBudgetCategory.projectBudgetId, budgetIds));
    await db.delete(projectBudgets).where(inArray(projectBudgets.id, budgetIds));
  }
  await db.delete(project).where(inArray(project.id, createdProjectIds));
  await db.delete(client).where(like(client.name, "Klien Uji Derivasi %"));
});

describeIntegration("penurunan anggaran kanonis proyek baru", () => {
  it("derives the internal budget and every category from the active allocation setting", async () => {
    const cashBefore = (await db.select({ id: cashTransaction.id }).from(cashTransaction)).length;

    const setting = await db.query.budgetAllocationSetting.findFirst({
      where: eq(budgetAllocationSetting.isActive, true),
    });
    if (!setting) throw new Error("Pengaturan alokasi aktif tidak ditemukan.");
    const ratios = await db
      .select({
        expenseCategoryId: budgetAllocationSettingCategory.expenseCategoryId,
        ratio: budgetAllocationSettingCategory.ratioPercentage,
      })
      .from(budgetAllocationSettingCategory)
      .where(eq(budgetAllocationSettingCategory.budgetAllocationSettingId, setting.id));
    expect(ratios.length).toBeGreaterThan(0);

    const created = await createProjectAction({
      name: `UAT Derivasi Anggaran ${RUN_ID}`,
      projectManagerId: PM_BUDI_ID,
      // Nama klien harus unik per jalannya: `client.name` ber-UNIQUE, dan
      // nama tetap membuat suite ini hanya berhasil sekali.
      newClientName: `Klien Uji Derivasi ${RUN_ID}`,
      totalContractValue: CONTRACT,
    });

    expect(created.success).toBe(true);
    if (!created.success) throw new Error("unreachable");
    createdProjectIds.push(created.data.id);

    const budget = await db.query.projectBudgets.findFirst({
      where: eq(projectBudgets.projectId, created.data.id),
      with: { categories: true },
    });
    if (!budget) throw new Error("Anggaran kanonis tidak dibuat.");

    const cap = Number(setting.budgetCapRatio);
    const expectedInternal = CONTRACT * cap;

    expect(Number(budget.contractValue)).toBeCloseTo(CONTRACT, 2);
    expect(Number(budget.internalBudget)).toBeCloseTo(expectedInternal, 2);
    expect(Number(budget.targetGrossAmount)).toBeCloseTo(CONTRACT - expectedInternal, 2);

    // Setiap kategori adalah internal budget dikali rasionya sendiri.
    expect(budget.categories.length).toBe(ratios.length);
    for (const ratio of ratios) {
      const category = budget.categories.find(
        (row) => row.expenseCategoryId === ratio.expenseCategoryId,
      );
      if (!category) throw new Error("Kategori anggaran tidak lengkap.");
      expect(Number(category.allocatedAmount)).toBeCloseTo(
        expectedInternal * Number(ratio.ratio),
        2,
      );
      // Proyek baru belum membelanjakan apa pun.
      expect(Number(category.actualAmount)).toBe(0);
      expect(Number(category.paidAmount)).toBe(0);
    }

    // Sisa yang tidak dialokasikan adalah buffer, bukan margin — dan tidak boleh negatif.
    const allocated = budget.categories.reduce(
      (total, row) => total + Number(row.allocatedAmount),
      0,
    );
    expect(allocated).toBeLessThanOrEqual(expectedInternal + 0.01);

    // Membuat proyek tidak pernah menggerakkan kas.
    const cashAfter = (await db.select({ id: cashTransaction.id }).from(cashTransaction)).length;
    expect(cashAfter).toBe(cashBefore);
  });
});
