import { resolveActor } from "@backend/server/actor";
import {
  generateRabFromSelectedSourcesTx,
  lockRabGenerationTx,
} from "@backend/server/usecases/project/rab-generation-writer";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@backend/db";
import {
  auditLog,
  projectBudgets,
  projectRap,
  rabEstimate,
  rabEstimateItem,
} from "@backend/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  generateRabFromRapSchema,
  generateRabFromSelectedSourcesSchema,
  type GenerateRabFromRapInput,
  type GenerateRabFromSelectedSourcesInput,
} from "@atria/core/validations/rap-rab";
import { buildRabMaterialItemValues, toError } from "./rap-rab-utils";

export async function generateRabFromRap(
  input: GenerateRabFromRapInput,
): Promise<ActionResponse<typeof rabEstimate.$inferSelect>> {
  const validation = generateRabFromRapSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data generate RAB tidak valid." },
    };
  }

  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    const result = await db.transaction(async (tx) => {
      const target = await tx.query.projectRap.findFirst({
        where: eq(projectRap.id, validation.data.projectRapId),
        columns: { projectId: true },
      });
      if (!target) throw new Error("RAP_NOT_FOUND");
      await lockRabGenerationTx(tx, actor, target.projectId, [], []);
      const rap = await tx.query.projectRap.findFirst({
        where: eq(projectRap.id, validation.data.projectRapId),
        with: {
          project: true,
          items: true,
          rabEstimates: true,
        },
      });
      if (!rap) throw new Error("RAP_NOT_FOUND");
      if (rap.items.length === 0) throw new Error("RAP_EMPTY");
      if (rap.status !== "LOCKED")
        throw new Error("RAP harus difinalisasi sebelum menjadi source RAB.");

      const openEstimate = rap.rabEstimates.find((estimate) => estimate.status === "DRAFT");
      if (openEstimate) throw new Error("RAB_DRAFT_EXISTS");
      const currentApproved = await tx.query.rabEstimate.findFirst({
        where: and(eq(rabEstimate.projectId, rap.projectId), eq(rabEstimate.status, "APPROVED")),
      });

      const budget = await tx.query.projectBudgets.findFirst({
        where: eq(projectBudgets.projectId, rap.projectId),
      });
      const targetGrossPercentage = budget ? Number(budget.targetGrossPercentage) : 10;
      const lastEstimate = await tx.query.rabEstimate.findFirst({
        where: eq(rabEstimate.projectId, rap.projectId),
        orderBy: [desc(rabEstimate.revision)],
      });
      const revision = (lastEstimate?.revision ?? 0) + 1;

      const [estimate] = await tx
        .insert(rabEstimate)
        .values({
          projectId: rap.projectId,
          sourceProjectRapId: rap.id,
          supersedesRabEstimateId: currentApproved?.id ?? null,
          status: "DRAFT",
          revision,
          title: validation.data.title ?? `Client Estimate - ${rap.project.name}`,
          clientNotes:
            validation.data.clientNotes ??
            "Draft estimasi client berdasarkan material plan internal. Silakan review sebelum dikirim.",
        })
        .returning();

      await tx.insert(rabEstimateItem).values(
        rap.items.map((item, index) =>
          buildRabMaterialItemValues({
            rabEstimateId: estimate.id,
            item: { ...item, revision: rap.revision },
            targetGrossPercentage,
            displayOrder: index + 1,
            description: item.description ?? `${item.area} - ${item.name}`,
          }),
        ),
      );
      await tx.insert(auditLog).values({
        userId: actor.userId,
        action: "GENERATE_RAB_DRAFT_FROM_RAP",
        targetTable: "rab_estimate",
        targetId: estimate.id,
        newState: JSON.stringify({ estimate, sourceRapId: rap.id, itemCount: rap.items.length }),
      });

      return estimate;
    });

    return { success: true, data: result };
  } catch (error) {
    return toError(error, "Gagal generate RAB dari RAP.");
  }
}

export async function generateRabFromSelectedSources(
  input: GenerateRabFromSelectedSourcesInput,
): Promise<ActionResponse<typeof rabEstimate.$inferSelect>> {
  const validation = generateRabFromSelectedSourcesSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Data sumber quotation tidak valid." },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    return {
      success: true,
      data: await db.transaction((tx) =>
        generateRabFromSelectedSourcesTx(tx, actor, validation.data),
      ),
    };
  } catch (error: unknown) {
    return toError(error, "Gagal generate quotation dari sumber terpilih.");
  }
}
