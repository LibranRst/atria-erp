import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { hasPermission, permissionDenied, type AiToolContext } from "./context";
import {
  lookupEditableMaterials,
  readMaterialEditReferences,
  readMaterialEditTarget,
} from "@backend/server/usecases/material/master-edit-reader";
import { MaterialEditError } from "@backend/server/usecases/material/master-editor";
import {
  applyMaterialUpdate,
  materialEditIdSchema,
  materialUpdateChangesSchema,
  materialUpdateDiff,
  materialUpdateProposalSchema,
} from "@atria/core/ai/material-update";

export function buildMaterialEditTools(context: AiToolContext): ToolSet {
  const allowed = (): boolean =>
    hasPermission(context, "use:ai_chat") && hasPermission(context, "manage:material_settings");
  function failure(error: unknown): { error: string } {
    return {
      error:
        error instanceof MaterialEditError
          ? error.message
          : "Data material belum dapat disiapkan. Periksa nama, kategori, satuan, dan vendor.",
    };
  }
  return {
    getEditableMaterials: tool({
      description:
        "Find existing materials, INCLUDING inactive ones, and category/vendor IDs for an edit. Results are bounded: narrow query when hasMoreMaterials; use referenceQuery to search additional references when hasMoreReferences. Multiple candidates require user clarification. This is lookup only; never invent IDs or change inventory/prices.",
      inputSchema: z
        .object({
          query: z.string().max(100).optional(),
          materialId: materialEditIdSchema.optional(),
          referenceQuery: z.string().max(100).optional(),
        })
        .strict(),
      execute: async (input) => {
        if (!allowed()) return permissionDenied("pengaturan material");
        try {
          return await lookupEditableMaterials(input);
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    proposeUpdateMaterial: tool({
      description:
        "Prepare metadata/status changes to ONE existing Material Master, identified from getEditableMaterials. Ask which material when names/codes are ambiguous. Supply ONLY fields the user requested in changes; null explicitly clears vendor/specification/brand/code/color. Database-read before/after and version are returned for review. It does NOT write material data. Inventory, locations, price library and quantities are separate manual workflows. User must press Save in the proposal card; conversational approval never executes the update.",
      inputSchema: z
        .object({ materialId: materialEditIdSchema, changes: materialUpdateChangesSchema })
        .strict(),
      execute: async ({ materialId, changes }) => {
        if (!allowed()) return permissionDenied("pengaturan material");
        try {
          const target = await readMaterialEditTarget(materialId);
          const fields = applyMaterialUpdate(target.snapshot, changes);
          const refs = await readMaterialEditReferences(fields.categoryId, fields.defaultVendorId);
          if (
            fields.defaultVendorId !== target.snapshot.defaultVendorId &&
            fields.defaultVendorId &&
            !refs.vendorIsActive
          )
            throw new MaterialEditError(
              "VALIDATION_ERROR",
              "Pilih vendor aktif atau tanpa vendor.",
            );
          const proposal = materialUpdateProposalSchema.parse({
            kind: "MATERIAL_MASTER_UPDATE",
            materialId,
            expectedUpdatedAt: target.updatedAt,
            before: target.snapshot,
            after: { ...fields, categoryName: refs.categoryName, vendorName: refs.vendorName },
          });
          if (!materialUpdateDiff(proposal.before, proposal.after).length)
            return { error: "Tidak ada perubahan dari data material saat ini." };
          return {
            proposal,
            instruction:
              "Periksa perubahan sebelum/sesudah pada kartu. Material baru berubah setelah user menekan Simpan perubahan; stok dan transaksi tidak berubah.",
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
  };
}
