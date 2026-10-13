import {
  auditLog,
  INSTANCE_TENANT_ID,
  project,
  projectRap,
  projectRapItem,
  materialMaster,
} from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { buildRapItemValues } from "@backend/app/actions/project/rap-rab-utils";
import type {
  AddProjectRapItemInput,
  CreateProjectRapInput,
  UpdateProjectRapItemInput,
} from "@atria/core/validations/rap-rab";
import type { PermissionKey } from "@atria/core/auth/permissions";
import { and, asc, eq, inArray } from "drizzle-orm";

export async function lockRapMaterialReferencesTx(
  tx: FinanceTransaction,
  ids: readonly string[],
): Promise<void> {
  if (!ids.length) return;
  await tx
    .select({ id: materialMaster.id })
    .from(materialMaster)
    .where(
      and(
        eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
        inArray(materialMaster.id, [...new Set(ids)]),
      ),
    )
    .orderBy(asc(materialMaster.id))
    .for("share");
}

export async function lockRapProjectTx(
  tx: FinanceTransaction,
  actor: Actor,
  projectId: string,
  permission: PermissionKey,
): Promise<typeof project.$inferSelect> {
  if (!actorCan(actor, permission))
    throw new Error("FORBIDDEN: Tidak memiliki izin rencana material proyek.");
  const [row] = await tx
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (
    !row ||
    actor.dataScope === "NONE" ||
    (actor.dataScope === "ASSIGNED" && row.projectManagerId !== actor.userId)
  )
    throw new Error("FORBIDDEN: Proyek tidak ditemukan atau di luar akses Anda.");
  if (!["DRAFT", "ACTIVE"].includes(row.status))
    throw new Error("FORBIDDEN: RAP hanya dapat diubah pada proyek draft atau aktif.");
  return row;
}
export async function lockProjectRapTx(
  tx: FinanceTransaction,
  actor: Actor,
  rapId: string,
  permission: PermissionKey = "update:rap",
): Promise<typeof projectRap.$inferSelect> {
  const existing = await tx.query.projectRap.findFirst({
    where: and(eq(projectRap.id, rapId), eq(projectRap.tenantId, INSTANCE_TENANT_ID)),
  });
  if (!existing) throw new Error("RAP_NOT_FOUND");
  await lockRapProjectTx(tx, actor, existing.projectId, permission);
  const [rap] = await tx.select().from(projectRap).where(eq(projectRap.id, rapId)).for("update");
  if (rap.status !== "DRAFT")
    throw new Error("FORBIDDEN: RAP bukan Draft. Gunakan alur revisi yang sesuai.");
  return rap;
}
function nextVersion(current: Date): Date {
  return new Date(Math.max(Date.now(), current.getTime() + 1));
}
async function touchRap(
  tx: FinanceTransaction,
  rap: typeof projectRap.$inferSelect,
): Promise<void> {
  await tx
    .update(projectRap)
    .set({ updatedAt: nextVersion(rap.updatedAt) })
    .where(eq(projectRap.id, rap.id));
}
export async function createProjectRapTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: CreateProjectRapInput,
): Promise<typeof projectRap.$inferSelect> {
  await lockRapProjectTx(tx, actor, input.projectId, "create:rap");
  const existing = await tx.query.projectRap.findFirst({
    where: and(
      eq(projectRap.projectId, input.projectId),
      eq(projectRap.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (existing) throw new Error("FORBIDDEN: RAP proyek sudah tersedia.");
  const [created] = await tx
    .insert(projectRap)
    .values({
      projectId: input.projectId,
      status: "DRAFT",
      revision: 1,
      notes: input.notes ?? null,
    })
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "CREATE_RAP_DRAFT",
    targetTable: "project_rap",
    targetId: created.id,
    newState: JSON.stringify(created),
  });
  return created;
}
export async function addProjectRapItemsTx(
  tx: FinanceTransaction,
  actor: Actor,
  rapId: string,
  inputs: readonly AddProjectRapItemInput[],
  rowIds?: readonly string[],
): Promise<(typeof projectRapItem.$inferSelect)[]> {
  const rap = await lockProjectRapTx(tx, actor, rapId);
  await lockRapMaterialReferencesTx(
    tx,
    inputs.flatMap((input) => (input.materialId ? [input.materialId] : [])),
  );
  const values: Awaited<ReturnType<typeof buildRapItemValues>>[] = [];
  for (const input of inputs) values.push(await buildRapItemValues(input, tx));
  if (!values.length) throw new Error("Pilih minimal satu baris RAP.");
  if (rowIds && rowIds.length !== values.length)
    throw new Error("Identitas baris RAP tidak valid.");
  const rows = await tx
    .insert(projectRapItem)
    .values(values.map((row, index) => ({ id: rowIds?.[index], projectRapId: rap.id, ...row })))
    .returning();
  await tx.insert(auditLog).values(
    rows.map((row) => ({
      userId: actor.userId,
      action: "CREATE_RAP_ITEM_DRAFT",
      targetTable: "project_rap_item",
      targetId: row.id,
      newState: JSON.stringify(row),
    })),
  );
  await touchRap(tx, rap);
  return rows;
}
export async function updateProjectRapItemTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: UpdateProjectRapItemInput,
): Promise<typeof projectRapItem.$inferSelect> {
  const item = await tx.query.projectRapItem.findFirst({
    where: eq(projectRapItem.id, input.projectRapItemId),
  });
  if (!item) throw new Error("RAP_ITEM_NOT_FOUND");
  const rap = await lockProjectRapTx(tx, actor, item.projectRapId);
  const [current] = await tx
    .select()
    .from(projectRapItem)
    .where(eq(projectRapItem.id, item.id))
    .for("update");
  if (!current) throw new Error("RAP_ITEM_NOT_FOUND");
  await lockRapMaterialReferencesTx(tx, input.materialId ? [input.materialId] : []);
  const values = await buildRapItemValues(input, tx);
  const [updated] = await tx
    .update(projectRapItem)
    .set({ ...values, updatedAt: nextVersion(current.updatedAt) })
    .where(eq(projectRapItem.id, item.id))
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "UPDATE_RAP_ITEM_DRAFT",
    targetTable: "project_rap_item",
    targetId: item.id,
    originalState: JSON.stringify(current),
    newState: JSON.stringify(updated),
  });
  await touchRap(tx, rap);
  return updated;
}
export async function deleteProjectRapItemTx(
  tx: FinanceTransaction,
  actor: Actor,
  itemId: string,
): Promise<{ readonly deletedId: string }> {
  const item = await tx.query.projectRapItem.findFirst({ where: eq(projectRapItem.id, itemId) });
  if (!item) throw new Error("RAP_ITEM_NOT_FOUND");
  const rap = await lockProjectRapTx(tx, actor, item.projectRapId);
  const [current] = await tx
    .select()
    .from(projectRapItem)
    .where(eq(projectRapItem.id, item.id))
    .for("update");
  if (!current) throw new Error("RAP_ITEM_NOT_FOUND");
  await tx.delete(projectRapItem).where(eq(projectRapItem.id, item.id));
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "DELETE_RAP_ITEM_DRAFT",
    targetTable: "project_rap_item",
    targetId: item.id,
    originalState: JSON.stringify(current),
  });
  await touchRap(tx, rap);
  return { deletedId: item.id };
}
