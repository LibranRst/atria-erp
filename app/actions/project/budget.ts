"use server";

import { db } from "@/db";
import { projectBudget, projectBudgetItem, project } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import { ActionResponse } from "@/lib/types/action-response";
import { createBudgetItemSchema, CreateBudgetItemInput } from "@/lib/validations/budget";

/**
 * Membuat draf anggaran (project_budget) baru untuk proyek tertentu.
 * 
 * @param projectId ID proyek target
 * @returns Status respons aksi dan data anggaran yang berhasil dibuat
 */
export async function createProjectBudget(
  projectId: string
): Promise<ActionResponse<typeof projectBudget.$inferSelect>> {
  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await import("next/headers")).cookies().toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Harap login kembali." },
      };
    }

    try {
      await assertPermission(session.user, "create:budget");
    } catch (err) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." },
      };
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
      const userRoleName = await resolveRoleName(session.user.roleId);
      await assertProjectAccess(projectId, session.user.id, userRoleName);
    } catch (err) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." },
      };
    }

    // Cek apakah anggaran proyek ini sudah pernah dibuat sebelumnya
    const existingBudget = await db.query.projectBudget.findFirst({
      where: eq(projectBudget.projectId, projectId),
    });

    if (existingBudget) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Rencana anggaran untuk proyek ini sudah dibuat sebelumnya." },
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
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Terjadi kesalahan internal pada server.",
      },
    };
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
  input: CreateBudgetItemInput
): Promise<ActionResponse<typeof projectBudgetItem.$inferSelect>> {
  const validation = createBudgetItemSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Validasi data item anggaran gagal." },
    };
  }

  const { projectBudgetId, costCategoryId, name, allocatedAmount } = validation.data;

  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await import("next/headers")).cookies().toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Harap login kembali." },
      };
    }

    try {
      await assertPermission(session.user, "create:budget");
    } catch (err) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." },
      };
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
      const userRoleName = await resolveRoleName(session.user.roleId);
      await assertProjectAccess(budgetHeader.projectId, session.user.id, userRoleName);
    } catch (err) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." },
      };
    }

    // Pembatasan mutasi item anggaran berdasarkan status budget
    if (budgetHeader.status !== "DRAFT" && budgetHeader.status !== "REJECTED") {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Item anggaran tidak dapat ditambahkan karena status anggaran sudah ${budgetHeader.status}.`,
        },
      };
    }

    const [newItem] = await db
      .insert(projectBudgetItem)
      .values({
        projectBudgetId,
        costCategoryId,
        name,
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
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Terjadi kesalahan internal pada server.",
      },
    };
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
  projectBudgetId: string
): Promise<ActionResponse<typeof projectBudget.$inferSelect>> {
  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await import("next/headers")).cookies().toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
      };
    }

    try {
      await assertPermission(session.user, "create:budget");
    } catch (err) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." },
      };
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
      const userRoleName = await resolveRoleName(session.user.roleId);
      await assertProjectAccess(budget.projectId, session.user.id, userRoleName);
    } catch (err) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." },
      };
    }

    if (budget.status !== "DRAFT" && budget.status !== "REJECTED") {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: `Anggaran dengan status ${budget.status} tidak dapat diajukan.` },
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
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Terjadi kesalahan internal pada server.",
      },
    };
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
  projectBudgetId: string
): Promise<ActionResponse<typeof projectBudget.$inferSelect>> {
  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await import("next/headers")).cookies().toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
      };
    }

    try {
      await assertPermission(session.user, "approve:budget");
    } catch (err) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." },
      };
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
        error: { code: "FORBIDDEN", message: "Hanya anggaran berstatus PENDING_APPROVAL yang dapat disetujui." },
      };
    }

    const [updatedBudget] = await db
      .update(projectBudget)
      .set({
        status: "APPROVED",
        approvedById: session.user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projectBudget.id, projectBudgetId))
      .returning();

    return {
      success: true,
      data: updatedBudget,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Terjadi kesalahan internal pada server.",
      },
    };
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
  notes: string
): Promise<ActionResponse<typeof projectBudget.$inferSelect>> {
  try {
    const session = await auth.api.getSession({
      headers: {
        cookie: (await import("next/headers")).cookies().toString(),
      },
    });

    if (!session || !session.user) {
      return {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
      };
    }

    try {
      await assertPermission(session.user, "approve:budget");
    } catch (err) {
      return {
        success: false,
        error: { code: "FORBIDDEN", message: err instanceof Error ? err.message : "Akses ditolak." },
      };
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
        error: { code: "FORBIDDEN", message: "Hanya anggaran berstatus PENDING_APPROVAL yang dapat ditolak." },
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
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Terjadi kesalahan internal pada server.",
      },
    };
  }
}
