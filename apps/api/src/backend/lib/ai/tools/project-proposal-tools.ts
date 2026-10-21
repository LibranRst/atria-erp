import { db } from "@backend/db";
import { calculateTargetGross } from "@atria/core/budget/excel-budget";
import { readBudgetAllocationSnapshot } from "@backend/lib/budget/allocation-defaults";
import { projectBudgetDefaultsSchema } from "@atria/core/ai/project-budget-defaults";
import { client, project, projectBudget, user } from "@backend/db/schema";
import { tool } from "ai";
import { eq } from "drizzle-orm";
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
        "Prepare a proposal to create a new interior design & build project and its initial budget using active ERP Budget Settings. Ask only for project details; no cap or category-ratio input is needed. Returns a confirmation card with current budget defaults. Does NOT write to DB.",
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
        const budgetDefaults = projectBudgetDefaultsSchema.safeParse(
          await readBudgetAllocationSnapshot(db),
        );
        if (!budgetDefaults.success)
          return {
            error:
              "Pengaturan Budget aktif belum lengkap. Lengkapi Pengaturan ERP sebelum menyiapkan proyek; jangan mengisi plafon secara manual pada wizard.",
          };

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
            budgetDefaults: budgetDefaults.data,
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
            "Sampaikan ringkasan usulan proyek dan budget awal yang mengikuti Pengaturan ERP. Kartu konfirmasi sudah menampilkan plafon, margin dan alokasi. Setelah dikonfirmasi, proyek beserta budget awal dibuat bersama; jangan menawarkan pembuatan budget kedua. Jangan mengklaim plafon khusus yang tidak ada dalam usulan.",
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
          .optional()
          .describe(
            "Only provide a ratio explicitly requested by the user as an override. Omit to use active Budget Settings. Never assume a company/industry default.",
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

        const defaults = await readBudgetAllocationSnapshot(db);
        if (!defaults.settingId) {
          return {
            error:
              "Pengaturan Budget aktif belum lengkap. Lengkapi pengaturan sebelum menyiapkan alokasi.",
          };
        }
        const effectiveBudgetCapRatio = budgetCapRatio ?? defaults.budgetCapRatio;
        const internalBudgetAmount = Math.round(effectiveContractValue * effectiveBudgetCapRatio);
        const targetGross = calculateTargetGross(effectiveContractValue, internalBudgetAmount);
        const targetGrossAmount = targetGross.amount;
        const targetGrossPercentage = Math.round(targetGross.percentage * 10) / 10;

        const categoryAllocations = defaults.categories.map((cat) => {
          const ratio = cat.ratioPercentage;
          const allocated = Math.round(internalBudgetAmount * ratio);
          return {
            expenseCategoryId: cat.expenseCategoryId,
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
            budgetCapRatio: effectiveBudgetCapRatio,
            budgetCapPercentageLabel: `${Math.round(effectiveBudgetCapRatio * 100)}%`,
            internalBudget: money(String(internalBudgetAmount)),
            targetGrossAmount: money(String(targetGrossAmount)),
            targetGrossPercentage,
            categories: categoryAllocations,
          },
          source: {
            label: "Pengaturan Budget",
            href: "/settings/budget",
            settingId: defaults.settingId,
            capOverridden: budgetCapRatio !== undefined,
          },
          instruction:
            "Sampaikan ringkasan alokasi budget dan target margin proyek kepada pengguna. Kartu konfirmasi sudah ditampilkan otomatis.",
        };
      },
    }),
  };
}
