"use server";

import { db } from "@/db";
import { client, project, auditLog, projectBudgets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { resolveRoleName } from "@/lib/auth/permissions";
import { ActionResponse } from "@/lib/types/action-response";
import {
  createProjectSchema,
  updateProjectSchema,
  CreateProjectInput,
  UpdateProjectInput,
} from "@/lib/validations/project";
import { getBudgetAllocationDefault } from "@/app/actions/project/excel-budget-utils";
import { insertCanonicalProjectBudgetTx } from "@/lib/budget/project-budget-creation";

type SessionUser = {
  readonly id: string;
  readonly roleId?: string;
  readonly name: string;
};

async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: {
      cookie: (await (await import("next/headers")).cookies()).toString(),
    },
  });
  return session?.user ? (session.user as SessionUser) : null;
}

export async function createProjectAction(
  input: CreateProjectInput
): Promise<ActionResponse<{ id: string }>> {
  const validation = createProjectSchema.safeParse(input);
  if (!validation.success) {
    console.error("VALIDATION FAILED in createProjectAction:", {
      input,
      errors: validation.error.format(),
    });
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message || "Validasi data proyek gagal.",
      },
    };
  }

  const currentUser = await getSessionUser();
  if (!currentUser) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  const roleName = await resolveRoleName(currentUser.roleId ?? "");
  if (roleName !== "OWNER" && roleName !== "FINANCE_ADMIN") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Hanya peran Owner dan Finance Admin yang diizinkan untuk membuat proyek baru.",
      },
    };
  }

  const data = validation.data;
  let finalClientId = data.clientId;

  try {
    const allocationDefault = await getBudgetAllocationDefault();
    const result = await db.transaction(async (tx) => {
      // 1. Create client if it's new
      if (!finalClientId) {
        if (!data.newClientName) {
          throw new Error("Nama klien baru harus diisi jika tidak memilih klien terdaftar.");
        }
        const [newClient] = await tx
          .insert(client)
          .values({
            id: crypto.randomUUID(),
            name: data.newClientName,
            companyName: "",
            email: data.newClientEmail || `${data.newClientName.toLowerCase().replace(/\s+/g, "")}@example.com`,
            phone: data.newClientPhone || "-",
            address: data.newClientAddress || "-",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        finalClientId = newClient.id;
      }

      // 2. Insert project
      const [newProject] = await tx
        .insert(project)
        .values({
          id: crypto.randomUUID(),
          name: data.name,
          clientId: finalClientId,
          projectManagerId: data.projectManagerId,
          status: "DRAFT",
          financialHealth: "HEALTHY",
          totalContractValue: data.totalContractValue.toFixed(2),
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          location: data.location || null,
          roomArea: data.roomArea || null,
          projectType: data.projectType || null,
          coverImageUrl: data.coverImageUrl || null,
          notes: data.notes || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const newBudget = await insertCanonicalProjectBudgetTx({
        tx,
        projectId: newProject.id,
        contractValue: Number(newProject.totalContractValue),
        approvedRabValue: Number(newProject.totalContractValue),
        allocation: allocationDefault,
        notes: "Inisialisasi anggaran kategori otomatis dari pengaturan sistem.",
      });

      // 3. Write audit log
      await tx.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        action: "CREATE_PROJECT",
        targetTable: "project",
        targetId: newProject.id,
        newState: JSON.stringify({ project: newProject, canonicalBudgetId: newBudget.id }),
        createdAt: new Date(),
      });

      return newProject;
    });

    return { success: true, data: { id: result.id } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Terjadi kesalahan internal saat membuat proyek.",
      },
    };
  }
}

export async function updateProjectAction(
  input: UpdateProjectInput
): Promise<ActionResponse<{ id: string }>> {
  const validation = updateProjectSchema.safeParse(input);
  if (!validation.success) {
    console.error("VALIDATION FAILED in updateProjectAction:", {
      input,
      errors: validation.error.format(),
    });
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message || "Validasi data pembaruan proyek gagal.",
      },
    };
  }

  const currentUser = await getSessionUser();
  if (!currentUser) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  const roleName = await resolveRoleName(currentUser.roleId ?? "");
  if (roleName !== "OWNER" && roleName !== "FINANCE_ADMIN") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Hanya peran Owner dan Finance Admin yang diizinkan untuk memperbarui proyek.",
      },
    };
  }

  const data = validation.data;

  try {
    await db.transaction(async (tx) => {
      const existing = await tx.query.project.findFirst({
        where: eq(project.id, data.id),
      });

      if (!existing) {
        throw new Error("Proyek tidak ditemukan.");
      }
      if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
        throw new Error("Proyek yang sudah selesai atau dibatalkan tidak dapat diedit langsung.");
      }
      if (data.status === "COMPLETED" && existing.status !== "COMPLETED") {
        throw new Error("Status COMPLETED hanya dapat ditetapkan melalui Project Closing Checklist.");
      }

      // 1. Update project details
      await tx
        .update(project)
        .set({
          name: data.name,
          clientId: data.clientId,
          projectManagerId: data.projectManagerId,
          status: data.status,
          financialHealth: data.financialHealth,
          totalContractValue: data.totalContractValue !== undefined ? data.totalContractValue.toFixed(2) : existing.totalContractValue,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          location: data.location || null,
          roomArea: data.roomArea || null,
          projectType: data.projectType || null,
          coverImageUrl: data.coverImageUrl || null,
          notes: data.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(project.id, data.id));

      // 2. If contract value changed, sync with draft budget if available
      const currentBudget = await tx.query.projectBudgets.findFirst({
        where: eq(projectBudgets.projectId, data.id),
      });

      if (data.totalContractValue !== undefined && currentBudget && currentBudget.status === "DRAFT") {
        const ratio = Number(currentBudget.budgetCapRatio);
        const internalBudget = data.totalContractValue * ratio;
        const targetGrossAmount = data.totalContractValue - internalBudget;

        await tx
          .update(projectBudgets)
          .set({
            contractValue: data.totalContractValue.toFixed(2),
            internalBudget: internalBudget.toFixed(2),
            targetGrossAmount: targetGrossAmount.toFixed(2),
            targetGrossPercentage: data.totalContractValue > 0 ? ((targetGrossAmount / data.totalContractValue) * 100).toFixed(4) : "0.0000",
            updatedAt: new Date(),
          })
          .where(eq(projectBudgets.id, currentBudget.id));
      }

      // 3. Write audit log
      await tx.insert(auditLog).values({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        action: "UPDATE_PROJECT",
        targetTable: "project",
        targetId: data.id,
        newState: JSON.stringify(data),
        createdAt: new Date(),
      });
    });

    return { success: true, data: { id: data.id } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Terjadi kesalahan internal saat memperbarui proyek.",
      },
    };
  }
}

export async function getProjectFormData(): Promise<ActionResponse<{ clients: Array<{ id: string; name: string }>; users: Array<{ id: string; name: string }> }>> {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }

  try {
    const clientsData = await db.query.client.findMany({
      orderBy: (table, { asc }) => [asc(table.name)],
    });
    const usersData = await db.query.user.findMany({
      orderBy: (table, { asc }) => [asc(table.name)],
    });
    return {
      success: true,
      data: {
        clients: clientsData.map((c) => ({ id: c.id, name: c.name })),
        users: usersData.map((u) => ({ id: u.id, name: u.name })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Gagal mengambil data form proyek.",
      },
    };
  }
}
