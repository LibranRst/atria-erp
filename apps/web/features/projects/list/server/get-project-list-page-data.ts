import "server-only";

import { db } from "@/db";
import type {
  ClientData,
  FinancialHealth,
  ProjectItem,
  ProjectStatus,
  UserData,
} from "@/features/projects/list/types/project-list-types";
import { scopeProjectQuery } from "@/lib/auth/scoping";
import { actorHasPermission } from "@atria/core/auth/permissions";
import { resolveEffectiveProjectHealth } from "@atria/core/project/effective-health";
import type { Actor } from "@/server/actor";

export type ProjectListReadyData = {
  readonly status: "ready";
  readonly projects: ProjectItem[];
  readonly clients: ClientData[];
  readonly users: UserData[];
  readonly isAllowedToCreate: boolean;
};

/**
 * Loader melaporkan status, bukan melakukan `redirect()`. `redirect()` adalah
 * control-flow throw milik Next dan tidak bisa menyeberang ke prosedur tRPC —
 * pemanggil web yang menerjemahkan `restricted` menjadi redirect.
 */
export type ProjectListPageData = ProjectListReadyData | { readonly status: "restricted" };

function toProjectStatus(status: string): ProjectStatus {
  if (
    status === "ACTIVE" ||
    status === "ON_HOLD" ||
    status === "COMPLETED" ||
    status === "CANCELLED"
  ) {
    return status;
  }
  return "DRAFT";
}

function toFinancialHealth(status: string): FinancialHealth {
  if (status === "WARNING" || status === "CRITICAL") {
    return status;
  }
  return "HEALTHY";
}

export async function getProjectListPageData(actor: Actor): Promise<ProjectListPageData> {
  const roleName = actor.roleName;
  if (!actorHasPermission(roleName, "view:budget")) {
    return { status: "restricted" };
  }

  // Scope proyek tetap ditegakkan server: PM hanya menerima proyek miliknya,
  // dan peran tanpa akses menerima filter yang mengembalikan nol baris.
  const projectFilter = scopeProjectQuery(actor.userId, roleName);

  const [projects, clients, users] = await Promise.all([
    db.query.project.findMany({
      where: projectFilter || undefined,
      with: {
        client: true,
        projectManager: true,
        canonicalBudgets: {
          with: {
            categories: {
              with: {
                expenseCategory: true,
              },
            },
          },
        },
      },
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    }),
    db.query.client.findMany({
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
    db.query.user.findMany({
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
  ]);

  return {
    status: "ready",
    projects: projects.map((projectRow) => {
      const contractValue = Number(projectRow.totalContractValue);
      const budget = projectRow.canonicalBudgets[0] ?? null;
      const categories = budget?.categories ?? [];
      const actualCost = categories.reduce(
        (total, category) => total + Number(category.actualAmount),
        0,
      );
      const internalBudget = Number(budget?.internalBudget ?? 0);
      const remainingBudget = internalBudget - actualCost;
      const usedPercentage = internalBudget > 0 ? (actualCost / internalBudget) * 100 : 0;
      const projectedMarginPercentage =
        contractValue > 0
          ? ((contractValue - Math.max(internalBudget, actualCost)) / contractValue) * 100
          : 0;
      const targetMarginPercentage =
        contractValue > 0 ? (Number(budget?.targetGrossAmount ?? 0) / contractValue) * 100 : 0;
      const health = resolveEffectiveProjectHealth({
        storedHealth: projectRow.financialHealth,
        remainingBudget,
        usedPercentage,
        categoryStatuses: categories.map((category) => category.status),
        projectedMarginPercentage,
        targetMarginPercentage,
      });

      return {
        id: projectRow.id,
        name: projectRow.name,
        clientId: projectRow.clientId,
        projectManagerId: projectRow.projectManagerId,
        status: toProjectStatus(projectRow.status),
        financialHealth: toFinancialHealth(projectRow.financialHealth),
        effectiveHealth: health.effectiveHealth,
        healthReasons: health.healthReasons,
        totalContractValue: contractValue,
        startDate: projectRow.startDate?.toISOString() ?? null,
        endDate: projectRow.endDate?.toISOString() ?? null,
        location: projectRow.location,
        roomArea: projectRow.roomArea,
        projectType: projectRow.projectType,
        coverImageUrl: projectRow.coverImageUrl,
        notes: projectRow.notes,
        budgetStatus: budget?.status ?? "TIDAK ADA",
        actualCost,
        internalBudget,
        usedPercentage,
        remainingBudget,
        clientName: projectRow.client?.name ?? "-",
        pmName: projectRow.projectManager?.name ?? "-",
      };
    }),
    clients: clients.map((client) => ({ id: client.id, name: client.name })),
    users: users.map((user) => ({ id: user.id, name: user.name })),
    isAllowedToCreate: roleName === "OWNER" || roleName === "FINANCE_ADMIN",
  };
}
