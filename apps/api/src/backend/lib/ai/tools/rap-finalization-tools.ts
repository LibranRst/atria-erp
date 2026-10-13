import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { db } from "@backend/db";
import { project, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import { setupInputSchema } from "@atria/core/ai/rap-finalization";
import { rapIdSchema } from "@atria/core/ai/rap-draft";
import {
  canReadSetup,
  readSetupContext,
  buildSetupProposal,
  setupContextSummary,
  setupFailure,
} from "@backend/server/usecases/ai/rap-finalization-context";
import { permissionDenied, type AiToolContext } from "./context";
export function buildRapFinalizationTools(context: AiToolContext): ToolSet {
  return {
    getRapSetupContext: tool({
      description:
        "Read-only latest RAP readiness, current stage, scoped package IDs and scopes, all category budget usage, plan estimates and permitted actions. Ask user to select ambiguous projects. offset paginates50 package candidates; hasMore flags further rows. Read budget before discussing readiness. No writes or automatic Ready/skip/finalize decisions.",
      inputSchema: z
        .object({
          projectId: rapIdSchema.optional(),
          projectQuery: z.string().max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        if (!canReadSetup(context)) return permissionDenied("RAP dan budget proyek");
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
          const state = await readSetupContext(context, input.projectId),
            summary = setupContextSummary(context, state);
          return {
            project: { id: state.project.id, name: state.project.name },
            projectRapId: state.records.rap.id,
            stage: summary.state.stage,
            status: summary.state.status,
            materialCount: summary.state.materialCount,
            scopes: {
              tukangSkipped: summary.state.tukangSkipped,
              subconSkipped: summary.state.subconSkipped,
            },
            readiness: summary.readiness,
            budget: summary.budget,
            allowed: summary.allowed,
            packages: summary.state.packages.slice(input.offset, input.offset + 50),
            packagesTotal: summary.state.packages.length,
            hasMore: summary.state.packages.length > input.offset + 50,
            instruction:
              "Tanyakan keputusan paket Siap atau scope tidak digunakan secara eksplisit. Jangan menghapus paket atau menebak keputusan. Gunakan urutan Material→Tukang→Subcon→Review; finalisasi harus langkah terakhir dan memakai izin lock:rap. Pergerakan stok/kas tidak terjadi.",
          };
        } catch (error: unknown) {
          return setupFailure(error);
        }
      },
    }),
    proposeRapSetupActions: tool({
      description:
        "Prepare immutable ordered RAP readiness/finalization preview using latest getRapSetupContext. Steps explicitly chosen by user: READY_PACKAGES (Draft IDs, up to50), SET_SCOPE Tukang/Subcon true/false, ADVANCE one adjacent stage, and optional terminal FINALIZE. Never silently mark all packages Ready or declare absent scopes unused. User reviews exactly affected package scopes/estimates and decisions. Enforce actual step-specific rights: update:budget for Ready/scope, update:rap for Material advance, update:budget for other advances, lock:rap for finalize. Missing/unready steps fail with clarification; locked RAP requires revision. Finalize changes only RAP status/stage with audit/notification. No package edits, RAB, stock, cash or expense writes. Tool is read-only; only user confirmation button commits the reviewed batch atomically. Fresh full proposal for corrections.",
      inputSchema: setupInputSchema,
      execute: async (input) => {
        if (!canReadSetup(context)) return permissionDenied("RAP dan budget proyek");
        try {
          return {
            proposal: buildSetupProposal(
              context,
              input,
              await readSetupContext(context, input.projectId),
            ),
            instruction:
              "Tinjau kesiapan, paket yang ditandai Siap, keputusan scope, urutan tahap dan budget. Hanya tombol user menyimpan. Finalisasi memiliki konfirmasi kunci tersendiri, tidak mereservasi stok atau mengubah kas.",
          };
        } catch (error: unknown) {
          return setupFailure(error);
        }
      },
    }),
  };
}
