import { actorCan } from "@backend/lib/auth/permissions";
import { db } from "@backend/db";
import {
  client,
  INSTANCE_TENANT_ID,
  project,
  projectBudgets,
  projectBudgetCategory,
} from "@backend/db/schema";
import { buildProjectBudgetDashboardFromBudget } from "@backend/app/actions/project/excel-budget-utils";
import { and, eq } from "drizzle-orm";
import type {
  ClientData,
  FinancialHealth,
  ProjectItem,
  ProjectStatus,
  UserData,
} from "@backend/features/projects/list/types/project-list-types";
import { scopeProjectQuery } from "@backend/lib/auth/scoping";

import { resolveEffectiveProjectHealth } from "@atria/core/project/effective-health";
import type { Actor } from "@backend/server/actor";
import { isProjectManagerOption } from "@backend/server/usecases/project/project-manager-options";

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
  if (!actorCan(actor, "view:budget")) {
    return { status: "restricted" };
  }

  // Scope proyek tetap ditegakkan server: PM hanya menerima proyek miliknya,
  // dan peran tanpa akses menerima filter yang mengembalikan nol baris.
  const projectFilter = await scopeProjectQuery(actor.userId, roleName);
  const canCreateProject = actorCan(actor, "create:project");
  const canEditProject = canCreateProject || actorCan(actor, "update:budget");

  const [projects, clients, users] = await Promise.all([
    db.query.project.findMany({
      where: and(eq(project.tenantId, INSTANCE_TENANT_ID), projectFilter),
      with: {
        client: { columns: { name: true, tenantId: true } },
        projectManager: true,
        canonicalBudgets: {
          where: eq(projectBudgets.tenantId, INSTANCE_TENANT_ID),
          with: {
            categories: {
              where: eq(projectBudgetCategory.tenantId, INSTANCE_TENANT_ID),
              with: {
                expenseCategory: true,
              },
            },
          },
        },
      },
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    }),
    canEditProject
      ? db.query.client.findMany({
          columns: { id: true, name: true },
          where: eq(client.tenantId, INSTANCE_TENANT_ID),
          orderBy: (table, { asc }) => [asc(table.name)],
        })
      : Promise.resolve([]),
    canEditProject
      ? db.query.user.findMany({
          columns: { id: true, name: true, isActive: true },
          with: { role: { columns: { dataScope: true } } },
          orderBy: (table, { asc }) => [asc(table.name)],
        })
      : Promise.resolve([]),
  ]);
  const currentManagerIds = projects.map((row) => row.projectManagerId);

  return {
    status: "ready",
    projects: projects.map((projectRow) => {
      const contractValue = Number(projectRow.totalContractValue);
      const budget = projectRow.canonicalBudgets[0] ?? null;
      const dashboard = budget
        ? buildProjectBudgetDashboardFromBudget({ ...budget, project: { name: projectRow.name } })
        : null;
      const categories = budget?.categories ?? [];
      const actualCost = dashboard?.actualCost ?? 0;
      const internalBudget = dashboard?.internalBudget ?? 0;
      const remainingBudget = dashboard?.remainingBudget ?? 0;
      const usedPercentage = dashboard?.usedPercentage ?? 0;
      const health = resolveEffectiveProjectHealth({
        storedHealth: projectRow.financialHealth,
        remainingBudget,
        usedPercentage,
        categoryStatuses: categories.map((category) => category.status),
        projectedMarginPercentage: dashboard?.projectedMarginPercentage,
        targetMarginPercentage: dashboard?.targetGrossPercentage,
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
        budgetId: budget?.id ?? null,
        actualCost,
        internalBudget,
        usedPercentage,
        remainingBudget,
        paidCost: dashboard?.paidCost ?? 0,
        pendingCost: dashboard?.pendingCost ?? 0,
        projectedMarginAmount: dashboard?.projectedMarginAmount ?? null,
        projectedMarginPercentage: dashboard?.projectedMarginPercentage ?? null,
        targetGrossPercentage: dashboard?.targetGrossPercentage ?? null,
        clientName:
          projectRow.client?.tenantId === INSTANCE_TENANT_ID ? projectRow.client.name : "-",
        pmName: projectRow.projectManager?.name ?? "Belum ditugaskan",
      };
    }),
    clients: clients
      .filter(
        (candidate) => canCreateProject || projects.some((row) => row.clientId === candidate.id),
      )
      .map((client) => ({ id: client.id, name: client.name })),
    users: users
      .filter((user) => isProjectManagerOption(user, currentManagerIds))
      .map((user) => ({ id: user.id, name: user.name })),
    isAllowedToCreate: actorCan(actor, "create:project"),
  };
}
