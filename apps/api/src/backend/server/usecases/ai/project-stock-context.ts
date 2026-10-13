import { mapStockError } from "@backend/app/actions/material/inventory-utils";
import { and, eq } from "drizzle-orm";
import { project, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { createHash } from "node:crypto";
import { db } from "@backend/db";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  hasStockProjectScope,
  prepareProjectStockBatchTx,
  ProjectStockError,
  type StockActor,
  type ProjectStockTx,
  type PreparedProjectStockRow,
} from "../material/project-stock-writer";
import {
  projectStockInputSchema,
  projectStockProposalSchema,
  type ProjectStockInput,
  type ProjectStockProposal,
} from "@atria/core/ai/project-stock";
export function canReadProjectStock(actor: StockActor): boolean {
  return (
    actorCan(actor, "use:ai_chat") &&
    actorCan(actor, "view:material") &&
    hasStockProjectScope(actor)
  );
}
export async function readStockProjectAccess(
  actor: StockActor,
  projectId: string,
  reader: Pick<typeof db, "query"> = db,
): Promise<{ id: string; name: string; status: string }> {
  if (!canReadProjectStock(actor) || !hasStockProjectScope(actor))
    throw new ProjectStockError("FORBIDDEN", "Akses stok proyek tidak tersedia.");
  const row = await reader.query.project.findFirst({
    where: and(
      eq(project.id, projectId),
      eq(project.tenantId, INSTANCE_TENANT_ID),
      actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined,
    ),
    columns: { id: true, name: true, status: true },
  });
  if (!row) throw new ProjectStockError("FORBIDDEN", "Proyek di luar akses Anda.");
  return row;
}
export function buildProjectStockProposal(
  actor: StockActor,
  input: ProjectStockInput,
  rows: PreparedProjectStockRow[],
): ProjectStockProposal {
  if (!canReadProjectStock(actor))
    throw new ProjectStockError("FORBIDDEN", "Akses chat dan stok Material diperlukan.");
  const first = rows[0];
  if (!first) throw new ProjectStockError("VALIDATION_ERROR", "Pilih minimal satu material.");
  const delta = Number(rows.reduce((sum, row) => sum + row.attribution.amount, 0).toFixed(2)),
    category = first.materialBudget;
  const actualBefore = Number(category?.actualAmount ?? 0),
    actualAfter = Number((actualBefore + delta).toFixed(2));
  const pending = Number(category?.pendingAmount ?? 0),
    allocated = Number(category?.allocatedAmount ?? 0);
  if (!Number.isFinite(actualAfter) || Math.abs(actualAfter) > 9999999999999.99)
    throw new ProjectStockError(
      "VALIDATION_ERROR",
      "Total realisasi Material melebihi batas nilai yang dapat dicatat.",
    );
  return projectStockProposalSchema.parse({
    kind: "PROJECT_STOCK",
    projectId: input.projectId,
    projectName: first.project.name,
    action: input.action,
    input,
    expectedContext: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    rows: rows.map((row) => ({
      id: row.inventory.id,
      materialName: row.material.name,
      locationName: row.location.name,
      unit: row.material.unit,
      quantity: row.input.quantity,
      unitCost: row.unitCost,
      costOverride: row.input.unitCost !== undefined,
      note: row.input.note,
      sourceLabel: [
        row.rapItem
          ? `${row.rapItem.name} · ${row.rapItem.area} · RAP ${row.rapItem.rap.revision}`
          : "Tanpa kaitan item RAP",
        row.input.projectCostId ? "Biaya Material tertaut" : null,
        row.input.vendorBillId ? "Tagihan Material tertaut" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      before: row.before,
      after: row.after,
    })),
    budget:
      actorCan(actor, "view:budget") && category
        ? {
            allocated,
            actualBefore,
            actualAfter,
            pending,
            remainingAfter: Number((allocated - actualAfter - pending).toFixed(2)),
            costDelta: delta,
            overAllocation: Math.max(0, actualAfter + pending - allocated),
            rapTotal: (first.latestRap?.items ?? []).reduce(
              (sum, row) => sum + Number(row.estimatedTotalCost),
              0,
            ),
          }
        : null,
    costEffect: delta > 0 ? "DEBIT" : delta < 0 ? "CREDIT" : "NONE",
  });
}
export async function prepareProjectStockProposal(
  actor: StockActor,
  raw: unknown,
  connection?: ProjectStockTx,
): Promise<ProjectStockProposal> {
  if (!canReadProjectStock(actor))
    throw new ProjectStockError("FORBIDDEN", "Akses chat dan stok Material diperlukan.");
  const input = projectStockInputSchema.parse(raw);
  const run = async (tx: ProjectStockTx): Promise<ProjectStockProposal> =>
    buildProjectStockProposal(actor, input, await prepareProjectStockBatchTx(tx, actor, input));
  return connection ? run(connection) : db.transaction(run);
}

export function projectStockProposalErrorMessage(error: unknown): string {
  if (error instanceof ProjectStockError) return error.message;
  if (error instanceof Error && error.message.startsWith("PROJECT_NOT_ACTIVE:"))
    return "Aktifkan proyek sebelum mencatat pergerakan stok.";
  const mapped = mapStockError<never>(error, "Usulan stok belum siap.");
  if (!mapped.success && mapped.error.code !== "TRANSACTION_FAILED") return mapped.error.message;
  return "Usulan belum siap. Periksa jumlah, sumber, stok dan kesiapan proyek sebelum mencoba lagi.";
}
