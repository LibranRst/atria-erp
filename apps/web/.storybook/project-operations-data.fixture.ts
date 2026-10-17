import type { PermissionKey } from "@atria/core/auth/permissions";
import type { ProjectStockItem, ProjectStockRap } from "@atria/core/types/project-operations";
import type {
  ProjectTabsProps,
  StockMovement,
} from "@/features/projects/detail/types/project-tabs-types";
import {
  expensesFixtureData,
  EXPENSES_FIXTURE_PERMISSIONS,
  EXPENSES_FIXTURE_PROJECTS,
  expensesFixtureId,
} from "./expenses-data.fixture";
import { projectsFixtureBudget } from "./projects-data.fixture";
import {
  rapRabFixtureData,
  rapRabFixtureMaterialMovements,
  RAP_RAB_MATERIALS,
} from "./rap-rab-data.fixture";

export type ProjectOperationsFixtureKind =
  | "complete"
  | "empty"
  | "locked"
  | "read-only"
  | "stock-only"
  | "assigned"
  | "no-banks"
  | "restricted"
  | "source-error";
export const PROJECT_OPERATIONS_FIXTURE_PROJECT = EXPENSES_FIXTURE_PROJECTS[0]!;
export const PROJECT_OPERATIONS_FIXTURE_PATH = `/projects/${PROJECT_OPERATIONS_FIXTURE_PROJECT.id}`;
export const PROJECT_OPERATIONS_FIXTURE_USER = {
  id: expensesFixtureId(4000),
  name: "Budi Santoso",
  image: null,
};

export function projectOperationsFixturePermissions(
  kind: ProjectOperationsFixtureKind,
): readonly PermissionKey[] {
  const reads: readonly PermissionKey[] = [
    "view:budget",
    "view:inventory",
    "view:material",
    "view:rap",
    "view:rab",
    "view:cost",
    "view:vendor_bill",
  ];
  if (kind === "restricted") return ["view:budget"];
  if (kind === "read-only") return reads;
  if (kind === "stock-only")
    return ["view:budget", "view:inventory", "view:material", "reserve:stock"];
  const all: readonly PermissionKey[] = [
    ...reads,
    ...EXPENSES_FIXTURE_PERMISSIONS,
    "create:stock_movement",
    "reserve:stock",
    "use:stock",
    "waste:stock",
  ];
  return kind === "assigned" || kind === "no-banks"
    ? all.filter(
        (permission) =>
          permission !== "view:bank_account" &&
          permission !== "pay:cost" &&
          permission !== "pay:vendor_bill",
      )
    : all;
}

function fixtureMovements(index: number): readonly {
  readonly id: string;
  readonly movementType: string;
  readonly quantity: string | number;
  readonly createdAt: Date;
}[] {
  return rapRabFixtureMaterialMovements(index, false).flatMap((move) =>
    move.id && move.createdAt
      ? [
          {
            id: move.id,
            movementType: move.movementType,
            quantity: move.quantity,
            createdAt: move.createdAt,
          },
        ]
      : [],
  );
}

export function projectOperationsFixtureMovements(): StockMovement[] {
  const rap = rapRabFixtureData().rap;
  if (!rap) return [];
  return rap.items.flatMap((item, index) =>
    fixtureMovements(index).map((move) => ({
      id: move.id,
      movementType: move.movementType,
      quantity: String(move.quantity),
      unitCost: item.estimatedUnitCost,
      note: `Contoh sintetis: ${move.movementType === "USE" ? "material dipakai untuk pemasangan" : "material disiapkan untuk proyek"}.`,
      createdAt: new Date(move.createdAt),
      material: { name: item.name, unit: item.unit },
      location: { name: "Gudang Cipete" },
      createdBy: { name: "Budi Santoso" },
    })),
  );
}

function safeStockItem(
  item: NonNullable<ReturnType<typeof rapRabFixtureData>["rap"]>["items"][number],
): ProjectStockItem {
  const {
    id,
    materialId,
    materialName,
    area,
    name,
    totalQuantity,
    unit,
    availableStock,
    needToBuy,
    reservedQuantity,
    boughtQuantity,
    usedQuantity,
    leftoverQuantity,
    securedQuantity,
    returnedQuantity,
    wasteQuantity,
  } = item;
  return {
    id,
    materialId,
    materialName,
    area,
    name,
    totalQuantity,
    unit,
    availableStock,
    needToBuy,
    reservedQuantity,
    boughtQuantity,
    usedQuantity,
    leftoverQuantity,
    securedQuantity,
    returnedQuantity,
    wasteQuantity,
  };
}

