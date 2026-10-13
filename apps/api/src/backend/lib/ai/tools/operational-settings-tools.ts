import { and, asc, eq, ilike, or } from "drizzle-orm";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { db } from "@backend/db";
import { expenseCategory, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import { resolveActor, type Actor } from "@backend/server/actor";
import type { AiToolContext } from "./context";
import {
  approvalThresholdInputSchema,
  expenseCategoryInputSchema,
  isCoreExpenseCode,
} from "@atria/core/ai/operational-settings";
import {
  readOperationalThresholds,
  readExpenseCategorySettings,
  assertOperationalSettingsReadRights,
  OperationalSettingsError,
} from "@backend/server/usecases/settings/operational-settings-writer";
import {
  FinanceInputError,
  prepareFinanceInput,
} from "@backend/server/usecases/ai/finance-input-context";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";

async function currentActor(context: AiToolContext): Promise<Actor> {
  const actor = await resolveActor();
  if (!actor || actor.userId !== context.userId || !actorCan(actor, "use:ai_chat"))
    throw new OperationalSettingsError("FORBIDDEN", "Sesi atau akses chat tidak tersedia.");
  return actor;
}
function failure(error: unknown): { readonly error: string } {
  return {
    error:
      error instanceof OperationalSettingsError || error instanceof FinanceInputError
        ? error.message
        : "Sumber pengaturan belum dapat diperiksa. Coba lagi atau buka Settings.",
  };
}
export function buildOperationalSettingsTools(context: AiToolContext): ToolSet {
  return {
    getOperationalSettingsContext: tool({
      description:
        "Read-only actual company approval thresholds before changing policy. Values are rupiah (amount) and cents separately; >= threshold requires Owner approval, zero means all eligible submissions. Missing rows are clearly marked seed/fallback; invalid config fails visibly. Read requires view:settings; proposal/commit separately require manage:approval_settings; project dataScope never grants Settings authority. Existing submissions keep frozen owner-review decisions and over-budget safeguards remain. Never infer an amount or approval policy from generic business examples.",
      inputSchema: z.object({}).strict(),
      execute: async () => {
        try {
          const actor = await currentActor(context);
          const current = await readOperationalThresholds(actor);
          return {
            fieldCostAmount: current.values.fieldCostCents / 100,
            vendorPaymentAmount: current.values.vendorPaymentCents / 100,
            cents: current.values,
            usesFallback: current.rows.length < 2,
            rule: "Persetujuan Owner diperlukan mulai dari nominal ambang; nol berarti semua pengajuan terkait.",
            instruction:
              "Tanyakan ambang dan alasan perubahan yang belum disebutkan. Pertahankan ambang lain. Pengajuan berjalan tetap; gunakan proposeApprovalThresholds untuk preview, tombol manusia untuk menyimpan.",
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    getExpenseCategorySettingsContext: tool({
      description:
        "Read-only tenant company expense categories before corrections. Search supports1 character, 20 rows/page, explicit human choice for ambiguity/1 character; never invent an ID or silently select first. Given verified ID returns current metadata/status/reference ratio AND authoritative active budget allocation. Canonical5 codes/identities stay fixed and active; default usage/cap/full allocation belongs to getBudgetSettingsContext/proposeBudgetSettings. Ratio changes require additional manage:budget_settings, preserve all other categories and existing budgets. Read-only, no mutations.",
      inputSchema: z
        .object({
          expenseCategoryId: z.string().guid().optional(),
          categoryQuery: z.string().trim().min(1).max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          const actor = await currentActor(context);
          assertOperationalSettingsReadRights(actor);
          let id = input.expenseCategoryId;
          if (!id) {
            const rows = await db.query.expenseCategory.findMany({
              where: and(
                eq(expenseCategory.tenantId, INSTANCE_TENANT_ID),
                input.categoryQuery
                  ? or(
                      ilike(expenseCategory.name, `%${input.categoryQuery}%`),
                      ilike(expenseCategory.code, `%${input.categoryQuery}%`),
                    )
                  : undefined,
              ),
              orderBy: [asc(expenseCategory.sortOrder), asc(expenseCategory.id)],
              limit: 21,
              offset: input.offset,
            });
            if (!input.categoryQuery || input.categoryQuery.length === 1 || rows.length !== 1)
              return {
                categories: rows.slice(0, 20).map((row) => ({
                  id: row.id,
                  name: row.name,
                  category: isCoreExpenseCode(row.code) ? formatBusinessLabel(row.code) : row.name,
                  isActive: row.isActive,
                  isCore: isCoreExpenseCode(row.code),
                })),
                hasMore: rows.length > 20,
                nextOffset: rows.length > 20 ? input.offset + 20 : null,
                needsDisambiguation: true,
                instruction:
                  "Minta user memilih kategori yang dimaksud; gunakan ID hasil ini untuk membaca rinciannya.",
              };
            id = rows[0].id;
          }
          const current = await readExpenseCategorySettings(actor, id);
          return {
            category: {
              id: current.category.id,
              name: current.category.name,
              code: current.category.code,
              category: isCoreExpenseCode(current.category.code)
                ? formatBusinessLabel(current.category.code)
                : current.category.name,
              description: current.category.description,
              isActive: current.category.isActive,
              defaultRatio: Number(current.category.defaultRatio),
              isCore: isCoreExpenseCode(current.category.code),
            },
            allocation: current.allocation
              ? {
                  ratio: Number(current.allocation.ratioPercentage),
                  isEnabled: current.allocation.isEnabled,
                  settingId: current.defaults?.id,
                  categorySettingId: current.allocation.id,
                }
              : null,
            canChangeRatio: actorCan(actor, "manage:budget_settings"),
            canDeactivate: !isCoreExpenseCode(current.category.code),
            instruction:
              "Koreksi parsial mempertahankan nilai yang tidak diminta. Ratio berupa pecahan (35%=0.35), default aktif adalah sumber alokasi; ubah dengan izin budget dan total <=100%. Lima kategori inti tidak dinonaktifkan, gunakan default budget untuk penggunaan alokasinya. Minta nilai dan alasan yang belum jelas.",
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    proposeApprovalThresholds: tool({
      description:
        "Immutable read-only preview of explicit partial company approval threshold changes, using getOperationalSettingsContext first. Amounts are rupiah, up to2 decimals, zero valid and means all eligible submissions need Owner approval. Human-supplied mandatory reason; never choose policy or default omitted amounts. Preserve untouched threshold. Applies only to future evaluations, existing submitted review decisions and over-budget safeguards remain. Only current manage:approval_settings/view:settings, no role/security grants. Human must click protected confirmation; prose approval does not save.",
      inputSchema: approvalThresholdInputSchema,
      execute: async (input) => {
        try {
          return { proposal: await prepareFinanceInput(await currentActor(context), input) };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    proposeExpenseCategorySettings: tool({
      description:
        "Immutable read-only strict partial category correction using real tenant ID from getExpenseCategorySettingsContext. Name/description/status/reference ratio only; mandatory supplied human reason, preserve omissions and explicit null clears description. Canonical5 identities/codes stay fixed and active. Non-core status correction is availability only, never deletes history. Ratio is fraction (35%=0.35), additionally requires manage:budget_settings, syncs current company allocation default/reference atomically and enabled total <=100%. Existing project allocations/nominals unchanged. Use existing complete proposeBudgetSettings for cap or multi-category rebalancing/default usage. No-op/source conflict fails clearly. Only actual category/Settings rights, protected human save, no arbitrary SQL or security changes.",
      inputSchema: expenseCategoryInputSchema,
      execute: async (input) => {
        try {
          return { proposal: await prepareFinanceInput(await currentActor(context), input) };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
  };
}
