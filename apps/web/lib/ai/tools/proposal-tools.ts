import "server-only";

import { db } from "@/db";
import { expenseCategory, project, projectBudgetCategory, projectBudgets } from "@/db/schema";
import { tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  canAccessProject,
  hasPermission,
  permissionDenied,
  PROJECT_ACCESS_DENIED,
  type AiToolContext,
} from "./context";
import { money } from "./shared";

/**
 * Tool usulan pengajuan biaya lapangan.
 *
 * PENTING: tool ini TIDAK MENULIS APA PUN. Ia hanya menerjemahkan maksud pengguna
 * menjadi usulan yang sudah lengkap dan terverifikasi — proyek nyata, kategori
 * budget nyata, nominal terhitung — lalu mengembalikannya sebagai data.
 *
 * Antarmuka merender hasilnya sebagai kartu usulan. Penulisan baru terjadi ketika
 * manusia menekan tombol konfirmasi, yang memanggil Server Action `submitFieldRequest`
 * dengan validasi Zod dan RBAC-nya sendiri. Tidak ada jalur auto-submit.
 */

const MAX_DESCRIPTION = 500;

export function buildProposalTools(context: AiToolContext) {
  return {
    proposeExpenseDraft: tool({
      description:
        "Prepare a draft field expense for the user to review and confirm. This does NOT submit anything: it resolves the project and budget category, computes the total, and returns a proposal card. Only call this when the user clearly wants to record a new expense.",
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

        // Kategori budget harus milik budget proyek ini; mencocokkan hanya lewat
        // expenseCategoryId bisa mengambil baris milik proyek lain.
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

        const remaining = Number(budgetCategoryRow.remainingAmount);
        const exceedsRemaining = Number.isFinite(remaining) && amount > remaining;

        return {
          proposal: {
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
            exceedsRemaining,
          },
          instruction:
            "Sampaikan ringkasan usulan ini kepada pengguna dalam satu kalimat singkat. Kartu konfirmasi sudah ditampilkan otomatis, jadi jangan menuliskan ulang seluruh rinciannya dan jangan mengaku sudah mengirim apa pun. Pengajuan baru terkirim setelah pengguna menekan tombol konfirmasi.",
        };
      },
    }),
  };
}
