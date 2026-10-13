import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { db } from "@backend/db";
import { project, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import { rapChangeInputSchema } from "@atria/core/ai/rap-change";
import { rapIdSchema } from "@atria/core/ai/rap-draft";
import {
  canPrepareRap,
  readRapPlanningContext,
  rapDraftFailure,
} from "@backend/server/usecases/material/rap-context";
import {
  rapChangeItems,
  readRapChangeContext,
  buildRapChangeProposal,
} from "@backend/server/usecases/material/rap-change-reader";
import { permissionDenied, type AiToolContext } from "./context";
export function buildRapChangeTools(context: AiToolContext): ToolSet {
  return {
    getEditableRapItems: tool({
      description:
        "Read-only lookup of saved items in the latest editable Draft RAP. Search accessible projects first; ask user to choose ambiguous projects/material/area candidates. With projectId returns item IDs, area, unit, quantities, cost and current Material budget. itemQuery narrows name/area; offset paginates50items and hasMore flags further rows. IDs must come from this lookup; never guess. Locked RAP requires proposeRapLifecycleActions revision. No writes or stock/cash impact.",
      inputSchema: z
        .object({
          projectId: rapIdSchema.optional(),
          projectQuery: z.string().max(100).optional(),
          itemQuery: z.string().max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        if (!canPrepareRap(context)) return permissionDenied("edit RAP dan budget Material");
        try {
          if (!input.projectId) {
            const found = await db.query.project.findMany({
              where: and(
                eq(project.tenantId, INSTANCE_TENANT_ID),
                inArray(project.status, ["DRAFT", "ACTIVE"]),
                context.dataScope === "ASSIGNED"
                  ? eq(project.projectManagerId, context.userId)
                  : undefined,
                input.projectQuery?.trim()
                  ? ilike(project.name, `%${input.projectQuery.trim()}%`)
                  : undefined,
              ),
              columns: { id: true, name: true },
              orderBy: [asc(project.name)],
              limit: 21,
            });
            return {
              projects: found.slice(0, 20),
              needsDisambiguation: found.length > 1,
              hasMore: found.length > 20,
            };
          }
          const current = await readRapPlanningContext(context, input.projectId, []);
          const query = input.itemQuery?.trim().toLocaleLowerCase("id-ID");
          const items = rapChangeItems(current).filter(
            (item) =>
              !query || `${item.name} ${item.area}`.toLocaleLowerCase("id-ID").includes(query),
          );
          return {
            project: { id: current.project.id, name: current.project.name },
            rapId: current.rap?.id,
            items: items.slice(input.offset, input.offset + 50),
            totalMatches: items.length,
            needsDisambiguation: Boolean(input.itemQuery) && items.length > 1,
            hasMore: items.length > input.offset + 50,
            budget: {
              allocated: current.materialBudget.allocatedAmount,
              actual: current.materialBudget.actualAmount,
              pending: current.materialBudget.pendingAmount,
              remaining: current.materialBudget.remainingAmount,
            },
            instruction:
              "Periksa nama dan area untuk memilih item yang tepat. Stok dan kas tidak berubah ketika rencana dikoreksi.",
          };
        } catch (error: unknown) {
          return rapDraftFailure(error);
        }
      },
    }),
    proposeRapMaterialChanges: tool({
      description:
        "Prepare an immutable preview to edit/delete1–50 saved item IDs in one latest Draft RAP, obtained from getEditableRapItems. UPDATE accepts area, quantities, estimate, explicit materialId/name/unit/description/internalNote/source; unspecified fields preserved. New materialId must be looked up; server resolves name/unit from active Master. Changed units require explicit quantity/buffer/cost; no conversion. Unlinking Master requires explicit name/unit. DELETE removes the RAP row, never Material Master. Need explicit user intent; ask for missing/ambiguous choices. For corrections generate a fresh complete desired change set. Never change locked RAP or stock/cash, never execute from a verbal approval. User must press confirmation button for atomic whole-batch commit. No writes here.",
      inputSchema: rapChangeInputSchema,
      execute: async (input) => {
        if (!canPrepareRap(context)) return permissionDenied("edit RAP dan budget Material");
        try {
          return {
            proposal: buildRapChangeProposal(input, await readRapChangeContext(context, input)),
            instruction:
              "Periksa perubahan sebelum/sesudah dan budget; hanya tombol konfirmasi menyimpan seluruh subset. Hapus harus dijelaskan eksplisit. Tidak ada perubahan stock atau kas.",
          };
        } catch (error: unknown) {
          return rapDraftFailure(error);
        }
      },
    }),
  };
}
