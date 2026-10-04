import { db } from "@backend/db";
import {
  approval,
  bankAccount,
  cashTransaction,
  client,
  clientInvoice,
  clientPayment,
  project,
  projectCost,
  projectExpenses,
  user,
  vendor,
  vendorBill,
  vendorPayment,
} from "@backend/db/schema";
import { tool } from "ai";
import { and, asc, desc, eq } from "drizzle-orm";
import { normalizeCashDirection } from "@atria/core/finance/cash-direction";
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

export const bankReconciliationInputSchema = z.object({
  bankAccountId: z
    .guid()
    .optional()
    .describe("ID of the bank account. If omitted, uses the first active bank account."),
  mutations: z
    .array(
      z.object({
        transactionDate: z.string().describe("ISO transaction date string (YYYY-MM-DD)"),
        description: z.string().min(1).describe("Description / narrative of the mutation"),
        amount: z.number().positive().describe("Positive transaction amount"),
        type: z
          .enum(["INFLOW", "OUTFLOW"])
          .describe("Mutation direction: INFLOW for credit/money in, OUTFLOW for debit/money out"),
      }),
    )
    .min(1)
    .describe("List of parsed bank mutations to reconcile"),
});

export function buildFinanceProposalTools(context: AiToolContext) {
  return {
    proposeVendorBillPayment: tool({
      description:
        "Prepare a proposal to pay a scheduled vendor bill from a specified bank account. Computes before/after bank balances and vendor bill status diff. Does NOT write to DB.",
      inputSchema: z.object({
        vendorPaymentId: z
          .guid()
          .describe("The vendorPaymentId obtained from getUnpaidVendorBills."),
        bankAccountId: z
          .guid()
          .optional()
          .describe(
            "Bank account ID to disburse payment from. Omit to use the bill's assigned account or primary account.",
          ),
        referenceNumber: z
          .string()
          .min(2)
          .optional()
          .describe(
            "Payment reference/mutation number (e.g. 'TRF-BCA-00123'). Auto-generated if omitted.",
          ),
      }),
      execute: async ({ vendorPaymentId, bankAccountId, referenceNumber }) => {
        if (!hasPermission(context, "pay:vendor_bill")) {
          return permissionDenied("pembayaran tagihan vendor");
        }

        const paymentRow = await db.query.vendorPayment.findFirst({
          where: eq(vendorPayment.id, vendorPaymentId),
        });

        if (!paymentRow) {
          return { error: "Jadwal pembayaran tagihan vendor tidak ditemukan." };
        }

        const bill = await db.query.vendorBill.findFirst({
          where: eq(vendorBill.id, paymentRow.vendorBillId),
        });

        if (!bill) {
          return { error: "Tagihan vendor tidak ditemukan." };
        }

        if (!(await canAccessProject(context, bill.projectId))) {
          return PROJECT_ACCESS_DENIED;
        }

        const vendorRow = await db.query.vendor.findFirst({
          where: eq(vendor.id, bill.vendorId),
          columns: { name: true },
        });

        const projectRow = await db.query.project.findFirst({
          where: eq(project.id, bill.projectId),
          columns: { name: true },
        });

        const targetBankId = bankAccountId || paymentRow.bankAccountId;
        let account = targetBankId
          ? await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, targetBankId) })
          : null;

        if (!account) {
          account = await db.query.bankAccount.findFirst({
            where: eq(bankAccount.isActive, true),
            orderBy: [asc(bankAccount.name)],
          });
        }

        if (!account) {
          return { error: "Tidak ada akun bank aktif yang dapat digunakan untuk pembayaran." };
        }

        const currentBankBalance = toNumber(account.balance);
        const amountToPay = toNumber(paymentRow.amountPaid);
        const projectedBankBalance = currentBankBalance - amountToPay;
        const insufficientFunds = projectedBankBalance < 0;

        const effectiveRef =
          referenceNumber ?? paymentRow.referenceNumber ?? `TRF-${Date.now().toString().slice(-6)}`;

        return {
          proposal: {
            kind: "PAY_VENDOR_BILL" as const,
            vendorPaymentId,
            vendorBillId: bill.id,
            billNumber: bill.billNumber,
            vendorName: vendorRow?.name ?? "Vendor",
            projectName: projectRow?.name ?? "Proyek",
            amountPaid: money(paymentRow.amountPaid),
            bankAccountId: account.id,
            bankAccountName: `${account.bankName} - ${account.name}`,
            bankBalanceBefore: money(account.balance),
            bankBalanceAfter: money(String(projectedBankBalance)),
            insufficientFunds,
            referenceNumber: effectiveRef,
            billTotalAmount: money(bill.amount),
            budgetCategoryRemaining: null,
          },
          instruction:
            "Sampaikan ringkasan usulan pembayaran tagihan vendor kepada pengguna. Kartu konfirmasi sudah ditampilkan otomatis.",
        };
      },
    }),

    proposeDisburseExpense: tool({
      description:
        "Prepare a proposal to pay / disburse cash reimbursement for an approved field expense claim from a chosen company bank account. Computes before/after bank balances diff. Only available to Owner / Finance Admin.",
      inputSchema: z.object({
        expenseId: z
          .guid()
          .describe(
            "The expense ID obtained from getPendingExpenseApprovals or getRecentExpenses.",
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
          ? await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, bankAccountId) })
          : null;

        if (!account) {
          account = await db.query.bankAccount.findFirst({
            where: eq(bankAccount.isActive, true),
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
          ? await db.query.bankAccount.findFirst({ where: eq(bankAccount.id, bankAccountId) })
          : null;

        if (!account) {
          account = await db.query.bankAccount.findFirst({
            where: eq(bankAccount.isActive, true),
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
    proposeBankReconciliation: tool({
      description:
        "Prepare an AI bank reconciliation proposal comparing parsed bank statement mutations against unreconciled cash transactions. Finds 100% matched pairs and highlights unmatched statement rows. Does NOT write to DB.",
      inputSchema: bankReconciliationInputSchema,
      execute: async ({ bankAccountId, mutations }) => {
        if (!hasPermission(context, "reconcile:ledger")) {
          return permissionDenied("rekonsiliasi bank");
        }

        const activeAccounts = await db.query.bankAccount.findMany({
          where: eq(bankAccount.isActive, true),
          orderBy: [asc(bankAccount.name)],
        });

        if (activeAccounts.length === 0) {
          return { error: "Tidak ada akun bank aktif yang dapat direkonsiliasi." };
        }

        let selectedAccount = bankAccountId
          ? activeAccounts.find((a) => a.id === bankAccountId)
          : activeAccounts[0];

        if (!selectedAccount) {
          selectedAccount = activeAccounts[0];
        }

        const unreconciledTx = await db.query.cashTransaction.findMany({
          where: and(
            eq(cashTransaction.bankAccountId, selectedAccount.id),
            eq(cashTransaction.reconciled, false),
          ),
          orderBy: [desc(cashTransaction.createdAt)],
          limit: 300,
        });

        const usedTxIds = new Set<string>();
        type ProposalMatch = {
          readonly cashTransactionId: string;
          readonly cashTransactionDescription: string;
          readonly cashTransactionDate: string;
          readonly statementRow: {
            readonly transactionDate: string;
            readonly description: string;
            readonly amount: number;
            readonly type: "INFLOW" | "OUTFLOW";
          };
          readonly matchedAmount: { readonly amount: number; readonly formatted: string };
        };

        type ProposalUnmatched = {
          readonly transactionDate: string;
          readonly description: string;
          readonly amount: number;
          readonly type: "INFLOW" | "OUTFLOW";
          readonly formattedAmount: { readonly amount: number; readonly formatted: string };
        };

        const matches: ProposalMatch[] = [];
        const unmatchedMutations: ProposalUnmatched[] = [];

        for (const mut of mutations) {
          const mutCents = Math.round(mut.amount * 100);
          const mutDir = normalizeCashDirection(mut.type);
          const mutDesc = mut.description.toLowerCase();
          const mutDate = new Date(mut.transactionDate);
          const mutTokens = mutDesc.split(/\s+/).filter((w) => w.length >= 3);

          const candidateMatches = unreconciledTx.filter((tx) => {
            if (usedTxIds.has(tx.id)) return false;
            const txCents = Math.round(Number(tx.amount) * 100);
            const txDir = normalizeCashDirection(tx.type);
            return txDir === mutDir && txCents === mutCents;
          });

          let matchedTx: (typeof unreconciledTx)[number] | null = null;

          if (candidateMatches.length === 1) {
            matchedTx = candidateMatches[0]!;
          } else if (candidateMatches.length > 1) {
            // Beri bobot skor berdasarkan nomor referensi, kecocokan kata deskripsi, dan kedekatan tanggal
            let bestScore = -1;
            let bestCandidate: (typeof unreconciledTx)[number] | null = null;

            for (const candidate of candidateMatches) {
              let score = 0;
              const ref = candidate.bankReference?.trim().toLowerCase();
              if (ref && mutDesc.includes(ref)) {
                score += 100;
              }

              const txDesc = candidate.description.toLowerCase();
              for (const token of mutTokens) {
                if (txDesc.includes(token)) {
                  score += 15;
                }
              }

              if (!Number.isNaN(mutDate.getTime())) {
                const dayDiff =
                  Math.abs(candidate.createdAt.getTime() - mutDate.getTime()) / 86400000;
                if (dayDiff <= 1) {
                  score += 50;
                } else if (dayDiff <= 3) {
                  score += 30;
                } else if (dayDiff <= 7) {
                  score += 15;
                }
              }

              if (score > bestScore) {
                bestScore = score;
                bestCandidate = candidate;
              }
            }

            matchedTx = bestCandidate ?? candidateMatches[0]!;
          }

          if (matchedTx) {
            usedTxIds.add(matchedTx.id);
            matches.push({
              cashTransactionId: matchedTx.id,
              cashTransactionDescription: matchedTx.description,
              cashTransactionDate: matchedTx.createdAt.toISOString().slice(0, 10),
              statementRow: {
                transactionDate: mut.transactionDate,
                description: mut.description,
                amount: mut.amount,
                type: mut.type,
              },
              matchedAmount: money(matchedTx.amount),
            });
          } else {
            unmatchedMutations.push({
              transactionDate: mut.transactionDate,
              description: mut.description,
              amount: mut.amount,
              type: mut.type,
              formattedAmount: money(String(mut.amount)),
            });
          }
        }

        const availableAccounts = activeAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          bankName: a.bankName,
          accountNumber: a.accountNumber,
        }));

        return {
          proposal: {
            kind: "BANK_RECONCILIATION" as const,
            bankAccountId: selectedAccount.id,
            bankAccountName: `${selectedAccount.bankName} - ${selectedAccount.name}`,
            accountNumber: selectedAccount.accountNumber,
            totalMutations: mutations.length,
            matchedCount: matches.length,
            unmatchedCount: unmatchedMutations.length,
            matches,
            unmatchedMutations,
            availableBankAccounts: availableAccounts,
          },
          instruction:
            "Sampaikan ringkasan hasil analisis mutasi bank kepada pengguna (jumlah mutasi yang cocok dan yang belum tercatat). Kartu usulan interaktif sudah ditampilkan agar pengguna dapat memverifikasi dan mengonfirmasi rekonsiliasi.",
        };
      },
    }),
  };
}
