import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { resolveActor, type Actor } from "@backend/server/actor";
import { getStockCorrectionContext } from "@backend/server/usecases/ai/stock-correction-context";
import {
  prepareProcurementWarehouseProposal,
  ProcurementWarehouseError,
} from "@backend/server/usecases/ai/procurement-warehouse-context";
import { stockCorrectionInputSchema } from "@atria/core/ai/procurement-warehouse";
import type { AiToolContext } from "./context";
import {
  StockCorrectionError,
  type StockCorrectionFailureContext,
} from "@backend/server/usecases/material/stock-correction-writer";
async function current(context: AiToolContext): Promise<Actor> {
  const actor = await resolveActor();
  if (!actor || actor.userId !== context.userId)
    throw new StockCorrectionError(
      "FORBIDDEN",
      "Sesi tidak valid. Masuk kembali untuk melanjutkan.",
    );
  return actor;
}
function failure(error: unknown): {
  error: string;
  toolFailed: true;
  code: string;
  stockContext?: StockCorrectionFailureContext;
} {
  return {
    error:
      error instanceof StockCorrectionError || error instanceof ProcurementWarehouseError
        ? error.message
        : "Sumber koreksi stok belum dapat dibaca. Periksa lagi.",
    toolFailed: true,
    code:
      error instanceof StockCorrectionError || error instanceof ProcurementWarehouseError
        ? error.code
        : "READ_FAILED",
    ...(error instanceof StockCorrectionError && error.stockContext
      ? { stockContext: error.stockContext }
      : {}),
  };
}
export function buildStockCorrectionTools(context: AiToolContext): ToolSet {
  return {
    getStockCorrectionContext: tool({
      description:
        "Read-only direct stock correction sources: active locations, existing inventory, scoped projects or ADJUSTMENT history.20/page, one-character query, hasMore/nextOffset. Inventory/history require explicit inventoryLocationId; never choose first result or invent IDs. Any actual adjust:stock grant also needs chat/material/inventory read rights. ASSIGNED may correct only its chosen assigned project; NONE only warehouse without project. Read current/reserved stock with a NEW lookup before EVERY correction proposal, even when the same material was read earlier in this conversation or its prior correction was confirmed. Earlier lookups and proposal before/after fields are historical snapshots. For ordinary measured counts use existing stock-count draft/checker workflow; emergency overrides remain separate. Optional RAP/Material expense/vendor references require actual scoped lookup tools and an explicit human request; do not infer links from names. History is recorded corrections, not new changes.",
      inputSchema: z
        .object({
          resource: z.enum(["locations", "inventory", "projects", "history"]),
          query: z.string().trim().min(1).max(120).optional(),
          inventoryLocationId: z.string().guid().optional(),
          projectId: z.string().guid().optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          return await getStockCorrectionContext(await current(context), input);
        } catch (e: unknown) {
          return failure(e);
        }
      },
    }),
    proposeStockCorrection: tool({
      description:
        "Prepare only an immutable STOCK_CORRECT proposal for one chosen warehouse and1–50 distinct materials. Direction INCREASE/DECREASE and quantity are human-supplied deltas (max2 decimals), not an invented physical count. Require a human audit reason(min10 chars); ask for missing reason/quantity/location or ambiguous material. Default movement unit cost is verified inventory average; explicit unitCost changes only this movement, never average valuation. Optional project/RAP/Material-expense/vendor references must be actual valid matching IDs from scoped lookup. Reservations, cost averages, expenses, budgets, cash/banks remain unchanged. Negatives, quantities below reservations, inactive/missing sources, readiness gaps and scope failures block. Corrections regenerate a fresh proposal. Always call getStockCorrectionContext inventory again immediately before this proposal; never use an earlier turn as the latest stock. If the tool returns stockContext, its currentStock/reservedStock/availableStock/maximumDecrease are authoritative for explaining the blocker; do not quote stale conversation values. Actual use/damage/waste require their matching movement workflow, not a wrong-recording correction; ask purpose/reason when unclear and never invent an audit reason. Model tools do not post; only the human button Terapkan koreksi stok and its same-labelled confirmation execute the exact owned snapshot atomically with audit and receipt. Verbal approval alone never changes stock; no emergency bypass or self-approval.",
      inputSchema: stockCorrectionInputSchema,
      execute: async (input) => {
        try {
          return {
            proposal: await prepareProcurementWarehouseProposal(await current(context), input),
          };
        } catch (e: unknown) {
          return failure(e);
        }
      },
    }),
  };
}
