import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, desc, eq, gt, ilike, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import { INSTANCE_TENANT_ID, formDraft, project } from "@backend/db/schema";
import type { AiToolContext } from "./context";
import {
  buildRabProposal,
  canPrepareRab,
  readRabContext,
  RabReviewError,
} from "@backend/server/usecases/ai/rab-context";
import { rabDraftInputSchema, rabDraftPayloadSchema } from "@atria/core/ai/rab-draft";

export function buildRabDraftTools(context: AiToolContext): ToolSet {
  return {
    getRabDraftContext: tool({
      description:
        "Read-only scoped projects and eligible client RAB sources. Material must come from latest locked RAP; Tukang/Subcon from latest Siap/locked packages. Selling defaults are resolved server-side. No internal cost/margin/vendor/notes are returned. Paginated50 with hasMore; resolve ambiguity and never invent IDs or prices. Continue an existing RAB Draft with getRabWorkflowContext/proposeRabWorkflow; do not create duplicates.",
      inputSchema: z
        .object({
          projectId: z.string().guid().optional(),
          projectQuery: z.string().max(100).optional(),
          sourceQuery: z.string().max(100).optional(),
          reviewToolCallId: z.string().min(1).max(200).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        if (!canPrepareRab(context)) return { error: "Akses pembuatan RAB tidak tersedia." };
        try {
          if (!input.projectId) {
            const found = await db.query.project.findMany({
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
              projects: found.slice(0, 20),
              hasMore: found.length > 20,
              needsDisambiguation: found.length > 1,
            };
          }
          const current = await readRabContext(context, input.projectId);
          const query = input.sourceQuery?.trim().toLocaleLowerCase("id-ID");
          const rows = current.rows.filter(
            (row) => !query || row.sourceName.toLocaleLowerCase("id-ID").includes(query),
          );
          const reviews = await db.query.formDraft.findMany({
            where: and(
              eq(formDraft.tenantId, INSTANCE_TENANT_ID),
              eq(formDraft.ownerUserId, context.userId),
              eq(formDraft.projectId, input.projectId),
              eq(formDraft.formType, "RAB_DRAFT"),
              eq(formDraft.status, "ACTIVE"),
              gt(formDraft.expiresAt, new Date()),
            ),
            orderBy: [desc(formDraft.updatedAt)],
            limit: input.reviewToolCallId ? undefined : 21,
          });
          const corrections = reviews.flatMap((review) => {
            const parsed = rabDraftPayloadSchema.safeParse(review.payload);
            if (
              !parsed.success ||
              (input.reviewToolCallId && parsed.data.toolCallId !== input.reviewToolCallId)
            )
              return [];
            return [
              {
                toolCallId: parsed.data.toolCallId,
                title: parsed.data.title,
                revision: review.revision,
                ...(input.reviewToolCallId
                  ? {
                      clientNotes: parsed.data.clientNotes,
                      rows: parsed.data.rows.slice(input.offset, input.offset + 50),
                      hasMore: parsed.data.rows.length > input.offset + 50,
                    }
                  : {}),
              },
            ];
          });
          return {
            projectId: current.projectId,
            projectName: current.projectName,
            revision: current.revision,
            existingDraftId: current.openDraftId,
            sources: rows.slice(input.offset, input.offset + 50),
            totalMatches: rows.length,
            hasMore: rows.length > input.offset + 50,
            reviewCorrections: input.reviewToolCallId ? corrections : corrections.slice(0, 20),
            reviewCorrectionsHasMore: !input.reviewToolCallId && reviews.length > 20,
            instruction:
              "Harga ini harga jual usulan, bukan biaya internal. Pilih sumber nyata; jangan menyalin biaya, margin, vendor atau catatan internal ke deskripsi klien. Maksimal100 sumber per usulan; jangan memotong sumber diam-diam.",
          };
        } catch (error: unknown) {
          return {
            error:
              error instanceof RabReviewError ? error.message : "Sumber RAB belum dapat dibaca.",
          };
        }
      },
    }),
    proposeRabDraft: tool({
      description:
        "Prepare a read-only RAB draft proposal from source IDs returned by getRabDraftContext. Client labels/descriptions and selling price overrides must reflect user input; defaults resolved server-side. Review supports selection and corrections before explicit human save. Exact selected rows only, no automatic baseline manual/bundle copies; approved RAB stays intact. No business writes, approval, publication, stock/cash/budget changes.",
      inputSchema: rabDraftInputSchema,
      execute: async (input) => {
        if (!canPrepareRab(context)) return { error: "Akses pembuatan RAB tidak tersedia." };
        try {
          return { proposal: await buildRabProposal(context, input) };
        } catch (error: unknown) {
          return {
            error:
              error instanceof RabReviewError
                ? error.message
                : "Periksa label, jumlah dan harga jual RAB.",
          };
        }
      },
    }),
  };
}
