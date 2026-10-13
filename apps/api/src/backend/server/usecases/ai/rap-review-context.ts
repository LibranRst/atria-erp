import { db } from "@backend/db";
import { formDraft, INSTANCE_TENANT_ID, project } from "@backend/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { AiToolContext } from "@backend/lib/ai/tools/context";
import {
  rapDraftProposalSchema,
  rapReviewPayloadSchema,
  type RapDraftProposal,
} from "@atria/core/ai/rap-draft";
import { applyRapDraftPatches } from "@atria/core/ai/rap-review";
import { readOwnedStoredProposal } from "./stored-proposal";
import { canPrepareRap, readRapPlanningContext } from "../material/rap-context";

/** Read-only context for the model after human corrections; it never initializes drafts. */
export async function readRapReviewCorrections(
  context: AiToolContext,
  projectId: string,
): Promise<
  readonly {
    readonly lastSavedAt: string;
    readonly revision: number;
    readonly needsRefresh: boolean;
    readonly totalEstimate: number;
    readonly rows: readonly Pick<
      RapDraftProposal["rows"][number],
      | "materialId"
      | "materialName"
      | "unit"
      | "area"
      | "requiredQuantity"
      | "bufferQuantity"
      | "estimatedUnitCost"
    >[];
  }[]
> {
  if (!canPrepareRap(context)) return [];
  const accessible = await db.query.project.findFirst({
    where: and(
      eq(project.id, projectId),
      eq(project.tenantId, INSTANCE_TENANT_ID),
      context.dataScope === "ASSIGNED" ? eq(project.projectManagerId, context.userId) : undefined,
    ),
    columns: { id: true },
  });
  if (!accessible) return [];
  const records = await db.query.formDraft.findMany({
    where: and(
      eq(formDraft.tenantId, INSTANCE_TENANT_ID),
      eq(formDraft.ownerUserId, context.userId),
      eq(formDraft.projectId, projectId),
      eq(formDraft.formType, "RAP_MATERIAL_DRAFT"),
      eq(formDraft.status, "ACTIVE"),
    ),
    orderBy: [desc(formDraft.lastSavedAt)],
    limit: 3,
  });
  const found = await Promise.all(
    records.map(async (record) => {
      try {
        const payload = rapReviewPayloadSchema.parse(record.payload);
        const source = await readOwnedStoredProposal(
          db,
          context,
          payload,
          "proposeRapMaterialDraft",
          rapDraftProposalSchema,
        );
        if (source.proposal.projectId !== projectId) return null;
        const proposal = applyRapDraftPatches(source.proposal, payload.rows);
        let needsRefresh =
          source.expiresAt <= Date.now() || record.expiresAt.getTime() <= Date.now();
        try {
          const current = await readRapPlanningContext(
            context,
            projectId,
            proposal.rows.map((row) => row.materialId),
          );
          needsRefresh ||= current.contextVersion !== proposal.expectedContext;
        } catch {
          needsRefresh = true;
        }
        return {
          lastSavedAt: record.lastSavedAt.toISOString(),
          revision: record.revision,
          needsRefresh,
          totalEstimate: proposal.budget.addition,
          rows: proposal.rows.map((row) => ({
            materialId: row.materialId,
            materialName: row.materialName,
            unit: row.unit,
            area: row.area,
            requiredQuantity: row.requiredQuantity,
            bufferQuantity: row.bufferQuantity,
            estimatedUnitCost: row.estimatedUnitCost,
          })),
        };
      } catch {
        return null;
      }
    }),
  );
  return found.filter((record) => record !== null);
}
