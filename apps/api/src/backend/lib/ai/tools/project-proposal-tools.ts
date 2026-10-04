import { db } from "@backend/db";
import { client, expenseCategory, project, projectBudget, user } from "@backend/db/schema";
import { tool } from "ai";
import { asc, eq } from "drizzle-orm";
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

export function buildProjectProposalTools(context: AiToolContext) {
  return {
    proposeCreateProject: tool({
      description:
        "Prepare a proposal to create a new interior design & build project. Resolves client, PM, and contract value, and returns an interactive confirmation card with projected scope. Does NOT write to DB.",
      inputSchema: z.object({
        name: z
          .string()
          .min(3)
          .max(200)
          .describe("Project name, for example 'Renovasi Sudirman Suites 12B'."),
        clientId: z.guid().optional().describe("Existing client ID if known, from listClients."),
        newClientName: z
          .string()
          .min(2)
          .optional()
          .describe("New client name if client not yet registered."),
        newClientPhone: z.string().min(6).optional().describe("New client phone number."),
        projectManagerId: z
          .guid()
          .optional()
          .describe(
            "Assigned PM user ID. Omit to assign to the current user or first available PM.",
          ),
        totalContractValue: z
          .number()
          .positive()
          .describe("Total contract value (nilai kontrak) in rupiah."),
        startDate: z.string().optional().describe("Project target start date (YYYY-MM-DD)."),
        endDate: z.string().optional().describe("Project target completion date (YYYY-MM-DD)."),
        location: z.string().optional().describe("Project location / address."),
        notes: z.string().optional().describe("Special notes or client requirements."),
      }),
      execute: async ({
        name,
        clientId,
        newClientName,
        newClientPhone,
        projectManagerId,
        totalContractValue,
        startDate,
        endDate,
        location,
        notes,
      }) => {
        if (!hasPermission(context, "create:budget") || !hasGlobalScope(context)) {
          return permissionDenied("pembuatan proyek baru");
        }

        let resolvedClientName = newClientName ?? "Klien Baru";
        let resolvedClientId = clientId;

        if (clientId) {
          const clientRow = await db.query.client.findFirst({
            where: eq(client.id, clientId),
            columns: { id: true, name: true },
          });
          if (clientRow) {
            resolvedClientName = clientRow.name;
            resolvedClientId = clientRow.id;
          }
        }

        let pmId = projectManagerId ?? context.userId;
        let pmName = "Project Manager";

        const pmUser = await db.query.user.findFirst({
          where: eq(user.id, pmId),
          columns: { id: true, name: true },
        });

        if (pmUser) {
          pmName = pmUser.name;
        } else {
          const defaultPm = await db.query.user.findFirst({
            where: eq(user.isActive, true),
            columns: { id: true, name: true },
          });
          if (defaultPm) {
            pmId = defaultPm.id;
            pmName = defaultPm.name;
          }
        }

        return {
          proposal: {
            kind: "CREATE_PROJECT" as const,
            name: name.trim(),
            clientId: resolvedClientId ?? "",
            clientName: resolvedClientName,
            newClientName: newClientName ?? "",
            newClientPhone: newClientPhone ?? "",
            projectManagerId: pmId,
            projectManagerName: pmName,
            totalContractValue: money(String(totalContractValue)),
            startDate: startDate ?? null,
            endDate: endDate ?? null,
            location: location ?? "-",
            notes: notes ?? "",
          },
          instruction:
            "Sampaikan ringkasan usulan pembuatan proyek ini kepada pengguna. Kartu konfirmasi sudah ditampilkan otomatis.",
        };
      },
    }),

    proposeSetupProjectBudget: tool({
      description:
        "Prepare a proposal to set up internal project budget and category allocations (Material, Tukang, Operasional, Lain-lain, Subcon) with target gross margin calculations. Does NOT write to DB.",
      inputSchema: z.object({
        projectId: z.guid().describe("The project id, obtained from listProjects."),
        contractValue: z
          .number()
          .positive()
          .optional()
          .describe("Contract value if overriding project default."),
        budgetCapRatio: z
          .number()
          .positive()
          .max(1)
          .default(0.85)
          .describe(
            "Budget cap ratio (e.g. 0.85 for 85% internal budget cap / 15% target margin).",
          ),
      }),
      execute: async ({ projectId, contractValue, budgetCapRatio }) => {
        if (!hasPermission(context, "create:budget")) {
          return permissionDenied("penyusunan anggaran proyek");
        }
        if (!(await canAccessProject(context, projectId))) {
          return PROJECT_ACCESS_DENIED;
        }

        const projectRow = await db.query.project.findFirst({
          where: eq(project.id, projectId),
          columns: { id: true, name: true, totalContractValue: true },
        });
        if (!projectRow) return PROJECT_ACCESS_DENIED;

        const effectiveContractValue = contractValue ?? toNumber(projectRow.totalContractValue);
        if (effectiveContractValue <= 0) {
          return {
            error:
              "Nilai kontrak proyek belum ditentukan atau nol. Harap tentukan nilai kontrak terlebih dahulu.",
          };
        }

        const existingBudget = await db.query.projectBudget.findFirst({
          where: eq(projectBudget.projectId, projectId),
          columns: { id: true, status: true },
        });

        const activeCategories = await db.query.expenseCategory.findMany({
          where: eq(expenseCategory.isActive, true),
          columns: { id: true, code: true, name: true, sortOrder: true },
          orderBy: [asc(expenseCategory.sortOrder)],
        });

        if (activeCategories.length === 0) {
          return { error: "Kategori pengeluaran belum dikonfigurasi di Settings." };
        }

        // Distribusi rasio default standar interior:
        // MATERIAL: 45%, TUKANG: 25%, OPERASIONAL: 10%, SUBCON: 10%, LAIN_LAIN: 10%
        const defaultRatios: Record<string, number> = {
          MATERIAL: 0.45,
          TUKANG: 0.25,
          OPERASIONAL: 0.1,
          SUBCON: 0.1,
          LAIN_LAIN: 0.1,
        };

        const internalBudgetAmount = Math.round(effectiveContractValue * budgetCapRatio);
        const targetGrossAmount = effectiveContractValue - internalBudgetAmount;
        const targetGrossPercentage =
          Math.round((targetGrossAmount / effectiveContractValue) * 1000) / 10;

        const categoryAllocations = activeCategories.map((cat) => {
          const ratio = defaultRatios[cat.code] ?? 1 / activeCategories.length;
          const allocated = Math.round(internalBudgetAmount * ratio);
          return {
            expenseCategoryId: cat.id,
            categoryCode: cat.code,
            categoryName: cat.name,
            ratioPercentage: ratio,
            ratioPercentageLabel: `${Math.round(ratio * 100)}%`,
            allocated: money(String(allocated)),
            sortOrder: cat.sortOrder,
          };
        });

        return {
          proposal: {
            kind: "SETUP_BUDGET" as const,
            projectId,
            projectName: projectRow.name,
            alreadyHasBudget: Boolean(existingBudget),
            contractValue: money(String(effectiveContractValue)),
            budgetCapRatio,
            budgetCapPercentageLabel: `${Math.round(budgetCapRatio * 100)}%`,
            internalBudget: money(String(internalBudgetAmount)),
            targetGrossAmount: money(String(targetGrossAmount)),
            targetGrossPercentage,
            categories: categoryAllocations,
          },
          instruction:
            "Sampaikan ringkasan alokasi budget dan target margin proyek kepada pengguna. Kartu konfirmasi sudah ditampilkan otomatis.",
        };
      },
    }),
  };
}
