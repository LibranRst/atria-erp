import { actorHasPermission } from "@atria/core/auth/permissions";
import "server-only";

import { getBudgetAllocationDefault } from "@/app/actions/project/excel-budget-utils";
import { db } from "@/db";
import { auditLog, client, project } from "@/db/schema";
import { insertCanonicalProjectBudgetTx } from "@/lib/budget/project-budget-creation";
import type { Actor } from "@/server/actor";
import type { ActionResponse } from "@atria/core/types/action-response";
import { createProjectSchema, type CreateProjectInput } from "@atria/core/validations/project";

/** Membuat proyek memakai identitas pemanggil yang telah diselesaikan server. */
export async function createProjectUseCase(
  actor: Actor,
  input: CreateProjectInput,
): Promise<ActionResponse<{ id: string }>> {
  const validation = createProjectSchema.safeParse(input);
  if (!validation.success) {
    console.error("VALIDATION FAILED in createProjectUseCase:", {
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

  if (!actorHasPermission(actor.roleName, "create:project")) {
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
            email:
              data.newClientEmail ||
              `${data.newClientName.toLowerCase().replace(/\s+/g, "")}@example.com`,
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
        userId: actor.userId,
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
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan internal saat membuat proyek.",
      },
    };
  }
}
