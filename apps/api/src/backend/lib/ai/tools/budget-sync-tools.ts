import { tool, type ToolSet } from "ai";
import { resolveActor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  inspectBudgetSummary,
  BudgetSummaryError,
} from "@backend/server/usecases/project/budget-summary-writer";
import { budgetSyncInputSchema } from "@atria/core/ai/budget-sync";
import type { AiToolContext } from "./context";
export function buildBudgetSyncTools(context: AiToolContext): ToolSet {
  return {
    inspectProjectBudgetSummary: tool({
      description:
        "Read-only inspection of the human-selected project's stored budget summaries against canonical expenses and completed vendor payments. First resolve the exact project ID with getProjects; search1 character/ambiguity requires human selection. Never invent an ID. Compares pending, consumed, paid, remaining, percentage and risk in every category. If matching, report no repair needed. If different, the card shows exact deltas and a HUMAN button performs reviewed synchronization; chat prose approval never writes. This only repairs derived usage: never changes contract/cap/allocation/Settings/expense statuses/cash/stock, creates missing expenses or hides invalid references. Missing budget requires setup, inconsistent references fail clearly. Read requires use:ai_chat/view:project/view:budget with actual tenant/project scope; commit separately requires update:budget. Corrections/source changes require a fresh inspection. No arbitrary SQL or autonomous repair.",
      inputSchema: budgetSyncInputSchema,
      execute: async (input) => {
        try {
          const actor = await resolveActor();
          if (!actor || actor.userId !== context.userId || !actorCan(actor, "use:ai_chat"))
            throw new BudgetSummaryError("FORBIDDEN", "Akses pemeriksaan tidak tersedia.");
          return { proposal: await inspectBudgetSummary(actor, input.projectId) };
        } catch (e: unknown) {
          return {
            error:
              e instanceof BudgetSummaryError
                ? e.message
                : "Ringkasan budget belum dapat diperiksa. Coba lagi.",
          };
        }
      },
    }),
  };
}
