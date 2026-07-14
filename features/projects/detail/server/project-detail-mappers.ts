import type { ExpenseCostItem } from "@/features/expenses/components/expense-list";
import type { ClientInvoiceItem } from "../components/invoices/project-invoices";
import type { ProjectTabsProps } from "../components/project-tabs";

type ProjectCostListRow = Omit<ExpenseCostItem, "status"> & {
  readonly status: string;
};

type ClientInvoicePaymentRow = Omit<
  ClientInvoiceItem["payments"][number],
  "referenceNumber"
> & {
  readonly referenceNumber: string | null;
};

type ClientInvoiceRow = Omit<ClientInvoiceItem, "status" | "payments"> & {
  readonly status: string;
  readonly payments: readonly ClientInvoicePaymentRow[];
};

interface MaterialCatalogRow {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  readonly inventory: readonly {
    readonly id: string;
    readonly locationId: string;
    readonly currentStock: string | number;
    readonly reservedStock: string | number;
    readonly averageCost: string | number;
    readonly lastPurchasePrice: string | number | null;
    readonly location: {
      readonly name: string;
    };
  }[];
  readonly category: {
    readonly name: string;
  } | null;
}

interface ProjectFormRow {
  readonly id: string;
  readonly name: string;
  readonly budget: ProjectTabsProps["projectsForForms"][number]["budget"];
  readonly canonicalBudgets: readonly {
    readonly id: string;
    readonly status: string;
    readonly categories: readonly {
      readonly id: string;
      readonly allocatedAmount: string | number;
      readonly pendingAmount: string | number;
      readonly actualAmount: string | number;
      readonly paidAmount: string | number;
      readonly remainingAmount: string | number;
      readonly usedPercentage: string | number;
      readonly status: string;
      readonly sortOrder: number;
      readonly expenseCategory: {
        readonly code: string;
        readonly name: string;
      };
    }[];
  }[];
  readonly raps: readonly {
    readonly items: readonly {
      readonly id: string;
      readonly materialId: string | null;
      readonly name: string;
      readonly area: string;
      readonly totalQuantity: string;
      readonly unit: string;
      readonly status: string;
    }[];
  }[];
  readonly categoryPlanItems: readonly {
    readonly id: string;
    readonly projectBudgetCategoryId: string;
    readonly name: string;
    readonly area: string;
    readonly quantity: string;
    readonly unit: string;
    readonly estimatedTotalCost: string;
    readonly status: string;
    readonly expenseCategory: {
      readonly code: string;
    };
  }[];
}

interface PricingTemplateRow {
  readonly id: string;
  readonly itemType: string;
  readonly expenseCategoryId: string;
  readonly materialId: string | null;
  readonly defaultVendorId: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly unit: string;
  readonly defaultInternalCost: string | number;
  readonly defaultClientPrice: string | number;
}

function toClientInvoiceStatus(status: string): ClientInvoiceItem["status"] {
  switch (status) {
    case "UNPAID":
    case "PARTIALLY_PAID":
    case "PAID":
    case "OVERDUE":
    case "VOID":
      return status;
    default:
      throw new Error(`Status invoice klien tidak dikenal: ${status}`);
  }
}

function toExpenseCostStatus(status: string): ExpenseCostItem["status"] {
  switch (status) {
    case "SUBMITTED":
    case "VERIFIED":
    case "APPROVED":
    case "REJECTED":
    case "PAID":
      return status;
    default:
      throw new Error(`Status pengajuan biaya tidak dikenal: ${status}`);
  }
}

export function mapCostsForList(
  costs: readonly ProjectCostListRow[],
): ProjectTabsProps["costs"] {
  return costs.map((cost) => ({
    ...cost,
    status: toExpenseCostStatus(cost.status),
  }));
}

export function mapClientInvoices(
  invoices: readonly ClientInvoiceRow[],
): ProjectTabsProps["invoices"] {
  return invoices.map((invoice) => ({
    ...invoice,
    status: toClientInvoiceStatus(invoice.status),
    payments: invoice.payments.map((payment) => ({
      ...payment,
      referenceNumber: payment.referenceNumber ?? "-",
    })),
  }));
}

export function mapMaterialMasterCatalog(
  materials: readonly MaterialCatalogRow[],
): ProjectTabsProps["materialMasterCatalog"] {
  return materials.map((material) => ({
    id: material.id,
    name: material.name,
    unit: material.unit,
    lastPurchasePrice: String(material.inventory[0]?.lastPurchasePrice ?? "0"),
    availableStock: material.inventory.reduce((sum, inventory) => {
      return (
        sum + Number(inventory.currentStock) - Number(inventory.reservedStock)
      );
    }, 0),
    categoryName: material.category?.name ?? "Lain-lain",
    inventories: material.inventory.map((inventory) => ({
      inventoryId: inventory.id,
      locationId: inventory.locationId,
      locationName: inventory.location.name,
      currentStock: Number(inventory.currentStock),
      reservedStock: Number(inventory.reservedStock),
      availableStock:
        Number(inventory.currentStock) - Number(inventory.reservedStock),
      averageCost: Number(inventory.averageCost),
    })),
  }));
}

export function mapProjectsForForms({
  projects,
  materialMasterCatalog,
}: {
  readonly projects: readonly ProjectFormRow[];
  readonly materialMasterCatalog: ProjectTabsProps["materialMasterCatalog"];
}): ProjectTabsProps["projectsForForms"] {
  return projects.map((row) => ({
    id: row.id,
    name: row.name,
    budget: row.budget,
    canonicalBudgets: row.canonicalBudgets.map((budget) => ({
      id: budget.id,
      status: budget.status,
      categories: budget.categories.map((category) => ({
        id: category.id,
        code: category.expenseCategory.code,
        name: category.expenseCategory.name,
        allocatedAmount: String(category.allocatedAmount),
        pendingAmount: String(category.pendingAmount),
        actualAmount: String(category.actualAmount),
        paidAmount: String(category.paidAmount),
        remainingAmount: String(category.remainingAmount),
        usedPercentage: String(category.usedPercentage),
        status: category.status,
        sortOrder: category.sortOrder,
      })),
    })),
    materialOptions: materialMasterCatalog,
    rapItems: row.raps.flatMap((rap) =>
      rap.items.map((item) => ({
        id: item.id,
        materialId: item.materialId,
        label: item.name,
        area: item.area,
        quantity: item.totalQuantity,
        unit: item.unit,
        status: item.status,
      })),
    ),
    categoryPlanItems: row.categoryPlanItems.map((item) => ({
      id: item.id,
      projectBudgetCategoryId: item.projectBudgetCategoryId,
      expenseCategoryCode: item.expenseCategory.code,
      label: item.name,
      area: item.area,
      quantity: item.quantity,
      unit: item.unit,
      estimatedTotalCost: item.estimatedTotalCost,
      status: item.status,
    })),
  }));
}

export function mapPricingTemplateCatalog(
  items: readonly PricingTemplateRow[],
): ProjectTabsProps["pricingTemplateCatalog"] {
  return items.map((item) => ({
    id: item.id,
    itemType: item.itemType,
    expenseCategoryId: item.expenseCategoryId,
    materialId: item.materialId,
    defaultVendorId: item.defaultVendorId,
    name: item.name,
    description: item.description,
    unit: item.unit,
    internalCost: Number(item.defaultInternalCost),
    suggestedClientPrice: Number(item.defaultClientPrice),
  }));
}
