import { readRapReviewCorrections } from "@backend/server/usecases/ai/rap-review-context";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { db } from "@backend/db";
import { INSTANCE_TENANT_ID, materialMaster, project } from "@backend/db/schema";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { rapDraftInputSchema, rapIdSchema } from "@atria/core/ai/rap-draft";
import {
  canPrepareRap,
  readRapPlanningContext,
  rapMaterialChoice,
  buildRapDraftProposal,
  RapDraftError,
} from "@backend/server/usecases/material/rap-context";
import { type AiToolContext, permissionDenied } from "./context";

export function buildRapDraftTools(context: AiToolContext): ToolSet {
  function failure(error: unknown): { error: string } {
    return {
      error:
        error instanceof RapDraftError
          ? error.message
          : "Data RAP belum dapat disiapkan. Periksa proyek, material, kuantitas dan harga.",
    };
  }
  return {
    getRapDraftContext: tool({
      description:
        "Read-only lookup for a Material RAP draft. Omit projectId and search projectQuery first to get accessible IDs; ask user to select ambiguous candidates. With projectId, reads owned reviewDrafts including human corrections (newest lastSavedAt first). Read these before answering about previous proposals or recreating a stale proposal; historical assistant text may predate edits. Also reads current Material budget usage/plan and up to 20 active material choices with units, stock and verified reference price. Narrow materialQuery when hasMoreMaterials. Read budget before shortage detail. No writes, reservations, expenses or changes to locked RAP.",
      inputSchema: z
        .object({
          projectId: rapIdSchema.optional(),
          projectQuery: z.string().max(100).optional(),
          materialQuery: z.string().max(100).optional(),
        })
        .strict(),
      execute: async (input) => {
        if (!canPrepareRap(context)) return permissionDenied("draft RAP dan budget Material");
        try {
          if (!input.projectId) {
            const matches = await db.query.project.findMany({
              where: and(
                eq(project.tenantId, INSTANCE_TENANT_ID),
                context.dataScope === "ASSIGNED"
                  ? eq(project.projectManagerId, context.userId)
                  : undefined,
                input.projectQuery?.trim()
                  ? ilike(project.name, `%${input.projectQuery.trim()}%`)
                  : undefined,
              ),
              columns: { id: true, name: true, status: true },
              orderBy: [asc(project.name)],
              limit: 21,
            });
            return {
              projects: matches.slice(0, 20),
              needsDisambiguation: matches.length > 1,
              hasMoreProjects: matches.length > 20,
            };
          }
          const base = await readRapPlanningContext(context, input.projectId, []);
          const choices = await db.query.materialMaster.findMany({
            where: and(
              eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
              eq(materialMaster.isActive, true),
              input.materialQuery?.trim()
                ? or(
                    ilike(materialMaster.name, `%${input.materialQuery.trim()}%`),
                    ilike(materialMaster.code, `%${input.materialQuery.trim()}%`),
                  )
                : undefined,
            ),
            orderBy: [asc(materialMaster.name)],
            limit: 21,
          });
          const selected = await readRapPlanningContext(
            context,
            input.projectId,
            choices.slice(0, 20).map((row) => row.id),
          );
          return {
            project: { id: base.project.id, name: base.project.name },
            rap: base.rap
              ? {
                  id: base.rap.id,
                  revision: base.rap.revision,
                  existingItems: base.rap.items.length,
                }
              : null,
            budget: {
              category: base.materialBudget.expenseCategory.name,
              allocated: Number(base.materialBudget.allocatedAmount),
              actual: Number(base.materialBudget.actualAmount),
              pending: Number(base.materialBudget.pendingAmount),
              remaining: Number(base.materialBudget.remainingAmount),
            },
            reviewDrafts: await readRapReviewCorrections(context, input.projectId),
            materials: selected.materials.map(rapMaterialChoice),
            hasMoreMaterials: choices.length > 20,
            instruction:
              "Harga null harus ditanyakan ke pengguna. Stok hanya petunjuk saat dibaca, belum direservasi. Simpan draft tidak mencatat pengeluaran.",
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    proposeRapMaterialDraft: tool({
      description:
        "Prepare 1–50 Material RAP rows from conversation using IDs obtained from getRapDraftContext. Never invent material IDs, units, quantities or costs. Omit estimatedUnitCost to use a verified database reference price; provide it only when user gives an explicit estimate (including explicit zero). Ask if price is missing or project/material ambiguous. Corrections must include the complete desired set of rows. Returns a budget-first review card for explicit Save. Adds to latest existing Draft or creates header+rows atomically after confirmation; never replaces existing items, locks/finalizes RAP, reserves stock, generates RAB or moves cash.",
      inputSchema: rapDraftInputSchema,
      execute: async (input) => {
        if (!canPrepareRap(context)) return permissionDenied("draft RAP dan budget Material");
        try {
          const current = await readRapPlanningContext(
            context,
            input.projectId,
            input.rows.map((row) => row.materialId),
          );
          return {
            proposal: buildRapDraftProposal(input, current),
            instruction:
              "Kartu review membandingkan rencana dengan alokasi Material. Draft baru tersimpan setelah user menekan Simpan draft RAP. Stok dan kas tetap; jangan mengeksekusi dari persetujuan teks.",
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
  };
}
