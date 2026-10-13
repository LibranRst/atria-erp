import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { db } from "@backend/db";
import { project, rabEstimate, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import {
  assertRabExportRights,
  prepareRabExport,
} from "@backend/server/usecases/ai/rab-export-context";
import { rabExportInputSchema } from "@atria/core/ai/rab-export";
import type { AiToolContext } from "./context";
async function current(context: AiToolContext): Promise<Actor> {
  const actor = await resolveActor();
  if (!actor || actor.userId !== context.userId) throw new Error("Sesi tidak valid.");
  assertRabExportRights(actor);
  return actor;
}
export function buildRabExportTools(context: AiToolContext): ToolSet {
  return {
    getRabExportContext: tool({
      description:
        "Read-only scoped project/revision choices before client RAB export. Search supports1 character,20 rows/page; return actual IDs, never silently pick first. Ask the human which revision when ambiguous; retain Draft/Approved distinction. Follow hasMore. Never infer client approval or send documents to anyone. For missing RAB use the existing RAB draft workflow first.",
      inputSchema: z
        .object({
          projectId: z.string().guid().optional(),
          projectQuery: z.string().trim().min(1).max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          const actor = await current(context);
          const scope =
            actor.dataScope === "ASSIGNED" ? eq(project.projectManagerId, actor.userId) : undefined;
          if (!input.projectId) {
            const rows = await db.query.project.findMany({
              where: and(
                eq(project.tenantId, INSTANCE_TENANT_ID),
                scope,
                input.projectQuery
                  ? ilike(
                      project.name,
                      `%${input.projectQuery.replace(/[\\%_]/g, (c) => `\\${c}`)}%`,
                    )
                  : undefined,
              ),
              columns: { id: true, name: true },
              orderBy: [asc(project.name), asc(project.id)],
              limit: 21,
              offset: input.offset,
            });
            return {
              projects: rows.slice(0, 20),
              hasMore: rows.length > 20,
              nextOffset: rows.length > 20 ? input.offset + 20 : null,
              needsDisambiguation:
                !input.projectQuery ||
                input.projectQuery.length === 1 ||
                rows.length !== 1 ||
                input.offset !== 0,
              instruction:
                rows.length === 1 && input.projectQuery && input.projectQuery.length > 1
                  ? "Nama proyek cocok dengan satu referensi. Gunakan ID hasil ini untuk membaca revisi; tidak perlu meminta pilihan ulang."
                  : "Minta pilihan proyek dengan referensi nyata, lalu baca revisinya.",
            };
          }
          const p = await db.query.project.findFirst({
            where: and(
              eq(project.id, input.projectId),
              eq(project.tenantId, INSTANCE_TENANT_ID),
              scope,
            ),
            columns: { id: true, name: true },
          });
          if (!p) return { error: "Proyek di luar akses Anda." };
          const rows = await db.query.rabEstimate.findMany({
            where: and(
              eq(rabEstimate.projectId, p.id),
              eq(rabEstimate.tenantId, INSTANCE_TENANT_ID),
            ),
            columns: { id: true, title: true, status: true, revision: true },
            orderBy: [desc(rabEstimate.revision), asc(rabEstimate.id)],
            offset: input.offset,
            limit: 21,
          });
          return {
            project: p,
            revisions: rows
              .slice(0, 20)
              .map((r) => ({ ...r, exportable: r.status === "DRAFT" || r.status === "APPROVED" })),
            hasMore: rows.length > 20,
            nextOffset: rows.length > 20 ? input.offset + 20 : null,
            needsRevisionChoice:
              rows.filter((r) => r.status === "DRAFT" || r.status === "APPROVED").length !== 1 ||
              rows.length > 20 ||
              input.offset !== 0,
            instruction:
              "Gunakan revisi yang diminta/dipilih manusia. Jika belum jelas, tampilkan pilihan judul, nomor revisi dan status. prepareRabExport hanya membuat card; manusia membuka preview dan mengunduh PDF/Excel/PNG.",
          };
        } catch (e: unknown) {
          return { error: e instanceof Error ? e.message : "Pilihan ekspor belum dapat dibaca." };
        }
      },
    }),
    prepareRabExport: tool({
      description:
        "Read-only prepare a client-safe RAB_EXPORT card for an explicitly chosen existing project and RAB revision. PDF/EXCEL/PNG chooses initial format only, no automatic download/approval/business mutation. Includes actual visible total/status and fingerprint, no internal cost/margin/vendor/private notes. User must preview and press Download; formats share one document. Never invent terms, contacts or client consent. Empty/void revisions cannot export; edits require fresh export card.",
      inputSchema: rabExportInputSchema,
      execute: async (input) => {
        try {
          return { proposal: await prepareRabExport(await current(context), input) };
        } catch (e: unknown) {
          return { error: e instanceof Error ? e.message : "Dokumen belum dapat disiapkan." };
        }
      },
    }),
  };
}
