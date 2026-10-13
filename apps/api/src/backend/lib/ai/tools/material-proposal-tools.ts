import { tool, type ToolSet } from "ai";
import type { AiToolContext } from "./context";
import { resolveActor } from "@backend/server/actor";
import { prepareProcurementWarehouseProposal } from "@backend/server/usecases/ai/procurement-warehouse-context";
import { warehouseIntakeInputSchema } from "@atria/core/ai/procurement-warehouse";

/** Compatibility tool name now prepares the same owned multi-material receipt. */
export function buildMaterialProposalTools(_context: AiToolContext): ToolSet {
  return {
    proposeGoodsReceipt: tool({
      description:
        "Read-only project goods-receipt proposal, now supporting1–100 unique material/RAP lines. Use getWarehouseIntakeContext to resolve actual project, active warehouse, materials and optional bill/RAP links first. Require explicit location, human receipt reference/date, note, quantities and unit costs. Never select the first warehouse, assume today's date or infer a new price from stored average cost. Return an owned PROCUREMENT_WAREHOUSE preview; only its explicit button records stock with audit. No cash or expense is created. Company-only receipts use proposeWarehouseIntake WAREHOUSE_STOCK_IN; opening inventory uses its separate request/checker flow.",
      inputSchema: warehouseIntakeInputSchema.options[0],
      execute: async (input) => {
        const actor = await resolveActor();
        if (!actor) return { error: "Sesi tidak valid." };
        try {
          return { proposal: await prepareProcurementWarehouseProposal(actor, input) };
        } catch (error: unknown) {
          return {
            error: error instanceof Error ? error.message : "Penerimaan belum dapat disiapkan.",
          };
        }
      },
    }),
  };
}
