import { actorCan } from "@backend/lib/auth/permissions";
import { itemPriceLibrary } from "@backend/db/schema";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { db } from "@backend/db";
import { project, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import type { AiToolContext } from "./context";
import {
  canReadSetup,
  setupFailure,
  buildSetupBudget,
} from "@backend/server/usecases/ai/rap-finalization-context";
import {
  readLifecycleContext,
  buildLifecycleProposal,
} from "@backend/server/usecases/ai/rap-lifecycle-context";
import { lifecycleInputSchema } from "@atria/core/ai/rap-lifecycle";
import { rapIdSchema } from "@atria/core/ai/rap-draft";
export function buildRapLifecycleTools(context: AiToolContext): ToolSet {
  return {
    getRapLifecycleContext: tool({
      description:
        "Read-only latest scoped RAP/budget and package candidates for new locked baseline revisions, Edit Lagi of Siap packages or deletion of Draft packages. Pagination50, hasMore explicit. Inspect all category budget usage first, select IDs by name/area, ask when ambiguous. No writes.",
      inputSchema: z
        .object({
          projectId: rapIdSchema.optional(),
          projectQuery: z.string().max(100).optional(),
          packageQuery: z.string().max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        if (!canReadSetup(context)) return { error: "Akses RAP dan budget tidak tersedia." };
        try {
          if (!input.projectId) {
            const projects = await db.query.project.findMany({
              where: and(
                eq(project.tenantId, INSTANCE_TENANT_ID),
                inArray(project.status, ["DRAFT", "ACTIVE"]),
                context.dataScope === "ASSIGNED"
                  ? eq(project.projectManagerId, context.userId)
                  : undefined,
                input.projectQuery
                  ? ilike(project.name, `%${input.projectQuery.trim()}%`)
                  : undefined,
              ),
              columns: { id: true, name: true },
              orderBy: [asc(project.name)],
              limit: 21,
            });
            return {
              projects: projects.slice(0, 20),
              hasMore: projects.length > 20,
              needsDisambiguation: projects.length > 1,
            };
          }
          const templates =
            actorCan(context, "view:material") && actorCan(context, "update:rap")
              ? await db.query.itemPriceLibrary.findMany({
                  where: and(
                    eq(itemPriceLibrary.tenantId, INSTANCE_TENANT_ID),
                    eq(itemPriceLibrary.isActive, true),
                    eq(itemPriceLibrary.itemType, "MATERIAL_ITEM"),
                  ),
                  columns: {
                    id: true,
                    name: true,
                    unit: true,
                    materialId: true,
                    defaultInternalCost: true,
                  },
                  orderBy: [asc(itemPriceLibrary.name)],
                  offset: input.offset,
                  limit: 51,
                })
              : [];
          const state = await readLifecycleContext(context, input.projectId),
            query = input.packageQuery?.trim().toLocaleLowerCase("id-ID");
          const packages = state.records.state.packages.filter(
            (p) =>
              !query ||
              `${p.snapshot.name} ${p.snapshot.area}`.toLocaleLowerCase("id-ID").includes(query),
          );
          return {
            project: { id: state.project.id, name: state.project.name },
            rap: {
              id: state.records.rap.id,
              revision: state.records.rap.revision,
              status: state.records.rap.status,
              materialCount: state.records.items.length,
            },
            budget: buildSetupBudget(state),
            packages: packages.slice(input.offset, input.offset + 50),
            hasMore: packages.length > input.offset + 50,
            totalMatches: packages.length,
            templates: templates.slice(0, 50),
            templatesHasMore: templates.length > 50,
            instruction:
              "Revisi memerlukan alasan10 karakter dan scope eksplisit. Paket-only revision juga menyiapkan draft RAP dengan baseline Material tetap. Hapus hanya Draft; Edit Lagi hanya Siap di RAP Draft. Pilihan tidak pernah otomatis. User harus menekan konfirmasi.",
          };
        } catch (error: unknown) {
          return setupFailure(error);
        }
      },
    }),
    proposeRapLifecycleActions: tool({
      description:
        "Prepare read-only immutable preview for explicit REVISION of latest locked RAP with reason>=10 and selected Material/package scopes, or PACKAGE_CHANGES1–50 unique REOPEN(Siap→Draft)/DELETE(Draft) targets in latest Draft RAP. Revision preserves locked baseline and creates new Draft RAP plus selected package copies atomically, including package-only requests. Needs update:rap for revision and update:budget for selected packages; dynamic permissions/scoping rechecked. Never delete locked/Siap packages, change stock/cash/RAB or infer scope. ADD_MATERIAL adds1–50 explicit MANUAL or LIBRARY rows to latest Draft RAP. Manual quantities/name/unit/cost must come from user; linked Master unit must match. Library IDs from context use Settings identity/cost, cost overrides require reason10 chars. Additional view:material/update:rap rights, active reference freshness checked. Fresh full proposal for corrections; only user button commits, delete requires second confirmation.",
      inputSchema: lifecycleInputSchema,
      execute: async (input) => {
        if (!canReadSetup(context)) return { error: "Akses RAP dan budget tidak tersedia." };
        try {
          return {
            proposal: buildLifecycleProposal(
              context,
              input,
              await readLifecycleContext(context, input.projectId, db, input),
            ),
          };
        } catch (error: unknown) {
          return setupFailure(error);
        }
      },
    }),
  };
}
