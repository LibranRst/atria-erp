import { db } from "@backend/db";
import {
  approval,
  bankAccount,
  client,
  clientInvoice,
  clientPayment,
  project,
  projectCost,
  projectExpenses,
  user,
  INSTANCE_TENANT_ID,
} from "@backend/db/schema";
import { tool } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  canAccessProject,
  hasGlobalScope,
  hasPermission,
  permissionDenied,
  PROJECT_ACCESS_DENIED,
  type AiToolContext,
} from "./context";
import { money, toNumber } from "./shared";

export { reconciliationInputSchema as bankReconciliationInputSchema } from "@atria/core/ai/bank-reconciliation";

export function buildFinanceProposalTools(context: AiToolContext) {
  return {
    proposeDisburseExpense: tool({
      description:
        "Prepare a proposal to pay / disburse cash reimbursement for an approved field expense claim from a chosen company bank account. Computes before/after bank balances diff. Only available to Owner / Finance Admin.",
      inputSchema: z.object({
        expenseId: z
          .guid()
          .describe(
            "The actual field expense ID from getPendingExpenseApprovals, or projectCostId from getRecentExpenses. A canonical expense id is a read identity; do not use inventory purchases or noncash stock usage as a field reimbursement target.",
          ),
        bankAccountId: z
          .guid()
          .optional()
          .describe(
            "Bank account ID to disburse cash from. Omit to use primary active company bank account.",
          ),
        referenceNumber: z
          .string()
          .min(2)
          .optional()
          .describe("Transfer reference number (e.g. 'TRF-PM-1234'). Auto-generated if omitted."),
      }),
      execute: async ({ expenseId, bankAccountId, referenceNumber }) => {
        if (!hasPermission(context, "pay:cost") && !hasPermission(context, "update:cost")) {
          return permissionDenied("pencairan dana pengeluaran lapangan");
        }
        if (!hasGlobalScope(context)) {
          return permissionDenied("pencairan kas lintas proyek");
        }

        // Cari row cost baik lewat projectCost.id, projectExpenses.id, atau approval
        let costRow: {
          id: string;
          projectId: string;
          requestedById: string;
          description: string;
          amount: string;
          status: string;
        } | null = null;

        const pc = await db.query.projectCost.findFirst({
          where: eq(projectCost.id, expenseId),
        });
        if (pc) {
          costRow = {
            id: pc.id,
            projectId: pc.projectId,
            requestedById: pc.requestedById,
            description: pc.description,
            amount: pc.amount,
            status: pc.status,
          };
        } else {
          const pe = await db.query.projectExpenses.findFirst({
            where: eq(projectExpenses.id, expenseId),
          });
          if (pe) {
            costRow = {
              id: pe.legacyProjectCostId || pe.id,
              projectId: pe.projectId,
              requestedById: pe.requestedById,
              description: pe.description,
              amount: pe.amount,
              status: pe.status,
            };
          } else {
            const app = await db.query.approval.findFirst({
              where: eq(approval.id, expenseId),
            });
            if (app && app.referenceType === "project_cost") {
              const pcFromApp = await db.query.projectCost.findFirst({
                where: eq(projectCost.id, app.referenceId),
              });
              if (pcFromApp) {
                costRow = {
                  id: pcFromApp.id,
                  projectId: pcFromApp.projectId,
                  requestedById: pcFromApp.requestedById,
                  description: pcFromApp.description,
                  amount: pcFromApp.amount,
                  status: pcFromApp.status,
                };
              }
            }
          }
        }

        if (!costRow) {
          return { error: "Pengajuan pengeluaran lapangan tidak ditemukan." };
        }

        if (costRow.status === "PAID") {
          return { error: "Pengeluaran ini sudah dicairkan / lunas sebelumnya." };
        }

        if (costRow.status === "REJECTED") {
          return { error: "Pengeluaran ini berstatus ditolak, tidak dapat dicairkan." };
        }

        const projectRow = await db.query.project.findFirst({
          where: eq(project.id, costRow.projectId),
          columns: { name: true },
        });

        const requester = await db.query.user.findFirst({
          where: eq(user.id, costRow.requestedById),
          columns: { name: true },
        });

        let account = bankAccountId
          ? await db.query.bankAccount.findFirst({
              where: and(
                eq(bankAccount.id, bankAccountId),
                eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
                eq(bankAccount.isActive, true),
              ),
            })
          : null;

        if (bankAccountId && !account)
          return { error: "Rekening bank tidak ditemukan atau tidak tersedia." };

        if (!account) {
          account = await db.query.bankAccount.findFirst({
            where: and(
              eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
              eq(bankAccount.isActive, true),
            ),
            orderBy: [asc(bankAccount.name)],
          });
        }

        if (!account) {
          return { error: "Tidak ada akun bank aktif yang dapat digunakan untuk pencairan kas." };
        }

        const currentBankBalance = toNumber(account.balance);
        const amountToPay = toNumber(costRow.amount);
        const projectedBankBalance = currentBankBalance - amountToPay;
        const insufficientFunds = projectedBankBalance < 0;

        const effectiveRef = referenceNumber ?? `TRF-EXP-${Date.now().toString().slice(-6)}`;

        return {
          proposal: {
            kind: "DISBURSE_EXPENSE" as const,
            expenseId: costRow.id,
            description: costRow.description,
            projectName: projectRow?.name ?? "Proyek",
            requesterName: requester?.name ?? "Pelaksana Lapangan",
            amount: money(costRow.amount),
            bankAccountId: account.id,
            bankAccountName: `${account.bankName} - ${account.name}`,
            bankBalanceBefore: money(account.balance),
            bankBalanceAfter: money(String(projectedBankBalance)),
            insufficientFunds,
            referenceNumber: effectiveRef,
          },
          instruction:
            "Sampaikan ringkasan usulan pencairan dana biaya lapangan kepada pengguna. Kartu konfirmasi sudah ditampilkan otomatis.",
        };
      },
    }),

    proposeRecordClientPayment: tool({
      description:
        "Prepare a proposal to record a client payment for an invoice into a specific bank account. Computes before/after bank balances and remaining invoice receivable diff. Does NOT write to DB.",
      inputSchema: z.object({
        clientInvoiceId: z
          .guid()
          .describe("The clientInvoiceId obtained from getUnpaidClientInvoices."),
        bankAccountId: z
          .guid()
          .optional()
          .describe(
            "Bank account ID receiving the payment. Omit to use primary receiving account.",
          ),
        amountPaid: z
          .number()
          .positive()
          .optional()
          .describe("Amount paid in rupiah. Omit to pay full remaining invoice amount."),
        referenceNumber: z
          .string()
          .min(2)
          .optional()
          .describe("Bank deposit reference/mutation number. Auto-generated if omitted."),
      }),
      execute: async ({ clientInvoiceId, bankAccountId, amountPaid, referenceNumber }) => {
        if (
          !hasPermission(context, "reconcile:client_invoice") &&
          !hasPermission(context, "reconcile:ledger")
        ) {
          return permissionDenied("pencatatan pembayaran klien");
        }

        const invoice = await db.query.clientInvoice.findFirst({
          where: eq(clientInvoice.id, clientInvoiceId),
        });

        if (!invoice) {
          return { error: "Invoice klien tidak ditemukan." };
        }

        if (!(await canAccessProject(context, invoice.projectId))) {
          return PROJECT_ACCESS_DENIED;
        }

        const projectRow = await db.query.project.findFirst({
          where: eq(project.id, invoice.projectId),
          columns: { name: true, clientId: true },
        });

        const clientRow = projectRow?.clientId
          ? await db.query.client.findFirst({
              where: eq(client.id, projectRow.clientId),
              columns: { name: true },
            })
          : null;

        const previousPayments = await db
          .select({ amount: clientPayment.amountPaid })
          .from(clientPayment)
          .where(eq(clientPayment.clientInvoiceId, clientInvoiceId));

        const paidBefore = previousPayments.reduce((sum, p) => sum + toNumber(p.amount), 0);
        const invoiceTotal = toNumber(invoice.amount);
        const outstanding = Math.max(0, invoiceTotal - paidBefore);

        const effectiveAmount = amountPaid ?? outstanding;
        if (effectiveAmount <= 0) {
          return { error: "Invoice ini sudah lunas atau nominal pembayaran tidak valid." };
        }

        let account = bankAccountId
          ? await db.query.bankAccount.findFirst({
              where: and(
                eq(bankAccount.id, bankAccountId),
                eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
                eq(bankAccount.isActive, true),
              ),
            })
          : null;

        if (bankAccountId && !account)
          return { error: "Rekening bank tidak ditemukan atau tidak tersedia." };

        if (!account) {
          account = await db.query.bankAccount.findFirst({
            where: and(
              eq(bankAccount.tenantId, INSTANCE_TENANT_ID),
              eq(bankAccount.isActive, true),
            ),
            orderBy: [asc(bankAccount.name)],
          });
        }

        if (!account) {
          return { error: "Tidak ada akun bank aktif yang dapat digunakan untuk penerimaan kas." };
        }

        const currentBankBalance = toNumber(account.balance);
        const projectedBankBalance = currentBankBalance + effectiveAmount;
        const newOutstanding = Math.max(0, outstanding - effectiveAmount);
        const willBePaid = newOutstanding === 0;

        const effectiveRef = referenceNumber ?? `DEP-${Date.now().toString().slice(-6)}`;
        const today = new Date().toISOString().slice(0, 10);

        return {
          proposal: {
            kind: "RECORD_CLIENT_PAYMENT" as const,
            clientInvoiceId,
            invoiceNumber: invoice.invoiceNumber,
            projectName: projectRow?.name ?? "Proyek",
            clientName: clientRow?.name ?? "Klien",
            amountPaid: money(String(effectiveAmount)),
            paymentDate: today,
            bankAccountId: account.id,
            bankAccountName: `${account.bankName} - ${account.name}`,
            bankBalanceBefore: money(account.balance),
            bankBalanceAfter: money(String(projectedBankBalance)),
            invoiceOutstandingBefore: money(String(outstanding)),
            invoiceOutstandingAfter: money(String(newOutstanding)),
            willBePaid,
            referenceNumber: effectiveRef,
          },
          instruction:
            "Sampaikan ringkasan usulan pencatatan pembayaran termin klien kepada pengguna. Kartu konfirmasi sudah ditampilkan otomatis.",
        };
      },
    }),
  };
}
