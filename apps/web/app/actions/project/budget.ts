"use server";

import { db } from "@/db";
import { projectBudget, projectBudgetItem, project } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assertPermission } from "@/lib/auth/permissions";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { ActionResponse } from "@atria/core/types/action-response";
import { createBudgetItemSchema, CreateBudgetItemInput } from "@atria/core/validations/budget";
import { getActiveProjectsForExpense as getActiveProjectsForExpenseRead } from "./budget-expense-options";
import type { ProjectForExpense } from "./budget-types";
import {
  assertScopedProjectBudgetAccess,
  createApprovalInvoicesIfNeededTx,
  forbiddenResponse,
  getBudgetActionSession,
  internalServerErrorResponse,
} from "./budget-utils";

export type { ProjectForExpense } from "./budget-types";

function legacyBudgetMutationDisabled<T>(): ActionResponse<T> {
  return {
    success: false,
    error: {
      code: "FORBIDDEN",
      message: "Jalur budget lama sudah dinonaktifkan. Gunakan Project Budget berbasis kategori.",
    },
  };
}

/**
 * Membuat draf anggaran (project_budget) baru untuk proyek tertentu.
 *
 * @param projectId ID proyek target
 * @returns Status respons aksi dan data anggaran yang berhasil dibuat
 */
export async function createProjectBudget(
  projectId: string,
): Promise<ActionResponse<typeof projectBudget.$inferSelect>> {
  const compatibilityGuard = legacyBudgetMutationDisabled<typeof projectBudget.$inferSelect>();
  if (!compatibilityGuard.success) return compatibilityGuard;
  try {
    const sessionResult = await getBudgetActionSession("Sesi tidak valid. Harap login kembali.");
    if (!sessionResult.success) return sessionResult;
    const { user, roleName } = sessionResult.data;

    try {
      await assertPermission(user, "create:budget");
    } catch (err) {
      return forbiddenResponse(err instanceof Error ? err.message : "Akses ditolak.");
    }

    // Validasi proyek ada di database
    const proj = await db.query.project.findFirst({
      where: eq(project.id, projectId),
    });

    if (!proj) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Proyek tidak ditemukan." },
      };
    }

    // Scoping check untuk PM
    try {
      await assertScopedProjectBudgetAccess(projectId, user, roleName);
    } catch (err) {
      return forbiddenResponse(err instanceof Error ? err.message : "Akses ditolak.");
    }

    // Cek apakah anggaran proyek ini sudah pernah dibuat sebelumnya
    const existingBudget = await db.query.projectBudget.findFirst({
      where: eq(projectBudget.projectId, projectId),
    });

    if (existingBudget) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Rencana anggaran untuk proyek ini sudah dibuat sebelumnya.",
        },
      };
    }

    const [newBudget] = await db
      .insert(projectBudget)
      .values({
        projectId,
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      success: true,
      data: newBudget,
    };
  } catch (error) {
    return internalServerErrorResponse(error);
  }
}

/**
 * Menambahkan item anggaran belanja (BoQ) baru ke dalam rencana anggaran proyek.
 * Hanya diperbolehkan jika status anggaran masih DRAFT atau REJECTED.
 *
 * @param input Objek data masukan item anggaran
 * @returns Status respons aksi dan data item anggaran terbuat
 */
export async function createBudgetItem(
  input: CreateBudgetItemInput,
): Promise<ActionResponse<typeof projectBudgetItem.$inferSelect>> {
  const compatibilityGuard = legacyBudgetMutationDisabled<typeof projectBudgetItem.$inferSelect>();
  if (!compatibilityGuard.success) return compatibilityGuard;
  const validation = createBudgetItemSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Validasi data item anggaran gagal." },
    };
  }

  const { projectBudgetId, costCategoryId, name, budgetCategory, quantity, unit, unitPrice } =
    validation.data;
  const allocatedAmount = quantity * unitPrice;

  try {
    const sessionResult = await getBudgetActionSession("Sesi tidak valid. Harap login kembali.");
    if (!sessionResult.success) return sessionResult;
    const { user, roleName } = sessionResult.data;

    try {
      await assertPermission(user, "create:budget");
    } catch (err) {
      return forbiddenResponse(err instanceof Error ? err.message : "Akses ditolak.");
    }

    const budgetHeader = await db.query.projectBudget.findFirst({
      where: eq(projectBudget.id, projectBudgetId),
    });

    if (!budgetHeader) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Rencana anggaran proyek tidak ditemukan." },
      };
    }

    // Scoping check untuk PM
    try {
      await assertScopedProjectBudgetAccess(budgetHeader.projectId, user, roleName);
    } catch (err) {
      return forbiddenResponse(err instanceof Error ? err.message : "Akses ditolak.");
    }

    // Pembatasan mutasi item anggaran berdasarkan status budget
    if (budgetHeader.status !== "DRAFT" && budgetHeader.status !== "REJECTED") {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Item anggaran tidak dapat ditambahkan karena status anggaran sudah ${formatBusinessLabel(budgetHeader.status)}.`,
        },
      };
    }

    const [newItem] = await db
      .insert(projectBudgetItem)
      .values({
        projectBudgetId,
        costCategoryId,
        name,
        budgetCategory,
        quantity: quantity.toFixed(2),
        unit,
        unitPrice: unitPrice.toFixed(2),
        allocatedAmount: allocatedAmount.toFixed(2),
        actualSpent: "0.00",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      success: true,
      data: newItem,
    };
  } catch (error) {
    return internalServerErrorResponse(error);
  }
}

/**
 * Mengajukan draf rencana anggaran (RAB) ke Owner untuk mendapatkan persetujuan.
 * Mengubah status DRAFT/REJECTED menjadi PENDING_APPROVAL.
 *
 * @param projectBudgetId ID rencana anggaran proyek
 * @returns Status respons aksi dan data anggaran terbaru
 */
export async function submitBudgetForApproval(
  projectBudgetId: string,
): Promise<ActionResponse<typeof projectBudget.$inferSelect>> {
  const compatibilityGuard = legacyBudgetMutationDisabled<typeof projectBudget.$inferSelect>();
  if (!compatibilityGuard.success) return compatibilityGuard;
  try {
    const sessionResult = await getBudgetActionSession("Sesi tidak valid.");
    if (!sessionResult.success) return sessionResult;
    const { user, roleName } = sessionResult.data;

    try {
      await assertPermission(user, "create:budget");
    } catch (err) {
      return forbiddenResponse(err instanceof Error ? err.message : "Akses ditolak.");
    }

    const budget = await db.query.projectBudget.findFirst({
      where: eq(projectBudget.id, projectBudgetId),
    });

    if (!budget) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Anggaran proyek tidak ditemukan." },
      };
    }

    // Scoping check untuk PM
    try {
      await assertScopedProjectBudgetAccess(budget.projectId, user, roleName);
    } catch (err) {
      return forbiddenResponse(err instanceof Error ? err.message : "Akses ditolak.");
    }

    if (budget.status !== "DRAFT" && budget.status !== "REJECTED") {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Anggaran dengan status ${formatBusinessLabel(budget.status)} tidak dapat diajukan.`,
        },
      };
    }

    const [updatedBudget] = await db
      .update(projectBudget)
      .set({
        status: "PENDING_APPROVAL",
        updatedAt: new Date(),
      })
      .where(eq(projectBudget.id, projectBudgetId))
      .returning();

    return {
      success: true,
      data: updatedBudget,
    };
  } catch (error) {
    return internalServerErrorResponse(error);
  }
}

