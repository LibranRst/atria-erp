import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@backend/db";
import { INSTANCE_TENANT_ID, vendorBill, project } from "@backend/db/schema";
import { resolveActor, type Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { vendorBillCorrectionInputSchema } from "@atria/core/ai/procurement-warehouse";
import {
  assertVendorBillCorrectionRights,
  VendorBillCorrectionError,
  vendorBillCorrectionBlocked,
} from "@backend/server/usecases/finance/vendor-bill-correction-writer";
import { readVendorBillCorrectionSource } from "@backend/server/usecases/ai/vendor-bill-correction-context";
import { prepareProcurementWarehouseProposal } from "@backend/server/usecases/ai/procurement-warehouse-context";
import type { AiToolContext } from "./context";
async function current(context: AiToolContext): Promise<Actor> {
  const actor = await resolveActor();
  if (!actor || actor.userId !== context.userId || !actorCan(actor, "use:ai_chat"))
    throw new VendorBillCorrectionError("FORBIDDEN", "Akses chat tidak tersedia.");
  assertVendorBillCorrectionRights(actor);
  return actor;
}
function failure(error: unknown): { error: string } {
  return {
    error:
      error instanceof VendorBillCorrectionError
        ? error.message
        : "Tagihan belum dapat dibaca atau dikoreksi. Periksa akses dan sumber terbaru.",
  };
}
export function buildVendorBillCorrectionTools(context: AiToolContext): ToolSet {
  return {
    getVendorBillCorrectionContext: tool({
      description:
        "Read-only actual stored vendor bills for correction, distinct from owned drafts. Current view:vendor_bill and update:vendor_bill plus project scope required. Omit billId to search projectQuery/billQuery (1 character allowed), pages20 with hasMore/nextOffset; ask explicit choice for ambiguous matches, never invent IDs. With billId read bill number, due date, notes, exact amount, completed/scheduled payments, net receipts and amountBlocked reason. VOID cannot change; paid amount stays locked; any PENDING/PROCESSING schedule blocks amount until resolved; new amount cannot undercut completed payments or net receipts. Project/vendor/category/Material/RAP/package links are immutable. Documentary changes can preserve inactive historical vendor. Never modify cash, stock, status, links or an old draft through this workflow.",
      inputSchema: z
        .object({
          vendorBillId: z.string().guid().optional(),
          projectId: z.string().guid().optional(),
          projectQuery: z.string().trim().min(1).max(120).optional(),
          billQuery: z.string().trim().min(1).max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          const actor = await current(context);
          if (input.vendorBillId) {
            const s = await readVendorBillCorrectionSource(actor, input.vendorBillId);
            const blocked = vendorBillCorrectionBlocked(s.bill.status, s.project.status);
            if (input.projectId && input.projectId !== s.bill.projectId)
              throw new VendorBillCorrectionError(
                "FORBIDDEN",
                "Tagihan tidak sesuai proyek yang dipilih.",
              );
            return {
              bill: {
                id: s.bill.id,
                billNumber: s.bill.billNumber,
                projectId: s.bill.projectId,
                project: s.project.name,
                vendor: s.supplier.name,
                category: s.category.expenseCategory.name,
                status: formatBusinessLabel(s.bill.status),
                amount: Number(s.bill.amount),
                dueDate: s.bill.dueDate.toISOString().slice(0, 10),
                notes: s.bill.notes,
              },
              completedPayments: s.completed,
              scheduledPayments: s.scheduled,
              netReceipts: s.received,
              canCorrect: !blocked,
              correctionBlocked: blocked,
              amountBlocked: s.amountBlocked,
              minimumAmount: Math.max(s.completed, s.received),
              editableFields: blocked
                ? []
                : s.amountBlocked
                  ? ["billNumber", "dueDate", "notes"]
                  : ["billNumber", "dueDate", "notes", "amount"],
              ...(actorCan(actor, "view:budget")
                ? {
                    budget: {
                      allocated: Number(s.category.allocatedAmount),
                      actual: Number(s.category.actualAmount),
                      pending: Number(s.category.pendingAmount),
                    },
                  }
                : {}),
            };
          }
          const bills = await db
            .select({
              id: vendorBill.id,
              billNumber: vendorBill.billNumber,
              amount: vendorBill.amount,
              status: vendorBill.status,
              projectId: project.id,
              projectName: project.name,
            })
            .from(vendorBill)
            .innerJoin(project, eq(project.id, vendorBill.projectId))
            .where(
              and(
                eq(vendorBill.tenantId, INSTANCE_TENANT_ID),
                eq(project.tenantId, INSTANCE_TENANT_ID),
                actor.dataScope === "ASSIGNED"
                  ? eq(project.projectManagerId, actor.userId)
                  : undefined,
                input.projectId ? eq(project.id, input.projectId) : undefined,
                input.projectQuery ? ilike(project.name, `%${input.projectQuery}%`) : undefined,
                input.billQuery ? ilike(vendorBill.billNumber, `%${input.billQuery}%`) : undefined,
              ),
            )
            .orderBy(asc(vendorBill.billNumber), asc(vendorBill.id))
            .limit(21)
            .offset(input.offset);
          return {
            items: bills.slice(0, 20).map((b) => ({
              ...b,
              amount: Number(b.amount),
              status: formatBusinessLabel(b.status),
            })),
            hasMore: bills.length > 20,
            nextOffset: bills.length > 20 ? input.offset + 20 : null,
            needsDisambiguation: bills.length > 1,
            instruction:
              "Pilih tagihan tersimpan yang dimaksud lalu baca vendorBillId sebelum membuat koreksi. Jangan membuat tagihan baru sebagai pengganti koreksi.",
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    proposeVendorBillCorrection: tool({
      description:
        "Prepare immutable VENDOR_BILL_CORRECT review for an actual stored bill from getVendorBillCorrectionContext. Supply only changed billNumber/amount/dueDate/notes and a human reason>=10 characters. Omitted fields are preserved; null notes clears explicitly. No automatic dates/prices, no status/link/payment/stock patch. Preparation writes no business data; human explicit card/confirmation calls the shared transactional correction writer. Stale source requires a fresh preview, never bypass safeguards.",
      inputSchema: vendorBillCorrectionInputSchema,
      execute: async (input) => {
        try {
          return {
            proposal: await prepareProcurementWarehouseProposal(await current(context), input),
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
  };
}
