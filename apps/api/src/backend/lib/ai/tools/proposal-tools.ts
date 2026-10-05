import { db } from "@backend/db";
import {
  approval,
  expenseCategory,
  project,
  projectBudgetCategory,
  projectBudgets,
  projectCost,
  projectExpenses,
  user,
} from "@backend/db/schema";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
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

const MAX_DESCRIPTION = 500;

export function buildProposalTools(context: AiToolContext) {
  return {
    proposeExpenseDraft: tool({
      description:
        "Prepare a draft field expense for the user to review and confirm. This does NOT submit anything: it resolves the project and budget category, computes the total, remaining budget diff, and returns a proposal card. Only call this when the user clearly wants to record a new expense.",
      inputSchema: z.object({
        projectId: z.guid().describe("The project id, obtained from listProjects."),
        categoryCode: z
          .string()
          .min(1)
          .describe(
            "Expense category code from getExpenseCategories, for example MATERIAL or TUKANG.",
          ),
        description: z
          .string()
          .min(5)
          .max(MAX_DESCRIPTION)
          .describe("What the money was spent on, in Bahasa Indonesia."),
        quantity: z.number().positive().describe("Quantity. Use 1 when it is a single lump sum."),
        unitPrice: z
          .number()
          .nonnegative()
          .describe("Price per unit in rupiah, without separators."),
      }),
      execute: async ({ projectId, categoryCode, description, quantity, unitPrice }) => {
        if (!hasPermission(context, "create:cost")) {
          return permissionDenied("pembuatan pengajuan biaya");
        }
        if (!(await canAccessProject(context, projectId))) {
          return PROJECT_ACCESS_DENIED;
        }

        const amount = Math.round(quantity * unitPrice);
        if (amount <= 0) {
          return { error: "Nominal pengajuan harus lebih besar dari nol." };
        }

        const projectRow = await db.query.project.findFirst({
          where: eq(project.id, projectId),
          columns: { name: true },
        });
        if (!projectRow) {
          return PROJECT_ACCESS_DENIED;
        }

        const budget = await db.query.projectBudgets.findFirst({
          where: eq(projectBudgets.projectId, projectId),
          columns: { id: true },
        });
        if (!budget) {
          return { error: "Proyek ini belum memiliki budget, sehingga biaya belum bisa diajukan." };
        }

        const normalizedCode = categoryCode.trim().toUpperCase();
        const category = await db.query.expenseCategory.findFirst({
          where: eq(expenseCategory.code, normalizedCode),
          columns: { id: true, name: true, code: true },
        });
        if (!category) {
          return {
            error: `Kategori biaya "${categoryCode}" tidak dikenal. Panggil getExpenseCategories untuk daftar yang sah.`,
          };
        }

        const budgetCategoryRow = await db.query.projectBudgetCategory.findFirst({
          where: and(
            eq(projectBudgetCategory.projectBudgetId, budget.id),
            eq(projectBudgetCategory.expenseCategoryId, category.id),
          ),
          columns: { id: true, allocatedAmount: true, remainingAmount: true },
        });

        if (!budgetCategoryRow) {
          return {
            error: `Kategori ${category.name} belum dialokasikan pada budget proyek ini, sehingga biaya belum bisa diajukan ke kategori tersebut.`,
          };
        }

        const remaining = toNumber(budgetCategoryRow.remainingAmount);
        const remainingAfter = remaining - amount;
        const exceedsRemaining = amount > remaining;

        return {
          proposal: {
            kind: "FIELD_EXPENSE" as const,
            projectId,
            projectName: projectRow.name,
            projectBudgetCategoryId: budgetCategoryRow.id,
            categoryCode: category.code,
            categoryName: category.name,
            description: description.trim(),
            quantity,
            unitPrice: money(String(unitPrice)),
            amount: money(String(amount)),
            remainingBeforeSubmit: money(budgetCategoryRow.remainingAmount),
            remainingAfterSubmit: money(String(remainingAfter)),
            exceedsRemaining,
          },
          instruction:
            "Sampaikan ringkasan usulan ini kepada pengguna dalam satu kalimat singkat. Kartu konfirmasi sudah ditampilkan otomatis, jadi jangan menuliskan ulang seluruh rinciannya dan jangan mengaku sudah mengirim apa pun. Pengajuan baru terkirim setelah pengguna menekan tombol konfirmasi.",
        };
      },
    }),

    proposeExpenseReview: tool({
      description:
        "Prepare a proposal to VERIFY, APPROVE, or REJECT a pending field expense claim. Use action 'VERIFY' to verify a submitted claim, 'APPROVE' to approve (or verify & approve) a claim, or 'REJECT' to reject it. Only available to Owner / Finance Admin. Does NOT execute decision until user clicks confirm.",
      inputSchema: z.object({
        expenseId: z
          .guid()
          .describe(
            "The expense ID obtained from getPendingExpenseApprovals or getPendingApprovals.",
          ),
        action: z
          .enum(["VERIFY", "APPROVE", "REJECT"])
          .default("APPROVE")
          .describe(
            "Action to take: VERIFY (verifikasi pengajuan SUBMITTED), APPROVE (setujui), or REJECT (tolak).",
          ),
        notes: z
          .string()
          .optional()
          .describe("Notes or reason for verification / approval / rejection."),
      }),
      execute: async ({ expenseId, action, notes }) => {
        if (!hasPermission(context, "approve:cost") || !hasGlobalScope(context)) {
          return permissionDenied("persetujuan pengeluaran");
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

        // 1. Coba cari di projectCost langsung
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
          // 2. Coba cari di projectExpenses
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
            // 3. Coba cari di approval record
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
          return { error: "Pengajuan pengeluaran tidak ditemukan." };
        }

        if (costRow.status !== "SUBMITTED" && costRow.status !== "VERIFIED") {
          return {
            error: `Pengeluaran ini tidak dalam status menunggu verifikasi atau persetujuan (status saat ini: ${costRow.status}).`,
          };
        }

        const projectRow = await db.query.project.findFirst({
          where: eq(project.id, costRow.projectId),
          columns: { name: true },
        });

        const requester = await db.query.user.findFirst({
          where: eq(user.id, costRow.requestedById),
          columns: { name: true },
        });

        const actionLabel =
          action === "VERIFY"
            ? "Verifikasi Pengajuan"
            : action === "APPROVE"
              ? "Setujui Pengajuan"
              : "Tolak Pengajuan";

        const defaultNotes =
          action === "VERIFY"
            ? "Diverifikasi via AI Assistant"
            : action === "APPROVE"
              ? "Disetujui via AI Assistant"
              : "Ditolak via AI Assistant";

        return {
          proposal: {
            kind: "EXPENSE_REVIEW" as const,
            expenseId: costRow.id,
            action,
            actionLabel,
            description: costRow.description,
            amount: money(costRow.amount),
            projectName: projectRow?.name ?? "Proyek",
            requesterName: requester?.name ?? "PM",
            notes: notes ?? defaultNotes,
          },
          instruction: `Sampaikan ringkasan usulan ${actionLabel.toLowerCase()} biaya kepada pengguna. Kartu konfirmasi sudah ditampilkan otomatis.`,
        };
      },
    }),
  };
}