/**
 * Menyetujui rencana anggaran proyek yang sedang berstatus PENDING_APPROVAL.
 * Hanya dapat diakses oleh peran OWNER / FINANCE_ADMIN.
 *
 * @param projectBudgetId ID rencana anggaran proyek
 * @returns Status respons aksi dan data anggaran terbaru
 */
export async function approveBudget(
  projectBudgetId: string,
): Promise<ActionResponse<typeof projectBudget.$inferSelect>> {
  const compatibilityGuard = legacyBudgetMutationDisabled<typeof projectBudget.$inferSelect>();
  if (!compatibilityGuard.success) return compatibilityGuard;
  try {
    const sessionResult = await getBudgetActionSession("Sesi tidak valid.");
    if (!sessionResult.success) return sessionResult;
    const { user } = sessionResult.data;

    try {
      await assertPermission(user, "approve:budget");
    } catch (err) {
      return forbiddenResponse(err instanceof Error ? err.message : "Akses ditolak.");
    }

    const budget = await db.query.projectBudget.findFirst({
      where: eq(projectBudget.id, projectBudgetId),
    });

    if (!budget) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Anggaran proyek tidak ditemukan." },
      };
    }

    if (budget.status !== "PENDING_APPROVAL") {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Hanya anggaran berstatus PENDING_APPROVAL yang dapat disetujui.",
        },
      };
    }

    const updatedBudget = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(projectBudget)
        .set({
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectBudget.id, projectBudgetId))
        .returning();

      await createApprovalInvoicesIfNeededTx(tx, {
        projectId: budget.projectId,
        userId: user.id,
      });

      return updated;
    });

    return {
      success: true,
      data: updatedBudget,
    };
  } catch (error) {
    return internalServerErrorResponse(error);
  }
}

/**
 * Menolak rencana anggaran proyek yang sedang berstatus PENDING_APPROVAL.
 * Mengembalikan anggaran ke status REJECTED disertai catatan penolakan.
 *
 * @param projectBudgetId ID rencana anggaran proyek
 * @param notes Catatan/alasan penolakan dari Owner
 * @returns Status respons aksi dan data anggaran terbaru
 */
export async function rejectBudget(
  projectBudgetId: string,
  notes: string,
): Promise<ActionResponse<typeof projectBudget.$inferSelect>> {
  const compatibilityGuard = legacyBudgetMutationDisabled<typeof projectBudget.$inferSelect>();
  if (!compatibilityGuard.success) return compatibilityGuard;
  try {
    const sessionResult = await getBudgetActionSession("Sesi tidak valid.");
    if (!sessionResult.success) return sessionResult;
    const { user } = sessionResult.data;

    try {
      await assertPermission(user, "approve:budget");
    } catch (err) {
      return forbiddenResponse(err instanceof Error ? err.message : "Akses ditolak.");
    }

    const budget = await db.query.projectBudget.findFirst({
      where: eq(projectBudget.id, projectBudgetId),
    });

    if (!budget) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Anggaran proyek tidak ditemukan." },
      };
    }

    if (budget.status !== "PENDING_APPROVAL") {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Hanya anggaran berstatus PENDING_APPROVAL yang dapat ditolak.",
        },
      };
    }

    const [updatedBudget] = await db
      .update(projectBudget)
      .set({
        status: "REJECTED",
        notes,
        updatedAt: new Date(),
      })
      .where(eq(projectBudget.id, projectBudgetId))
      .returning();

    return {
      success: true,
      data: updatedBudget,
    };
  } catch (error) {
    return internalServerErrorResponse(error);
  }
}

/**
 * Kueri proyek aktif yang dapat diakses oleh pengguna saat ini untuk form pengeluaran.
 */
export async function getActiveProjectsForExpense(): Promise<ActionResponse<ProjectForExpense[]>> {
  return getActiveProjectsForExpenseRead();
}
