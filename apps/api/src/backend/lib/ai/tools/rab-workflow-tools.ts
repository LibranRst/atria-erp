import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@backend/db";
import { INSTANCE_TENANT_ID, project, rabEstimate } from "@backend/db/schema";
import {
  canReadRabWorkflow,
  readRabWorkflowContext,
  buildRabWorkflowProposal,
} from "@backend/server/usecases/ai/rab-workflow-context";
import { RabReviewError } from "@backend/server/usecases/ai/rab-context";
import { rabWorkflowInputSchema } from "@atria/core/ai/rab-workflow";
import { selectCurrentRabEstimate } from "@atria/core/project/rab-selection";
import { actorCan } from "@backend/lib/auth/permissions";
import type { AiToolContext } from "./context";

export function buildRabWorkflowTools(actor: AiToolContext): ToolSet {
  return {
    getRabWorkflowContext: tool({
      description:
        "Read-only scoped existing RAB drafts, approved baselines, revisions, client selling lines/bundles and Change Orders. Paginated50; follow hasMore, disambiguate real project/RAB/item/order IDs and never invent them. No internal costs, margins, vendor/private notes are exposed. Use this before editing an existing Draft, bundling, revision or approval. Client confirmation requires actual human-supplied evidence/date; never infer consent. Initial RAB approval is direct; revisions require Change Order and maker/checker.",
      inputSchema: z
        .object({
          projectId: z.string().guid().optional(),
          projectQuery: z.string().max(100).optional(),
          rabEstimateId: z.string().guid().optional(),
          itemQuery: z.string().max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        if (!canReadRabWorkflow(actor)) return { error: "Akses chat dan RAB diperlukan." };
        try {
          if (!input.projectId) {
            const projects = await db.query.project.findMany({
              where: and(
                eq(project.tenantId, INSTANCE_TENANT_ID),
                actor.dataScope === "ASSIGNED"
                  ? eq(project.projectManagerId, actor.userId)
                  : undefined,
                input.projectQuery
                  ? ilike(project.name, `%${input.projectQuery.trim()}%`)
                  : undefined,
              ),
              columns: { id: true, name: true },
              orderBy: [asc(project.name)],
              limit: 21,
              offset: input.offset,
            });
            return {
              projects: projects.slice(0, 20),
              hasMore: projects.length > 20,
              nextOffset: projects.length > 20 ? input.offset + 20 : null,
              needsDisambiguation: projects.length > 1,
            };
          }
          // Scope is checked before returning any sibling RAB or Change Order.
          const scoped = await db.query.project.findFirst({
            where: and(
              eq(project.id, input.projectId),
              eq(project.tenantId, INSTANCE_TENANT_ID),
              actor.dataScope === "ASSIGNED"
                ? eq(project.projectManagerId, actor.userId)
                : undefined,
            ),
            columns: { id: true },
          });
          if (!scoped) return { error: "Proyek di luar akses Anda." };
          const records = await db.query.rabEstimate.findMany({
            where: and(
              eq(rabEstimate.projectId, input.projectId),
              eq(rabEstimate.tenantId, INSTANCE_TENANT_ID),
            ),
            orderBy: [asc(rabEstimate.revision)],
          });
          const chosen = input.rabEstimateId
            ? records.find((row) => row.id === input.rabEstimateId)
            : selectCurrentRabEstimate(records);
          if (!chosen)
            return {
              rabs: [],
              instruction:
                "Belum ada RAB. Gunakan getRabDraftContext/proposeRabDraft untuk membuatnya.",
            };
          const context = await readRabWorkflowContext(actor, input.projectId, chosen.id);
          const query = input.itemQuery?.trim().toLocaleLowerCase("id-ID");
          const items = context.items.filter(
            (row) => !query || row.clientLabel.toLocaleLowerCase("id-ID").includes(query),
          );
          return {
            projectId: input.projectId,
            projectName: context.records.project.name,
            rabs: records.slice(input.offset, input.offset + 50).map((row) => ({
              id: row.id,
              title: row.title,
              status: row.status,
              revision: row.revision,
              supersedesId: row.supersedesRabEstimateId,
            })),
            rabsHasMore: records.length > input.offset + 50,
            rab: {
              id: chosen.id,
              title: chosen.title,
              clientNotes: chosen.clientNotes ?? "",
              status: chosen.status,
              revision: chosen.revision,
              supersedesId: chosen.supersedesRabEstimateId,
            },
            items: items.slice(input.offset, input.offset + 50),
            linkedSourceRefreshAvailable:
              actorCan(actor, "update:rab") && Boolean(context.sourceRefresh?.length),
            itemsHasMore: items.length > input.offset + 50,
            bundles: context.bundles.slice(input.offset, input.offset + 50),
            bundlesHasMore: context.bundles.length > input.offset + 50,
            changeOrders: context.records.orders
              .slice(input.offset, input.offset + 50)
              .map((row) => ({
                id: row.id,
                baseRabEstimateId: row.baseRabEstimateId,
                revisedRabEstimateId: row.revisedRabEstimateId,
                status: row.status,
                reason: row.reason,
                scopeSummary: row.scopeSummary,
                previousContractValue: Number(row.previousContractValue),
                revisedContractValue: Number(row.revisedContractValue),
                valueDelta: Number(row.valueDelta),
                clientConfirmedAt: row.clientConfirmedAt?.toISOString() ?? null,
                confirmationReference: row.clientConfirmationReference,
                selfCreated: row.createdById === actor.userId,
              })),
            changeOrdersHasMore: context.records.orders.length > input.offset + 50,
            canEmergencyOverride: actorCan(actor, "override:self_approval"),
            instruction:
              "Koreksi hanya Draft. EXCLUDE mengeluarkan baris dari penawaran sambil menjaga sumber/audit. Anggota paket tidak dihitung dua kali. Gunakan bidang client-safe lengkap termasuk itemNature/isHidden saat UPDATE; jangan mengganti jenis biaya atau menampilkan baris tersembunyi tanpa permintaan user. Maksimal100 perubahan/anggota per usulan; jangan memotong sumber. CREATE_REVISION menyalin baseline utuh. Konfirmasi klien dan approval adalah tindakan terpisah. Emergency override hanya jika manusia memintanya eksplisit, punya izin, dan memberi alasan.",
          };
        } catch (error: unknown) {
          return {
            error:
              error instanceof RabReviewError ? error.message : "Konteks RAB belum dapat dibaca.",
          };
        }
      },
    }),
    proposeRabWorkflow: tool({
      description:
        "Read-only immutable preview for existing RAB Draft edits/manual additions/exclusion/restoration, REFRESH_SOURCES for linked quantity/unit/selling-price updates, bundle creation/edit/dissolution, initial approval, approved-baseline revision/cancellation and Change Order creation/client-confirmation/approve/reject. All business writes require the user's review button; prose approval does not execute. Resolve actual IDs/values with getRabWorkflowContext. Never infer client approval/evidence/date or emergency override. Corrections create a fresh full proposal. Contract/budget effects are derived server-side and shown only with budget access; no stock/cash moves.",
      inputSchema: rabWorkflowInputSchema,
      execute: async (input) => {
        if (!canReadRabWorkflow(actor)) return { error: "Akses chat dan RAB diperlukan." };
        try {
          const context = await readRabWorkflowContext(actor, input.projectId, input.rabEstimateId);
          return { proposal: buildRabWorkflowProposal(actor, input, context) };
        } catch (error: unknown) {
          return {
            error:
              error instanceof Error && !error.message.startsWith("Failed query:")
                ? error.message
                : "Usulan RAB belum dapat disiapkan.",
          };
        }
      },
    }),
  };
}
