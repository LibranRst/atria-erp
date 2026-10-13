import { formatBusinessLabel } from "@atria/core/presentation/business-labels";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@backend/db";
import { INSTANCE_TENANT_ID, project, vendorBill } from "@backend/db/schema";
import type { AiToolContext } from "./context";
import {
  assertVendorWorkflowRights,
  readVendorPaymentContext,
  prepareVendorPaymentWorkflow,
} from "@backend/server/usecases/ai/vendor-payment-context";
import {
  vendorPaymentScheduleSchema,
  vendorPaymentDecisionSchema,
  vendorPaymentPaySchema,
} from "@atria/core/ai/vendor-payment-workflow";
const message = (error: unknown): string =>
  error instanceof Error && !error.message.startsWith("Failed query:")
    ? error.message
    : "Sumber pembayaran belum dapat diperiksa. Coba lagi.";
export function buildVendorPaymentWorkflowTools(actor: AiToolContext): ToolSet {
  return {
    getVendorPaymentContext: tool({
      description:
        "Read-only scoped vendor bill/payment context. Resolve projectQuery and billQuery using human names before using verified IDs. Ambiguous/one-character searches return choices, never invent IDs. Complete outstanding/committed amounts, scheduled payment IDs, pending approval status, maker-checker and permitted active bank accounts. offset pages20 bills. Scheduling, decision and payment are separate human-confirmed actions; no bank transfer is executed.",
      inputSchema: z
        .object({
          vendorBillId: z.string().guid().optional(),
          projectQuery: z.string().trim().min(1).max(120).optional(),
          billQuery: z.string().trim().min(1).max(120).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          assertVendorWorkflowRights(actor);
          if (!input.vendorBillId) {
            const projects = await db.query.project.findMany({
              where: and(
                eq(project.tenantId, INSTANCE_TENANT_ID),
                actor.dataScope === "ASSIGNED"
                  ? eq(project.projectManagerId, actor.userId)
                  : undefined,
                input.projectQuery ? ilike(project.name, `%${input.projectQuery}%`) : undefined,
              ),
              columns: { id: true, name: true },
            });
            if (input.projectQuery && (input.projectQuery.length === 1 || projects.length !== 1))
              return {
                projects: projects.slice(0, 20),
                hasMore: projects.length > 20,
                needsDisambiguation: true,
                instruction:
                  "Minta user memilih proyek atau nama lebih lengkap sebelum melanjutkan.",
              };
            const bills = await db.query.vendorBill.findMany({
              where: and(
                eq(vendorBill.tenantId, INSTANCE_TENANT_ID),
                inArray(
                  vendorBill.projectId,
                  projects.length
                    ? projects.map((p) => p.id)
                    : ["00000000-0000-0000-0000-000000000000"],
                ),
                input.billQuery ? ilike(vendorBill.billNumber, `%${input.billQuery}%`) : undefined,
              ),
              with: { vendor: true, project: true },
              orderBy: [asc(vendorBill.billNumber), asc(vendorBill.id)],
              limit: 21,
              offset: input.offset,
            });
            return {
              bills: bills.slice(0, 20).map((b) => ({
                id: b.id,
                billNumber: b.billNumber,
                vendor: b.vendor.name,
                project: b.project.name,
                amount: Number(b.amount),
                status: formatBusinessLabel(b.status),
              })),
              nextOffset: bills.length > 20 ? input.offset + 20 : null,
              instruction:
                "Gunakan vendorBillId terverifikasi yang dipilih user untuk membaca jadwal dan rincian. Jangan memilih tagihan ambigu sendiri.",
            };
          }
          const c = await readVendorPaymentContext(actor, input.vendorBillId);
          return {
            bill: {
              id: c.bill.id,
              billNumber: c.bill.billNumber,
              vendor: c.bill.vendor.name,
              project: c.bill.project.name,
              projectStatus: formatBusinessLabel(c.bill.project.status),
              status: formatBusinessLabel(c.bill.status),
              amount: Number(c.bill.amount),
              paid: Number(c.paid) / 100,
              committed: Number(c.committed) / 100,
              unscheduled:
                Number(BigInt(Math.round(Number(c.bill.amount) * 100)) - c.committed) / 100,
            },
            approvalThreshold: Number(c.threshold) / 100,
            payments: c.payments.slice(input.offset, input.offset + 20).map((p) => ({
              id: p.id,
              amount: Number(p.amountPaid),
              paymentDate: p.paymentDate.toISOString().slice(0, 10),
              status: formatBusinessLabel(p.status),
              bankAccountId: p.bankAccountId,
              requiresOwnerApproval: p.requiresOwnerApproval,
              approvalStatus: formatBusinessLabel(
                c.decisions.find((a) => a.referenceId === p.id)?.status,
              ),
              createdByCurrentUser: p.paidById === actor.userId,
            })),
            nextPaymentOffset: c.payments.length > input.offset + 20 ? input.offset + 20 : null,
            accounts: c.accounts.map((a) => ({
              id: a.id,
              name: a.name,
              bankName: a.bankName,
              balance: Number(a.balance),
            })),
            instruction:
              "Persetujuan oleh pembuat jadwal diblokir; emergency override tetap manual. Untuk PAY minta nomor referensi bank yang diberikan manusia, jangan buat otomatis. Approval tidak membayar, schedule tidak mengurangi kas.",
          };
        } catch (error: unknown) {
          return { error: message(error) };
        }
      },
    }),
    proposeVendorPaymentSchedule: tool({
      description:
        "Prepare read-only immutable schedule preview for ONE selected vendor bill, explicit amount/date/account. Amount cannot exceed unscheduled outstanding. Shows approval rule from current Settings and budget. Human save creates PENDING schedule and approval when required, with NO cash/stock change. Use getVendorPaymentContext first; do not combine approval or payment.",
      inputSchema: vendorPaymentScheduleSchema,
      execute: async (input) => {
        try {
          return { proposal: await prepareVendorPaymentWorkflow(actor, input) };
        } catch (error: unknown) {
          return { error: message(error) };
        }
      },
    }),
    proposeVendorPaymentDecision: tool({
      description:
        "Prepare explicit APPROVE or REJECT of ONE pending vendor payment approval, with human-provided reason. Current approve:cost and project access required. No self-approval via AI, no emergency override, no automatic payment or cash movement. Read latest getVendorPaymentContext first.",
      inputSchema: vendorPaymentDecisionSchema,
      execute: async (input) => {
        try {
          return { proposal: await prepareVendorPaymentWorkflow(actor, input) };
        } catch (error: unknown) {
          return { error: message(error) };
        }
      },
    }),
    proposeVendorBillPayment: tool({
      description:
        "Prepare payment RECORDING in Atria for ONE eligible scheduled vendor payment. Requires actual selected active bankAccountId and human-provided bank reference. Never invent reference or pay unapproved schedule. Shows complete balance/outstanding before-after; explicit protected user confirmation records existing ledger cash outflow, no bank transfer integration. No DB write from tool.",
      inputSchema: vendorPaymentPaySchema,
      execute: async (input) => {
        try {
          return { proposal: await prepareVendorPaymentWorkflow(actor, input) };
        } catch (error: unknown) {
          return { error: message(error) };
        }
      },
    }),
  };
}
