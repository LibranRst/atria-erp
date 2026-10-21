import type { PermissionKey } from "@atria/core/auth/permissions";
import { resolveEffectiveProjectHealth } from "@atria/core/project/effective-health";
import type { ClientData, ProjectItem, ProjectStatus, UserData } from "@atria/core/types/projects";
import type { ProjectBudgetDashboard } from "@/app/actions/project/excel-budget";

export type ProjectsFixtureScenario =
  "complete" | "empty" | "read-only" | "assigned" | "pending" | "source-error";

export function projectsFixtureId(value: number): string {
  return `30000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

export const PROJECTS_FIXTURE_CLIENTS: readonly ClientData[] = [
  { id: projectsFixtureId(101), name: "Keluarga Surya" },
  { id: projectsFixtureId(102), name: "Nusa Living" },
  { id: projectsFixtureId(103), name: "Bumi Ruang" },
  { id: projectsFixtureId(104), name: "PT Langkah Bersama" },
];
export const PROJECTS_FIXTURE_USERS: readonly UserData[] = [
  { id: projectsFixtureId(201), name: "Karin Putri" },
  { id: projectsFixtureId(202), name: "Budi Santoso" },
  { id: projectsFixtureId(203), name: "Agus Pratama" },
];

const names: readonly string[] = [
  "Menteng Villa — Kitchen & Living Room Fit-Out",
  "Cipete House — Renovasi lantai dua dan area servis",
  "Kemang Residence",
  "Bintaro Garden House",
  "Senopati Office — Ruang kerja dan area pertemuan",
  "Pondok Indah Family Home",
  "BSD Studio",
  "Cilandak Townhouse",
  "Puri Apartment — Interior unit keluarga",
];
const statuses: readonly ProjectStatus[] = [
  "ACTIVE",
  "ACTIVE",
  "ACTIVE",
  "ACTIVE",
  "DRAFT",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "ACTIVE",
];

function fixtureProject(index: number): ProjectItem {
  const status = statuses[index % statuses.length] ?? "ACTIVE";
  const noBudget = index % 9 === 3;
  const zero = index === 8;
  const contract = zero ? 0 : 250_000_000 + index * 17_000_000 + (index === 0 ? 0.75 : 0);
  const internalBudget = noBudget || zero ? 0 : Math.round(contract * 0.9 * 100) / 100;
  const actualCost =
    noBudget || zero ? 0 : Math.round(internalBudget * [0.42, 1.08, 0.84][index % 3]! * 100) / 100;
  const paidCost = Math.round(actualCost * 0.8 * 100) / 100;
  const pendingCost = noBudget || zero ? 0 : 1_250_000.25 + index * 100_000;
  const remainingBudget = Math.round((internalBudget - actualCost) * 100) / 100;
  const usedPercentage = internalBudget > 0 ? (actualCost / internalBudget) * 100 : 0;
  const projectedMarginAmount = noBudget
    ? null
    : Math.round((contract - Math.max(internalBudget, actualCost)) * 100) / 100;
  const projectedMarginPercentage =
    projectedMarginAmount === null
      ? null
      : contract > 0
        ? (projectedMarginAmount / contract) * 100
        : 0;
  const health = resolveEffectiveProjectHealth({
    storedHealth: "HEALTHY",
    remainingBudget,
    usedPercentage,
    projectedMarginPercentage,
    targetMarginPercentage: noBudget ? null : 10,
  });
  const client = PROJECTS_FIXTURE_CLIENTS[index % PROJECTS_FIXTURE_CLIENTS.length]!;
  const manager =
    index === 5 ? null : PROJECTS_FIXTURE_USERS[index % PROJECTS_FIXTURE_USERS.length]!;
  const name = names[index % names.length] ?? "Proyek tinjauan";
  return {
    id: projectsFixtureId(index + 1),
    name: index < names.length ? name : `${name} · Tahap ${Math.floor(index / names.length) + 1}`,
    clientId: client.id,
    projectManagerId: manager?.id ?? null,
    clientName: client.name,
    pmName: manager?.name ?? "Belum ditentukan",
    status,
    financialHealth: "HEALTHY",
    ...health,
    totalContractValue: contract,
    budgetId: noBudget ? null : projectsFixtureId(1000 + index),
    budgetStatus: noBudget
      ? "TIDAK ADA"
      : index % 9 === 4
        ? "DRAFT"
        : index % 9 === 5
          ? "PENDING_APPROVAL"
          : "APPROVED",
    internalBudget,
    actualCost,
    paidCost,
    pendingCost,
    remainingBudget,
    usedPercentage,
    projectedMarginAmount,
    projectedMarginPercentage,
    targetGrossPercentage: noBudget ? null : 10,
    startDate: "2026-08-10T00:00:00.000Z",
    endDate: index === 5 ? null : "2026-12-15T00:00:00.000Z",
    location: index % 2 === 0 ? "Jakarta Selatan" : "Tangerang Selatan",
    roomArea: index === 8 ? "0" : "180",
    projectType: "RESIDENTIAL",
    coverImageUrl: null,
    notes: "Data sintetis untuk tinjauan desktop dan pengujian interaksi.",
  };
}

export const PROJECTS_FIXTURE_PROJECTS: readonly ProjectItem[] = Array.from(
  { length: 36 },
  (_, index) => fixtureProject(index),
);

export function projectsFixturePermissions(
  scenario: ProjectsFixtureScenario,
): readonly PermissionKey[] {
  return scenario === "read-only" || scenario === "assigned"
    ? ["view:budget"]
    : ["view:budget", "create:project", "create:budget", "update:budget", "approve:budget"];
}

export function projectsFixtureData(scenario: ProjectsFixtureScenario): {
  readonly projects: readonly ProjectItem[];
  readonly clients: readonly ClientData[];
  readonly users: readonly UserData[];
  readonly isAllowedToCreate: boolean;
} {
  return {
    projects:
      scenario === "empty"
        ? []
        : scenario === "assigned"
          ? PROJECTS_FIXTURE_PROJECTS.filter(
              (project) => project.projectManagerId === projectsFixtureId(201),
            )
          : PROJECTS_FIXTURE_PROJECTS,
    clients: PROJECTS_FIXTURE_CLIENTS,
    users: PROJECTS_FIXTURE_USERS,
    isAllowedToCreate: scenario !== "read-only" && scenario !== "assigned",
  };
}

export type ProjectsBudgetFixtureKind = "approved" | "draft" | "pending" | "zero" | "risk";

export function projectsFixtureBudget(
  kind: ProjectsBudgetFixtureKind = "approved",
): ProjectBudgetDashboard {
  const zero = kind === "zero";
  const risk = kind === "risk";
  const categorySources: readonly {
    readonly code: ProjectBudgetDashboard["categories"][number]["code"];
    readonly name: string;
    readonly allocated: number;
    readonly actual: number;
    readonly pending: number;
    readonly paid: number;
  }[] = [
    {
      code: "MATERIAL",
      name: "Material",
      allocated: 110_000_000.25,
      actual: risk ? 125_000_000.75 : 43_500_000.25,
      pending: 4_000_000.25,
      paid: 30_000_000.25,
    },
    {
      code: "TUKANG",
      name: "Tukang",
      allocated: 50_000_000,
      actual: 30_000_000,
      pending: 2_000_000,
      paid: 27_000_000,
    },
    {
      code: "OPERASIONAL",
      name: "Operasional",
      allocated: 20_000_000,
      actual: 16_000_000,
      pending: 500_000,
      paid: 14_000_000,
    },
    { code: "LAIN_LAIN", name: "Lain-lain", allocated: 0, actual: 0, pending: 0, paid: 0 },
    {
      code: "SUBCON",
      name: "Subcon",
      allocated: 45_000_000.5,
      actual: risk ? 70_000_000 : 20_000_000,
      pending: 3_000_000,
      paid: 15_000_000,
    },
  ];
  const categories: ProjectBudgetDashboard["categories"] = categorySources.map((item, index) => {
    const allocatedAmount = zero ? 0 : item.allocated;
    const actualAmount = zero ? 0 : item.actual;
    const usedPercentage = allocatedAmount > 0 ? (actualAmount / allocatedAmount) * 100 : 0;
    return {
      id: projectsFixtureId(2000 + index),
      code: item.code,
      name: item.name,
      allocatedAmount,
      actualAmount,
      pendingAmount: zero ? 0 : item.pending,
      paidAmount: zero ? 0 : item.paid,
      remainingAmount: allocatedAmount - actualAmount,
      usedPercentage,
      status: usedPercentage > 100 ? "OVER_BUDGET" : usedPercentage >= 75 ? "WATCH" : "SAFE",
      sortOrder: index,
    };
  });
  const internalBudget = categories.reduce((sum, item) => sum + item.allocatedAmount, 0);
  const actualCost = categories.reduce((sum, item) => sum + item.actualAmount, 0);
  const contractValue = zero ? 0 : 250_000_000.75;
  const projectedMarginAmount = contractValue - Math.max(internalBudget, actualCost);
  return {
    projectId: projectsFixtureId(1),
    projectName: "Menteng Villa — Kitchen & Living Room Fit-Out",
    budgetId: projectsFixtureId(1000),
    status: kind === "draft" ? "DRAFT" : kind === "pending" ? "PENDING_APPROVAL" : "APPROVED",
    contractValue,
    approvedRabValue: contractValue,
    internalBudget,
    pendingCost: categories.reduce((sum, item) => sum + item.pendingAmount, 0),
    actualCost,
    paidCost: categories.reduce((sum, item) => sum + item.paidAmount, 0),
    remainingBudget: internalBudget - actualCost,
    usedPercentage: internalBudget > 0 ? (actualCost / internalBudget) * 100 : 0,
    targetGrossAmount: zero ? 0 : 25_000_000,
    targetGrossPercentage: zero ? 0 : 10,
    projectedMarginAmount,
    projectedMarginPercentage:
      contractValue > 0 ? (projectedMarginAmount / contractValue) * 100 : 0,
    productionScopeTotal: contractValue,
    serviceFeeTotal: 0,
    physicalMarginAmount: projectedMarginAmount,
    physicalMarginPercentage: contractValue > 0 ? (projectedMarginAmount / contractValue) * 100 : 0,
    projectProgressPercentage: zero ? 0 : 42,
    categories,
  };
}
