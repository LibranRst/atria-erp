import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, eq, ilike, inArray, desc } from "drizzle-orm";
import { db } from "@backend/db";
import { formDraft, project, projectCost, INSTANCE_TENANT_ID } from "@backend/db/schema";
import type { AiToolContext } from "./context";
import { actorCan } from "@backend/lib/auth/permissions";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { expenseDraftPayloadSchema } from "@atria/core/validations/expense-draft";
import {
  expenseBatchRequestSchema,
  expenseBatchActionInputSchema,
  expenseBatchStateSchema,
} from "@atria/core/ai/expense-batch";
import {
  readExpenseContext,
  prepareExpenseBatch,
  ownedExpenseForm,
  EXPENSE_BATCH_FORM_TYPE,
} from "@backend/server/usecases/ai/expense-batch-context";
import { prepareExpenseBatchAction } from "@backend/server/usecases/ai/expense-batch-action-context";
const message = (e: unknown): string =>
  e instanceof Error && !e.message.startsWith("Failed query:")
    ? e.message
    : "Sumber pengeluaran belum dapat dibaca. Coba lagi.";
export function buildExpenseBatchTools(actor: AiToolContext): ToolSet {
  return {
    getExpenseBatchContext: tool({
      description:
        "Read-only scoped context for 1–50 expense rows: actual project budget category IDs, Material/location/RAP and matching Tukang/Subcon package choices, owned ordinary draft IDs and live expense statuses. One-character/ambiguous projectQuery returns choices; never invent IDs. Read draftId/reviewDraftId for continuation/correction, preserve pending row keys. No cleanup or metadata/business writes. offsets20 paginate costs/drafts/materials.",
      inputSchema: z
        .object({
          projectId: z.string().guid().optional(),
          projectQuery: z.string().trim().min(1).max(120).optional(),
          draftId: z.string().guid().optional(),
          reviewDraftId: z.string().guid().optional(),
          latestReview: z.boolean().optional(),
          receiptGroupId: z.string().guid().optional(),
          status: z.enum(["SUBMITTED", "VERIFIED", "APPROVED", "REJECTED", "PAID"]).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          if (
            !actorCan(actor, "use:ai_chat") ||
            !actorCan(actor, "view:project") ||
            (!actorCan(actor, "create:cost") && !actorCan(actor, "view:cost")) ||
            actor.dataScope === "NONE"
          )
            return { error: "Akses pengeluaran/proyek tidak tersedia." };
          let projectId = input.projectId;
          if (input.projectQuery) {
            const matches = await db.query.project.findMany({
              where: and(
                eq(project.tenantId, INSTANCE_TENANT_ID),
                ilike(project.name, `%${input.projectQuery}%`),
                actor.dataScope === "ASSIGNED"
                  ? eq(project.projectManagerId, actor.userId)
                  : undefined,
              ),
              columns: { id: true, name: true },
              orderBy: [asc(project.name)],
              limit: 21,
            });
            if (input.projectQuery.length === 1 || matches.length !== 1)
              return {
                projects: matches.slice(0, 20),
                hasMore: matches.length > 20,
                needsChoice: true,
                instruction: "Minta user memilih proyek, jangan memilih sendiri.",
              };
            projectId = matches[0].id;
          }
          if (input.latestReview && projectId && !input.reviewDraftId) {
            const latest = await db.query.formDraft.findFirst({
              where: and(
                eq(formDraft.tenantId, INSTANCE_TENANT_ID),
                eq(formDraft.ownerUserId, actor.userId),
                eq(formDraft.projectId, projectId),
                eq(formDraft.formType, EXPENSE_BATCH_FORM_TYPE),
              ),
              orderBy: [desc(formDraft.lastSavedAt)],
            });
            if (latest) input = { ...input, reviewDraftId: latest.id };
          }
          let draft: unknown = null;
          if (input.draftId) {
            const d = await ownedExpenseForm(actor, input.draftId, "EXPENSE_CREATE");
            const payload = expenseDraftPayloadSchema.parse(d.payload);
            projectId = payload.projectId || projectId;
            draft = {
              id: d.id,
              revision: d.revision,
              payload,
              status: formatBusinessLabel(d.status),
            };
          }
          if (input.reviewDraftId) {
            const d = await ownedExpenseForm(actor, input.reviewDraftId, EXPENSE_BATCH_FORM_TYPE),
              state = expenseBatchStateSchema.parse(d.payload);
            projectId = state.payload.projectId;
            draft = {
              reviewDraftId: d.id,
              revision: d.revision,
              payload: {
                ...state.payload,
                lines: state.payload.lines.filter(
                  (l) => !state.submitted.some((s) => s.key === l.key),
                ),
              },
              submitted: state.submitted,
              status: formatBusinessLabel(d.status),
              instruction:
                "Koreksi memakai reviewDraftId dan expectedRevision ini serta semua baris pending dengan key yang sama. Baris diajukan tidak boleh diedit.",
            };
          }
          if (!projectId) {
            const drafts = await db.query.formDraft.findMany({
              where: and(
                eq(formDraft.tenantId, INSTANCE_TENANT_ID),
                eq(formDraft.ownerUserId, actor.userId),
                eq(formDraft.status, "ACTIVE"),
                inArray(formDraft.formType, ["EXPENSE_CREATE", EXPENSE_BATCH_FORM_TYPE]),
              ),
              columns: {
                id: true,
                formType: true,
                projectId: true,
                revision: true,
                lastSavedAt: true,
              },
              orderBy: [desc(formDraft.lastSavedAt)],
              limit: 21,
              offset: input.offset,
            });
            return {
              drafts: drafts.slice(0, 20).map((d) => ({
                ...d,
                type: d.formType === EXPENSE_BATCH_FORM_TYPE ? "Review AI" : "Draft pengeluaran",
              })),
              nextOffset: drafts.length > 20 ? input.offset + 20 : null,
              instruction: "Pilih draft milik user atau proyek terverifikasi.",
            };
          }
          const c = await readExpenseContext(actor, projectId);
          const costs = actorCan(actor, "view:cost")
            ? await db.query.projectCost.findMany({
                where: and(
                  eq(projectCost.tenantId, INSTANCE_TENANT_ID),
                  eq(projectCost.projectId, projectId),
                  input.status ? eq(projectCost.status, input.status) : undefined,
                  input.receiptGroupId
                    ? eq(projectCost.receiptGroupId, input.receiptGroupId)
                    : undefined,
                ),
                orderBy: [desc(projectCost.createdAt), asc(projectCost.id)],
                limit: 21,
                offset: input.offset,
              })
            : [];
          return {
            project: {
              id: c.project.id,
              name: c.project.name,
              status: formatBusinessLabel(c.project.status),
            },
            draft,
            categories: c.categories.map((cat) => ({
              id: cat.id,
              name: cat.expenseCategory.name,
              code: cat.expenseCategory.code,
              ...(actorCan(actor, "view:budget")
                ? {
                    allocated: Number(cat.allocatedAmount),
                    actual: Number(cat.actualAmount),
                    pending: Number(cat.pendingAmount),
                  }
                : {}),
            })),
            materials: c.materials
              .slice(input.offset, input.offset + 20)
              .map((m) => ({ id: m.id, name: m.name, unit: m.unit })),
            nextMaterialOffset: c.materials.length > input.offset + 20 ? input.offset + 20 : null,
            locations: c.locations.map((l) => ({ id: l.id, name: l.name })),
            packages: c.packages.map((p) => ({
              id: p.id,
              name: p.name,
              categoryId: p.projectBudgetCategoryId,
            })),
            rapItems: c.rapItems
              .slice(input.offset, input.offset + 20)
              .map((r) => ({ id: r.id, materialId: r.materialId, name: r.name })),
            nextRapOffset: c.rapItems.length > input.offset + 20 ? input.offset + 20 : null,
            expenses: costs.slice(0, 20).map((cost) => ({
              id: cost.id,
              description: cost.description,
              amount: Number(cost.amount),
              exactAmount: cost.amount,
              status: formatBusinessLabel(cost.status),
              statusCode: cost.status,
              paymentStatus: cost.status === "PAID" ? "PAID" : "UNPAID",
              categoryId: cost.projectBudgetCategoryId,
              categoryName: c.categories.find((cat) => cat.id === cost.projectBudgetCategoryId)
                ?.expenseCategory.name,
              categoryCode: c.categories.find((cat) => cat.id === cost.projectBudgetCategoryId)
                ?.expenseCategory.code,
              createdAt: cost.createdAt.toISOString(),
              groupId: cost.receiptGroupId,
              requiresOwnerApproval: cost.requiresOwnerApproval,
              createdByCurrentUser: cost.requestedById === actor.userId,
              canVerify:
                cost.status === "SUBMITTED" &&
                actorCan(actor, "verify:cost") &&
                actorCan(actor, "update:cost"),
              canDecide: cost.status === "VERIFIED" && actorCan(actor, "approve:cost"),
              canPay:
                cost.status === "APPROVED" &&
                actorCan(actor, "pay:cost") &&
                actorCan(actor, "view:bank_account"),
            })),
            nextCostOffset: costs.length > 20 ? input.offset + 20 : null,
            instruction:
              "Maksimal50 baris; STOCK_IN/DIRECT_USE/RESERVE_FOR_PROJECT hanya Material dan memerlukan izin stok, material/lokasi, qty×harga=nominal. EXPENSE_ONLY untuk pengeluaran biasa. Tidak otomatis membuat stok atau pembayaran dari jumlah lampiran.",
          };
        } catch (error: unknown) {
          return { error: message(error) };
        }
      },
    }),
    proposeExpenseBatch: tool({
      description:
        "Prepare read-only editable expense batch preview, 1–50 rows on ONE project. Use actual getExpenseBatchContext IDs. Missing/uncertain values remain null/unselected for human review, never guess stock action. Amount is explicit; stock action must be explicitly requested and consistent qty×price. To resume ordinary owned draft use sourceDraftId with rows omitted. To correct existing AI review use reviewDraftId/expectedRevision and all pending rows preserving keys. Receipt attachment must be an actual owned image ID, not arbitrary external URL. Metadata review starts after chat; submission/stock only after button, and NEVER cash payment.",
      inputSchema: expenseBatchRequestSchema,
      execute: async (input) => {
        try {
          return {
            proposal: await prepareExpenseBatch(actor, input),
            instruction:
              "Ringkas isi usulan; user memilih/mengoreksi baris di review. Jangan mengaku telah mengajukan atau membayar.",
          };
        } catch (error: unknown) {
          return { error: message(error) };
        }
      },
    }),
    proposeExpenseBatchVerify: tool({
      description:
        "Read-only VERIFY preview of 1–50 scoped SUBMITTED claims. Requires verify:cost/update:cost. Existing small-claim automatic approval rule applies; no cash payment or repeating stock. User confirms all rows atomically.",
      inputSchema: expenseBatchActionInputSchema.safeExtend({ action: z.literal("VERIFY") }),
      execute: async (input) => {
        try {
          return {
            proposal: await prepareExpenseBatchAction(actor, input),
            instruction:
              "Tampilkan usulan tahap terpisah dalam Bahasa Indonesia. Tidak ada perubahan sampai tombol konfirmasi.",
          };
        } catch (error: unknown) {
          return { error: message(error) };
        }
      },
    }),
    proposeExpenseBatchDecision: tool({
      description:
        "Read-only APPROVE/REJECT preview of 1–50 VERIFIED claims with user-supplied reason. No self approval/emergency override. Separate protected confirmation; cash and stock unchanged.",
      inputSchema: expenseBatchActionInputSchema.safeExtend({
        action: z.enum(["APPROVE", "REJECT"]),
      }),
      execute: async (input) => {
        try {
          return {
            proposal: await prepareExpenseBatchAction(actor, input),
            instruction:
              "Tampilkan usulan tahap terpisah dalam Bahasa Indonesia. Tidak ada perubahan sampai tombol konfirmasi.",
          };
        } catch (error: unknown) {
          return { error: message(error) };
        }
      },
    }),
    proposeExpenseBatchPayment: tool({
      description:
        "Read-only PAY recording preview for 1–50 APPROVED claims. Requires chosen active bank account and a distinct human bank reference for every cost. Never invent references, never bypass missing Owner approval. Protected user confirmation records all ledger outflows atomically; no external bank transfer.",
      inputSchema: expenseBatchActionInputSchema.safeExtend({ action: z.literal("PAY") }),
      execute: async (input) => {
        try {
          return {
            proposal: await prepareExpenseBatchAction(actor, input),
            instruction:
              "Tampilkan usulan tahap terpisah dalam Bahasa Indonesia. Tidak ada perubahan sampai tombol konfirmasi.",
          };
        } catch (error: unknown) {
          return { error: message(error) };
        }
      },
    }),
  };
}
