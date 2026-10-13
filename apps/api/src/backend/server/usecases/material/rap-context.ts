import { createHash, randomUUID } from "node:crypto";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  materialMaster,
  materialInventory,
  inventoryLocation,
  expenseCategory,
  projectBudgetCategory,
  projectRapItem,
  project,
  projectBudgets,
  projectRap,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  availableRapStock,
  calculateRapMaterialCost,
  sumRapAmounts,
} from "@atria/core/project/rap-cost";
import {
  rapDraftProposalSchema,
  type RapDraftInput,
  type RapDraftProposal,
} from "@atria/core/ai/rap-draft";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export type RapPlanningActor = Pick<Actor, "userId" | "permissions" | "dataScope"> & {
  readonly isActive?: boolean;
};
export class RapDraftError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "VALIDATION_ERROR" | "CONFLICT" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "RapDraftError";
  }
}
export function rapDraftFailure(error: unknown): ActionResponse<never> {
  if (error instanceof RapDraftError)
    return { success: false, error: { code: error.code, message: error.message } };
  if (error instanceof Error && error.message.startsWith("FORBIDDEN:"))
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses proyek atau RAP ditolak." },
    };
  return {
    success: false,
    error: {
      code: "TRANSACTION_FAILED",
      message: "Draft RAP belum dapat disimpan. Periksa usulan lalu coba lagi.",
    },
  };
}
export function canPrepareRap(actor: RapPlanningActor): boolean {
  const permissions: readonly PermissionKey[] = [
    "use:ai_chat",
    "update:rap",
    "view:budget",
    "view:material",
  ];
  return actor.dataScope !== "NONE" && permissions.every((key) => actorCan(actor, key));
}
export type RapPlanningContext = {
  readonly project: typeof project.$inferSelect;
  readonly budget: typeof projectBudgets.$inferSelect & {
    readonly categories: (typeof projectBudgetCategory.$inferSelect & {
      expenseCategory: typeof expenseCategory.$inferSelect;
    })[];
  };
  readonly materialBudget: typeof projectBudgetCategory.$inferSelect & {
    expenseCategory: typeof expenseCategory.$inferSelect;
  };
  readonly rap:
    | (typeof projectRap.$inferSelect & { items: (typeof projectRapItem.$inferSelect)[] })
    | undefined;
  readonly materials: (typeof materialMaster.$inferSelect & {
    inventory: (typeof materialInventory.$inferSelect & {
      location: typeof inventoryLocation.$inferSelect;
    })[];
  })[];
  readonly contextVersion: string;
};
export async function readRapPlanningContext(
  actor: RapPlanningActor,
  projectId: string,
  materialIds: readonly string[],
  connection: Pick<typeof db, "query"> = db,
): Promise<RapPlanningContext> {
  if (!canPrepareRap(actor))
    throw new RapDraftError("FORBIDDEN", "Akses chat, edit RAP, budget, dan material diperlukan.");
  const record = await connection.query.project.findFirst({
    where: and(
      eq(project.id, projectId),
      eq(project.tenantId, INSTANCE_TENANT_ID),
      actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
    ),
  });
  if (!record)
    throw new RapDraftError("FORBIDDEN", "Proyek tidak ditemukan atau di luar akses Anda.");
  if (!["DRAFT", "ACTIVE"].includes(record.status))
    throw new RapDraftError("FORBIDDEN", "RAP hanya dapat diubah pada proyek draft atau aktif.");
  const budget = await connection.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, projectId),
    with: { categories: { with: { expenseCategory: true } } },
  });
  const materialBudget = budget?.categories.find((row) => row.expenseCategory.code === "MATERIAL");
  if (!budget || !materialBudget)
    throw new RapDraftError(
      "VALIDATION_ERROR",
      "Budget Material proyek belum tersedia. Lengkapi budget proyek terlebih dahulu.",
    );
  const rap = await connection.query.projectRap.findFirst({
    where: and(eq(projectRap.projectId, projectId), eq(projectRap.tenantId, INSTANCE_TENANT_ID)),
    orderBy: [desc(projectRap.revision)],
    with: { items: true },
  });
  if (rap && rap.status !== "DRAFT")
    throw new RapDraftError(
      "CONFLICT",
      "RAP sudah terkunci. Gunakan alur revisi; draft AI tidak menimpa rencana yang dikunci.",
    );
  if (!rap && !actorCan(actor, "create:rap"))
    throw new RapDraftError(
      "FORBIDDEN",
      "Izin membuat RAP diperlukan karena proyek belum memiliki RAP.",
    );
  const ids = [...new Set(materialIds)].sort();
  const materials = ids.length
    ? await connection.query.materialMaster.findMany({
        where: and(
          eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
          inArray(materialMaster.id, ids),
        ),
        orderBy: [asc(materialMaster.id)],
        with: { inventory: { with: { location: true } } },
      })
    : [];
  if (materials.length !== ids.length || materials.some((row) => !row.isActive))
    throw new RapDraftError(
      "VALIDATION_ERROR",
      "Material tidak tersedia atau nonaktif. Pilih material aktif dari katalog.",
    );
  const contextVersion = createHash("sha256")
    .update(
      JSON.stringify({
        project: {
          id: record.id,
          name: record.name,
          status: record.status,
          manager: record.projectManagerId,
          version: record.updatedAt,
        },
        budget: {
          ...budget,
          categories: [...budget.categories].sort((a, b) => a.id.localeCompare(b.id)),
        },
        rap: rap
          ? { ...rap, items: [...rap.items].sort((a, b) => a.id.localeCompare(b.id)) }
          : null,
        materials: materials.map((row) => ({
          ...row,
          inventory: [...row.inventory].sort((a, b) => a.id.localeCompare(b.id)),
        })),
      }),
    )
    .digest("hex");
  return { project: record, budget, materialBudget, rap, materials, contextVersion };
}
export function rapMaterialChoice(row: RapPlanningContext["materials"][number]): {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  readonly availableStock: number;
  readonly referencePrice: number | null;
  readonly referenceLabel: string | null;
} {
  const price = [...row.inventory]
    .filter((entry) => entry.location.isActive && Number(entry.lastPurchasePrice) > 0)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id))[0];
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    availableStock: availableRapStock(row.inventory),
    referencePrice: price ? Number(price.lastPurchasePrice) : null,
    referenceLabel: price ? `Harga referensi · ${price.location.name}` : null,
  };
}
export function buildRapDraftProposal(
  input: RapDraftInput,
  context: RapPlanningContext,
): RapDraftProposal {
  const seen = new Set<string>();
  const rows = input.rows.map((inputRow) => {
    const material = context.materials.find((row) => row.id === inputRow.materialId);
    if (!material) throw new RapDraftError("VALIDATION_ERROR", "Material tidak ditemukan.");
    const choice = rapMaterialChoice(material);
    const cost = inputRow.estimatedUnitCost ?? choice.referencePrice;
    if (cost === null)
      throw new RapDraftError(
        "VALIDATION_ERROR",
        `Harga ${material.name} belum tersedia. Minta pengguna mengisi estimasi harga; jangan menebak.`,
      );
    const identity = `${material.id}:${inputRow.area.trim().toLocaleLowerCase("id-ID")}`;
    if (seen.has(identity))
      throw new RapDraftError(
        "VALIDATION_ERROR",
        `Material ${material.name} berulang di area ${inputRow.area}. Gabungkan kuantitas atau bedakan area sebelum review.`,
      );
    seen.add(identity);
    let calculated: ReturnType<typeof calculateRapMaterialCost>;
    try {
      calculated = calculateRapMaterialCost({ ...inputRow, estimatedUnitCost: cost });
    } catch (error: unknown) {
      throw new RapDraftError(
        "VALIDATION_ERROR",
        error instanceof Error ? error.message : "Kuantitas atau harga tidak valid.",
      );
    }
    return {
      ...inputRow,
      rowId: randomUUID(),
      name:
        inputRow.name ?? (material.name.length >= 3 ? material.name : `Material ${material.name}`),
      unit: material.unit,
      materialName: material.name,
      estimatedUnitCost: cost,
      totalQuantity: Number(calculated.totalQuantity),
      estimatedTotalCost: Number(calculated.estimatedTotalCost),
      availableStock: choice.availableStock,
      priceSource:
        inputRow.estimatedUnitCost === undefined ? ("REFERENCE" as const) : ("USER" as const),
      priceSourceLabel:
        inputRow.estimatedUnitCost === undefined
          ? (choice.referenceLabel ?? "Harga referensi")
          : "Estimasi dari pengguna",
      source:
        inputRow.source ??
        (choice.availableStock > 0 ? ("STOCK_AND_PURCHASE" as const) : ("PURCHASE" as const)),
    };
  });
  const addition = sumRapAmounts(rows.map((row) => row.estimatedTotalCost.toFixed(2)));
  const existingPlan = sumRapAmounts(context.rap?.items.map((row) => row.estimatedTotalCost) ?? []);
  const afterPlan = sumRapAmounts([existingPlan.toFixed(2), addition.toFixed(2)]);
  const stock = context.materials.map((material) => {
    const quantities = [
      ...(context.rap?.items
        .filter((row) => row.materialId === material.id)
        .map((row) => row.totalQuantity) ?? []),
      ...rows
        .filter((row) => row.materialId === material.id)
        .map((row) => row.totalQuantity.toFixed(2)),
    ];
    const planQuantity = sumRapAmounts(quantities),
      available = availableRapStock(material.inventory);
    return {
      materialId: material.id,
      materialName: material.name,
      unit: material.unit,
      planQuantity,
      available,
      shortage: Math.max(0, Number((planQuantity - available).toFixed(2))),
    };
  });
  return rapDraftProposalSchema.parse({
    kind: "RAP_MATERIAL_DRAFT",
    projectId: context.project.id,
    projectName: context.project.name,
    projectRapId: context.rap?.id ?? null,
    expectedContext: context.contextVersion,
    rows,
    notes: input.notes ?? null,
    budget: {
      categoryId: context.materialBudget.id,
      categoryName: context.materialBudget.expenseCategory.name,
      allocated: Number(context.materialBudget.allocatedAmount),
      actual: Number(context.materialBudget.actualAmount),
      pending: Number(context.materialBudget.pendingAmount),
      remaining: Number(context.materialBudget.remainingAmount),
      existingPlan,
      addition,
      afterPlan,
      overAllocation: Math.max(
        0,
        Number((afterPlan - Number(context.materialBudget.allocatedAmount)).toFixed(2)),
      ),
    },
    stock,
  });
}
