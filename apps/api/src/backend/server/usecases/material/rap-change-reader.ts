import { db } from "@backend/db";
import { z } from "zod";
import { project, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { and, eq } from "drizzle-orm";
import {
  readRapPlanningContext,
  RapDraftError,
  canPrepareRap,
  type RapPlanningActor,
  type RapPlanningContext,
} from "./rap-context";
import {
  buildRapChangeRows,
  rapChangePlanTotals,
  rapItemSnapshotSchema,
  rapChangeProposalSchema,
  type RapChangeInput,
  type RapChangeProposal,
  type RapItemSnapshot,
} from "@atria/core/ai/rap-change";
import { sumRapAmounts } from "@atria/core/project/rap-cost";

export async function assertRapChangeScope(
  actor: RapPlanningActor,
  projectId: string,
  connection: Pick<typeof db, "query"> = db,
): Promise<void> {
  if (!canPrepareRap(actor))
    throw new RapDraftError("FORBIDDEN", "Akses chat, edit RAP, budget dan material diperlukan.");
  const found = await connection.query.project.findFirst({
    where: and(
      eq(project.id, projectId),
      eq(project.tenantId, INSTANCE_TENANT_ID),
      actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
    ),
    columns: { id: true },
  });
  if (!found) throw new RapDraftError("FORBIDDEN", "Proyek di luar akses Anda.");
}
export function rapChangeItems(context: RapPlanningContext): RapItemSnapshot[] {
  if (!context.rap) throw new RapDraftError("NOT_FOUND", "Proyek belum memiliki RAP untuk diubah.");
  return [...context.rap.items]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    .map((item) =>
      rapItemSnapshotSchema.parse({
        itemId: item.id,
        materialId: item.materialId,
        name: item.name,
        unit: item.unit,
        description: item.description,
        internalNote: item.internalNote,
        source: item.source,
        area: item.area,
        requiredQuantity: Number(item.requiredQuantity),
        bufferQuantity: Number(item.bufferQuantity),
        estimatedUnitCost: Number(item.estimatedUnitCost),
        totalQuantity: Number(item.totalQuantity),
        estimatedTotalCost: Number(item.estimatedTotalCost),
      }),
    );
}
export async function readRapChangeContext(
  actor: RapPlanningActor,
  input: RapChangeInput,
  connection: Pick<typeof db, "query"> = db,
): Promise<RapPlanningContext> {
  const base = await readRapPlanningContext(actor, input.projectId, [], connection);
  const items = rapChangeItems(base);
  const updateIds = input.rows
    .filter((row) => row.action === "UPDATE")
    .flatMap((row) => {
      const item = items.find((item) => item.itemId === row.itemId);
      if (!item)
        throw new RapDraftError(
          "VALIDATION_ERROR",
          "Item tidak ditemukan pada RAP terbaru proyek ini.",
        );
      return [item.materialId, row.changes.materialId].filter((id): id is string => Boolean(id));
    });
  return readRapPlanningContext(actor, input.projectId, updateIds, connection);
}
export function buildRapChangeProposal(
  input: RapChangeInput,
  context: RapPlanningContext,
): RapChangeProposal {
  const items = rapChangeItems(context);
  const resolved: RapChangeInput = {
    ...input,
    rows: input.rows.map((row) => {
      if (row.action !== "UPDATE") return row;
      const before = items.find((i) => i.itemId === row.itemId);
      if (!before) throw new RapDraftError("VALIDATION_ERROR", "Item RAP tidak ditemukan.");
      const changes = { ...row.changes };
      if (changes.materialId === null && before.materialId && (!changes.name || !changes.unit))
        throw new RapDraftError(
          "VALIDATION_ERROR",
          "Item tanpa Material Master memerlukan nama dan satuan eksplisit.",
        );
      const id = changes.materialId === undefined ? before.materialId : changes.materialId;
      if (id) {
        const material = context.materials.find((m) => m.id === id);
        if (!material)
          throw new RapDraftError("VALIDATION_ERROR", "Material aktif tidak ditemukan.");
        if (changes.materialId !== undefined && changes.materialId !== before.materialId) {
          changes.name = material.name;
          changes.unit = material.unit;
        }
        if (changes.unit !== undefined && changes.unit !== material.unit)
          throw new RapDraftError(
            "VALIDATION_ERROR",
            "Satuan harus mengikuti Material Master. Jangan mengonversi otomatis.",
          );
      }
      if (
        changes.unit !== undefined &&
        changes.unit !== before.unit &&
        (changes.requiredQuantity === undefined ||
          changes.bufferQuantity === undefined ||
          changes.estimatedUnitCost === undefined)
      )
        throw new RapDraftError(
          "VALIDATION_ERROR",
          "Perubahan satuan memerlukan jumlah, buffer dan harga baru secara eksplisit.",
        );
      return { ...row, changes };
    }),
  };
  const rows = buildRapChangeRows(resolved, items);
  const totals = rapChangePlanTotals(items, rows);
  const allocated = Number(context.materialBudget.allocatedAmount);
  if (!context.rap) throw new RapDraftError("NOT_FOUND", "RAP tidak tersedia.");
  return rapChangeProposalSchema.parse({
    kind: "RAP_MATERIAL_CHANGES",
    projectId: context.project.id,
    projectName: context.project.name,
    projectRapId: context.rap.id,
    expectedContext: context.contextVersion,
    rows,
    budget: {
      ...totals,
      allocated,
      actual: Number(context.materialBudget.actualAmount),
      pending: Number(context.materialBudget.pendingAmount),
      remaining: Number(context.materialBudget.remainingAmount),
      overAllocation: Math.max(
        0,
        Number(sumRapAmounts([totals.afterPlan.toFixed(2), (-allocated).toFixed(2)])),
      ),
    },
  });
}
export function rapProposalChangeInput(proposal: RapChangeProposal): RapChangeInput {
  return {
    projectId: proposal.projectId,
    rows: proposal.rows.map((row) =>
      row.action === "DELETE"
        ? { action: "DELETE", itemId: row.before.itemId }
        : {
            action: "UPDATE",
            itemId: row.before.itemId,
            changes: row.after
              ? {
                  area: row.after.area,
                  requiredQuantity: row.after.requiredQuantity,
                  bufferQuantity: row.after.bufferQuantity,
                  estimatedUnitCost: row.after.estimatedUnitCost,
                  materialId: row.after.materialId,
                  name: row.after.name,
                  unit: row.after.unit,
                  description: row.after.description,
                  internalNote: row.after.internalNote,
                  source: z
                    .enum(["STOCK", "PURCHASE", "STOCK_AND_PURCHASE", "VENDOR"])
                    .safeParse(row.after.source).data,
                }
              : {},
          },
    ),
  };
}
