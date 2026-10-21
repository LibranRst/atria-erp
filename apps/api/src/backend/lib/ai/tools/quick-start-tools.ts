import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { resolveActor, type Actor } from "@backend/server/actor";
import {
  getQuickStartContext,
  prepareQuickStart,
} from "@backend/server/usecases/ai/quick-start-context";
import { QuickStartError } from "@backend/server/usecases/onboarding/quick-start-writer";
import { quickStartInputSchema } from "@atria/core/ai/quick-start";
import type { AiToolContext } from "./context";
async function current(ctx: AiToolContext): Promise<Actor> {
  const actor = await resolveActor();
  if (!actor || actor.userId !== ctx.userId)
    throw new QuickStartError("FORBIDDEN", "Sesi setup tidak tersedia.");
  return actor;
}
function failed(e: unknown): { error: string; toolFailed: true; code: string } {
  return {
    error: e instanceof QuickStartError ? e.message : "Setup belum dapat diperiksa. Coba lagi.",
    toolFailed: true,
    code: e instanceof QuickStartError ? e.code : "READ_FAILED",
  };
}
export function buildQuickStartTools(ctx: AiToolContext): ToolSet {
  return {
    getQuickStartContext: tool({
      description:
        "Read-only actual Quick Start position, stock decision, Settings readiness and bounded actual client/PM references.20/page,1-character search; ambiguous names require choice. manage:onboarding handles progress; create:opening_inventory only initial-stock decision. Any scope with actual domain grants, no Owner-name assumption. CREATE_PROJECT additionally needs create:project + view:settings. Setup completed never resets; ordinary later projects use existing project tools. Do not invent RAB approval or defaults. Actual financial defaults are reviewed here, updated through separate Settings tools. No legacy stock is a human declaration and cannot bypass actual stock/opening guards. Existing saldo awal uses independent opening approval.",
      inputSchema: z
        .object({
          resource: z.enum(["setup", "clients", "managers"]).default("setup"),
          query: z.string().trim().min(1).max(120).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          return await getQuickStartContext(await current(ctx), input);
        } catch (e: unknown) {
          return failed(e);
        }
      },
    }),
    proposeQuickStart: tool({
      description:
        "Prepare immutable QUICK_START preview only after reading getQuickStartContext. ADVANCE acknowledges only the actual welcome/financial_defaults step; PAUSE preserves current position; RESUME unpauses without advancing; RETRY records current-stage attempt without re-executing business writes. STOCK_DECISION is explicitly supplied NO_LEGACY_STOCK/HAS_LEGACY_STOCK/SKIPPED, never inferred; changes readiness metadata only, not inventory. CREATE_PROJECT requires first_project stage, actual complete Settings defaults, explicit name + exactly existing client or human new-client name + contract value + approved RAB value; PM optional but valid assigned-scope staff if chosen. Never fabricate amounts/IDs/contact/approval or silently mark reviewed. Missing details ask with requestInput fields. Human card/sheet Save executes unique owned identity atomically with audit/event/receipt; verbal approval never posts. Source/rights/expiry/no-op block; corrections regenerate preview. No bootstrap, credentials, grants, cash/stock or emergency bypass.",
      inputSchema: quickStartInputSchema,
      execute: async (input) => {
        try {
          return { proposal: await prepareQuickStart(await current(ctx), input) };
        } catch (e: unknown) {
          return failed(e);
        }
      },
    }),
  };
}
