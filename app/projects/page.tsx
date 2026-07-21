import { db } from "@/db";
import { resolveRoleName } from "@/lib/auth/permissions";
import { scopeProjectQuery } from "@/lib/auth/scoping";
import React from "react";
import { ProjectListClient } from "@/features/projects/list/components/project-list-client";
import { requireServerSession } from "@/lib/server/session";
import { resolveEffectiveProjectHealth } from "@/lib/project/effective-health";

function toProjectStatus(
  status: string,
): "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED" {
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

function toFinancialHealth(status: string): "HEALTHY" | "WARNING" | "CRITICAL" {
  if (status === "WARNING" || status === "CRITICAL") {
    return status;
  }
  return "HEALTHY";
}

export const dynamic = "force-dynamic";

export default async function ProjectsPage(): Promise<React.JSX.Element> {
  const session = await requireServerSession();

  const roleName = await resolveRoleName(session.user.roleId);
  const projectFilter = scopeProjectQuery(session.user.id, roleName);

  // 3. Query projects with budgets & categories
  const projectsData = await db.query.project.findMany({
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
  });

  // 4. Query clients & users for form
  const clientsData = await db.query.client.findMany({
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  const usersData = await db.query.user.findMany({
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  const isAllowedToCreate = roleName === "OWNER" || roleName === "FINANCE_ADMIN";

  // 5. Map data to client components expectation
  const mappedProjects = projectsData.map((proj) => {
    const contractVal = Number(proj.totalContractValue);
    const budget = proj.canonicalBudgets?.[0] || null;
    const categories = budget?.categories || [];
    const actualCost = categories.reduce((sum, c) => sum + Number(c.actualAmount), 0);
    const internalBudget = Number(budget?.internalBudget || contractVal * 0.9);
    const remainingBudget = internalBudget - actualCost;
    const usedPercentage = internalBudget > 0 ? (actualCost / internalBudget) * 100 : 0;
    const projectedMarginPercentage =
      contractVal > 0
        ? ((contractVal - Math.max(internalBudget, actualCost)) / contractVal) * 100
        : 0;
    const targetMarginPercentage =
      contractVal > 0 ? (Number(budget?.targetGrossAmount ?? 0) / contractVal) * 100 : 0;
    const health = resolveEffectiveProjectHealth({
      storedHealth: proj.financialHealth,
      remainingBudget,
      usedPercentage,
      categoryStatuses: categories.map((category) => category.status),
      projectedMarginPercentage,
      targetMarginPercentage,
    });

    return {
      id: proj.id,
      name: proj.name,
      clientId: proj.clientId,
      projectManagerId: proj.projectManagerId,
      status: toProjectStatus(proj.status),
      financialHealth: toFinancialHealth(proj.financialHealth),
      effectiveHealth: health.effectiveHealth,
      healthReasons: health.healthReasons,
      totalContractValue: contractVal,
      startDate: proj.startDate ? proj.startDate.toISOString() : null,
      endDate: proj.endDate ? proj.endDate.toISOString() : null,
      location: proj.location,
      roomArea: proj.roomArea,
      projectType: proj.projectType,
      coverImageUrl: proj.coverImageUrl,
      notes: proj.notes,
      budgetStatus: budget?.status || "TIDAK ADA",
      actualCost,
      internalBudget,
      usedPercentage,
      remainingBudget,
      clientName: proj.client?.name || "-",
      pmName: proj.projectManager?.name || "-",
    };
  });

  return (
    <ProjectListClient
      projects={mappedProjects}
      clients={clientsData.map((c) => ({ id: c.id, name: c.name }))}
      users={usersData.map((u) => ({ id: u.id, name: u.name }))}
      isAllowedToCreate={isAllowedToCreate}
    />
  );
}
