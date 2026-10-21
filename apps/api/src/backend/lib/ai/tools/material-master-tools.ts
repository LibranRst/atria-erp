import { db } from "@backend/db";
import { formDraft } from "@backend/db/schema";
import { loadMaterialReferences } from "@backend/server/usecases/material/master-writer";
import {
  materialDraftPayloadSchema,
  materialProposalSchema,
  MATERIAL_IMPORT_FORM,
} from "@atria/core/ai/material-import";
import { tool } from "ai";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { hasPermission, permissionDenied, type AiToolContext } from "./context";
export function buildMaterialMasterTools(context: AiToolContext) {
  return {
    getMaterialInputContext: tool({
      description:
        "Read material categories, active location/vendor names, and catalog identities for preparing material input. No writes.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!hasPermission(context, "manage:material_settings"))
          return permissionDenied("pengaturan material");
        const refs = await loadMaterialReferences();
        return {
          categories: refs.categories.map((row) => row.name),
          locations: refs.locations.filter((row) => row.isActive).map((row) => row.name),
          vendors: refs.vendors.filter((row) => row.isActive).map((row) => row.name),
          materials: refs.materials,
          canCreateVendor: hasPermission(context, "manage:vendors"),
        };
      },
    }),
    getMaterialDraftForCorrection: tool({
      description:
        "Read your material import draft and stable row IDs for conversational corrections. Never change created rows.",
      inputSchema: z.object({
        draftId: z.guid(),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ draftId, offset, limit }) => {
        if (!hasPermission(context, "manage:material_settings"))
          return permissionDenied("pengaturan material");
        const draft = await db.query.formDraft.findFirst({
          where: and(
            eq(formDraft.id, draftId),
            eq(formDraft.ownerUserId, context.userId),
            eq(formDraft.formType, MATERIAL_IMPORT_FORM),
            eq(formDraft.status, "ACTIVE"),
            gt(formDraft.expiresAt, new Date()),
          ),
        });
        const parsed = materialDraftPayloadSchema.safeParse(draft?.payload);
        return parsed.success
          ? {
              draftId,
              totalRows: parsed.data.rows.length,
              rows: parsed.data.rows
                .slice(offset, offset + limit)
                .map(({ source, ...row }) => ({ ...row, sourceRow: source.row })),
              revision: draft?.revision,
            }
          : { error: "Draft tidak tersedia." };
      },
    }),
    proposeMaterialMaster: tool({
      description:
        "Prepare Material Master creation from text or attached catalog. For attachments supply the private URLs from message metadata; leave rows empty for durable background extraction of ALL rows. For text supply fields, never invent costs/phone/stock. For corrections first read the owned draft and supply correctionDraftId/corrections. Use bulkCorrections with empty rowIds for ALL unsaved rows to set a common category/unit/location/vendor or selection; do not emit hundreds of complete rows. Bulk changes preserve uncertain-source review flags. Review and explicit save happen in chat; no domain writes.",
      inputSchema: materialProposalSchema.omit({ kind: true }),
      execute: async (input) => {
        if (!hasPermission(context, "manage:material_settings"))
          return permissionDenied("pengaturan material");
        return {
          proposal: { kind: "MATERIAL_MASTER_IMPORT" as const, ...input },
          instruction:
            "Kartu review material tampil otomatis. Analisis lampiran berjalan di background; user harus review dan menekan Simpan sebelum data bisnis dibuat. Referensi baru memakai konfirmasi terpisah.",
        };
      },
    }),
  };
}
