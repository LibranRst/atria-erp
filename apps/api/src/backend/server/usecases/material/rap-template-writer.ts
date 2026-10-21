import { and, eq } from "drizzle-orm";
import { db } from "@backend/db";
import {
  INSTANCE_TENANT_ID,
  itemPriceLibrary,
  materialMaster,
  projectRapItem,
  auditLog,
} from "@backend/db/schema";
import type { Actor } from "@backend/server/actor";
import type { FinanceTransaction } from "../finance/mutation-access";
import { copyTemplateToRapSchema } from "@atria/core/validations/workflow-governance";
import {
  addProjectRapItemSchema,
  type AddProjectRapItemInput,
} from "@atria/core/validations/rap-rab";
import { lockProjectRapTx, lockRapMaterialReferencesTx } from "./rap-writer";
import { buildRapItemValues } from "@backend/app/actions/project/rap-rab-utils";
import type { z } from "zod";
export async function resolveRapTemplate(
  input: z.infer<typeof copyTemplateToRapSchema>,
  connection: Pick<typeof db, "query"> = db,
): Promise<{
  values: AddProjectRapItemInput;
  libraryId: string;
  clientUnitPrice: string;
  template: typeof itemPriceLibrary.$inferSelect;
  material: typeof materialMaster.$inferSelect;
}> {
  copyTemplateToRapSchema.parse(input);
  const template = await connection.query.itemPriceLibrary.findFirst({
    where: and(
      eq(itemPriceLibrary.id, input.itemPriceLibraryId),
      eq(itemPriceLibrary.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!template?.isActive || template.itemType !== "MATERIAL_ITEM" || !template.materialId)
    throw new Error("Template Material aktif yang tertaut ke Master diperlukan.");
  const material = await connection.query.materialMaster.findFirst({
    where: and(
      eq(materialMaster.id, template.materialId),
      eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
    ),
  });
  if (!material?.isActive) throw new Error("Material tidak tersedia atau nonaktif.");
  if (template.unit !== material.unit)
    throw new Error(
      "Satuan template berbeda dengan Material Master. Perbaiki Settings sebelum menyalin.",
    );
  return {
    template,
    material,
    libraryId: template.id,
    clientUnitPrice: template.defaultClientPrice,
    values: addProjectRapItemSchema.parse({
      projectRapId: input.projectRapId,
      materialId: material.id,
      area: input.area,
      name: template.name,
      description: template.description,
      requiredQuantity: input.requiredQuantity,
      bufferQuantity: input.bufferQuantity,
      unit: template.unit,
      estimatedUnitCost: input.overrideUnitCost ?? Number(template.defaultInternalCost),
      source: input.source,
      internalNote: input.overrideReason ?? `Snapshot template ${template.code ?? template.name}.`,
    }),
  };
}
export async function copyRapTemplateTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: z.infer<typeof copyTemplateToRapSchema>,
  id?: string,
): Promise<typeof projectRapItem.$inferSelect> {
  const rap = await lockProjectRapTx(tx, actor, input.projectRapId);
  await tx
    .select({ id: itemPriceLibrary.id })
    .from(itemPriceLibrary)
    .where(eq(itemPriceLibrary.id, input.itemPriceLibraryId))
    .for("share");
  const resolved = await resolveRapTemplate(input, tx);
  await lockRapMaterialReferencesTx(tx, [resolved.material.id]);
  const [created] = await tx
    .insert(projectRapItem)
    .values({
      ...(await buildRapItemValues(resolved.values, tx)),
      id,
      projectRapId: rap.id,
      sourceLibraryItemId: resolved.libraryId,
      suggestedClientUnitPrice: resolved.clientUnitPrice,
    })
    .returning();
  await tx.insert(auditLog).values({
    userId: actor.userId,
    action: "COPY_PRICING_TEMPLATE_TO_RAP",
    targetTable: "project_rap_item",
    targetId: created.id,
    newState: JSON.stringify({
      ...created,
      templateId: resolved.libraryId,
      overrideReason: input.overrideReason ?? null,
    }),
  });
  return created;
}