/** Full actual-owner data. Expense IDs stay unchanged so exact detail uses the existing safe resolver. */
export function projectOperationsFixtureData(
  kind: ProjectOperationsFixtureKind = "complete",
): ProjectTabsProps {
  const empty = kind === "empty";
  const denied = kind === "restricted";
  const failed = kind === "source-error";
  const stockOnly = kind === "stock-only";
  const exposeBanks =
    kind !== "assigned" && kind !== "no-banks" && kind !== "read-only" && !stockOnly && !denied;
  const plan = rapRabFixtureData(empty ? "empty" : "complete");
  const expense = expensesFixtureData(
    empty ? "empty" : kind === "assigned" ? "assigned" : exposeBanks ? "complete" : "read-only",
  );
  const ownerProject = PROJECT_OPERATIONS_FIXTURE_PROJECT;
  const budgetSource = projectsFixtureBudget(kind === "locked" ? "draft" : "approved");
  const budget = { ...budgetSource, projectId: ownerProject.id, projectName: ownerProject.name };
  const stockRap: ProjectStockRap | null = plan.rap
    ? { id: plan.rap.id, items: plan.rap.items.map(safeStockItem) }
    : null;
  const source = denied
    ? { status: "restricted" as const, message: "Akun contoh ini tidak memiliki izin stok proyek." }
    : failed
      ? {
          status: "unavailable" as const,
          message: "Simulasi kegagalan sumber stok. Data tidak dianggap kosong atau sehat.",
        }
      : stockRap
        ? { status: "ready" as const }
        : { status: "missing" as const };
  const canReadExpenses = !denied && !stockOnly;
  const raps: ProjectTabsProps["project"]["raps"] =
    plan.rap && !stockOnly && !denied
      ? [
          {
            ...plan.rap,
            items: plan.rap.items.map((item, index) => {
              const material = RAP_RAB_MATERIALS.find((row) => row.id === item.materialId);
              return {
                ...item,
                updatedAt: new Date("2026-10-07T03:00:00Z"),
                material: material
                  ? {
                      id: material.id,
                      name: material.name,
                      category: { name: material.categoryName },
                      inventory: material.inventories.map((row) => ({
                        currentStock: row.currentStock,
                        reservedStock: row.reservedStock,
                      })),
                    }
                  : null,
                stockMovements: fixtureMovements(index).map((move) => ({
                  id: move.id,
                  movementType: move.movementType,
                  quantity: move.quantity,
                  createdAt: new Date(move.createdAt),
                })),
              };
            }),
          },
        ]
      : [];
  const costs =
    canReadExpenses && !failed
      ? expense.costs.filter((row) => row.project?.id === ownerProject.id)
      : [];
  const bills =
    canReadExpenses && !failed
      ? expense.bills.filter((row) => row.projectId === ownerProject.id)
      : [];
  const billIds = new Set(bills.map((row) => row.id));
  const payments = expense.payments.filter((row) => billIds.has(row.vendorBillId));
  return {
    project: {
      id: ownerProject.id,
      name: ownerProject.name,
      clientId: expensesFixtureId(9000),
      projectManagerId: PROJECT_OPERATIONS_FIXTURE_USER.id,
      totalContractValue: String(budget.contractValue),
      financialHealth: "HEALTHY",
      location: "Menteng, Jakarta Pusat",
      roomArea: "180 m²",
      projectType: "RESIDENTIAL",
      coverImageUrl: null,
      startDate: new Date("2026-08-10T00:00:00Z"),
      endDate: new Date("2026-12-15T00:00:00Z"),
      notes: "Contoh sintetis. Peninjauan stok dan pengeluaran proyek desktop.",
      status: "ACTIVE",
      createdAt: new Date("2026-08-01T00:00:00Z"),
      client: {
        name: "Keluarga Surya",
        email: "client@example.test",
        phone: null,
        address: "Jakarta Pusat",
      },
      projectManager: { name: "Budi Santoso", email: "budi@example.test" },
      budget: null,
      raps,
      rabEstimates: [],
      categoryPlanItems: [],
      changeOrders: [],
    },
    costCategories: [],
    userRole: "CUSTOM",
    userId: PROJECT_OPERATIONS_FIXTURE_USER.id,
    vendorPaymentApprovalThreshold: 5000000,
    bankAccounts: exposeBanks ? expense.accounts : [],
    costs,
    vendorBills: bills,
    vendorPayments: payments,
    vendors: expense.vendors,
    projectsForForms: [ownerProject],
    stockMovements: denied || failed || empty ? [] : projectOperationsFixtureMovements(),
    projectStockData: {
      source,
      rap: source.status === "ready" ? stockRap : null,
      materials: source.status === "ready" ? [...RAP_RAB_MATERIALS] : [],
    },
    projectExpensesSource: {
      costs: { status: !canReadExpenses ? "restricted" : failed ? "unavailable" : "ready" },
      vendorBills: { status: !canReadExpenses ? "restricted" : failed ? "unavailable" : "ready" },
    },
    invoices: [],
    projectBudgetDashboard: budget,
    projectBudgetSource: { status: "ready" },
    materialMasterCatalog: stockOnly || denied ? [] : [...RAP_RAB_MATERIALS],
    pricingTemplateCatalog: [],
    clients: [],
    projectManagers: [],
  };
}
