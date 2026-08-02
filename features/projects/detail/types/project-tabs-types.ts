import type { ProjectBudgetDashboard } from "@/app/actions/project/excel-budget";
import type {
  BankAccountItem,
  ExpenseCostItem,
} from "@/features/expenses/components/lists/expense-list";
import type {
  VendorListBill,
  VendorListPayment,
  VendorListProject,
  VendorListVendor,
} from "@/features/expenses/components/lists/vendor-bill-list";
import type { ClientInvoiceItem } from "@/features/projects/detail/components/invoices/project-invoices";
import type {
  MaterialOption,
  PricingTemplateOption,
} from "@/features/projects/detail/components/shared/rap-rab-manager";

interface ClientMetadata {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface PmMetadata {
  name: string;
  email: string | null;
}

interface BudgetHeader {
  id: string;
  projectId: string;
  status: string;
  notes: string | null;
  items?: BudgetItem[];
}

interface BudgetItem {
  readonly budgetCategory: string;
  readonly allocatedAmount: string | number;
  readonly actualSpent: string | number;
}

interface InventoryData {
  readonly currentStock: string | number;
  readonly reservedStock: string | number;
}

interface MaterialData {
  readonly id: string;
  readonly name: string;
  readonly inventory?: readonly InventoryData[];
  readonly category?: {
    readonly name: string;
  } | null;
}

interface RapStockMovementData {
  readonly id: string;
  readonly movementType: string;
  readonly quantity: string | number;
  readonly createdAt: Date;
}

interface ProjectRapItemData {
  readonly id: string;
  readonly materialId: string | null;
  readonly material?: MaterialData | null;
  readonly stockMovements?: readonly RapStockMovementData[];
  readonly area: string;
  readonly name: string;
  readonly description: string | null;
  readonly requiredQuantity: string;
  readonly bufferQuantity: string;
  readonly totalQuantity: string;
  readonly unit: string;
  readonly estimatedUnitCost: string;
  readonly estimatedTotalCost: string;
  readonly source: string;
  readonly status: string;
  readonly internalNote: string | null;
  readonly updatedAt: Date;
}

interface ProjectRapData {
  readonly id: string;
  readonly status: string;
  readonly revision: number;
  readonly notes: string | null;
  readonly setupStage: string;
  readonly tukangScopeSkipped: boolean;
  readonly subconScopeSkipped: boolean;
  readonly setupUpdatedById: string | null;
  readonly items: readonly ProjectRapItemData[];
}

interface RabEstimateItemData {
  readonly id: string;
  readonly sourceType: string;
  readonly sourceProjectRapItemId: string | null;
  readonly sourceProjectCategoryPlanItemId: string | null;
  readonly clientLabel: string;
  readonly description: string | null;
  readonly quantity: string;
  readonly unit: string;
  readonly unitPrice: string;
  readonly lineTotal: string;
  readonly displayOrder: number;
  readonly isHidden: boolean;
  readonly isBundle: boolean;
  readonly bundleId: string | null;
  readonly sourceRevision: number | null;
  readonly sourceUpdatedAt: Date | null;
}

interface RabEstimateBundleData {
  readonly id: string;
  readonly clientLabel: string;
  readonly description: string | null;
  readonly quantity: string;
  readonly unit: string;
  readonly unitPrice: string;
  readonly lineTotal: string;
  readonly displayOrder: number;
  readonly isHidden: boolean;
  readonly items: readonly { readonly id: string }[];
}

interface RabEstimateData {
  readonly id: string;
  readonly sourceProjectRapId: string | null;
  readonly supersedesRabEstimateId: string | null;
  readonly status: string;
  readonly revision: number;
  readonly title: string;
  readonly clientNotes: string | null;
  readonly approvedValue: string;
  readonly voidReason: string | null;
  readonly voidedAt: Date | null;
  readonly voidedBy?: { readonly name: string } | null;
  readonly items: readonly RabEstimateItemData[];
  readonly bundles: readonly RabEstimateBundleData[];
}

interface CategoryPlanItemData {
  readonly id: string;
  readonly projectBudgetCategoryId: string;
  readonly expenseCategory?: {
    readonly code: string;
    readonly name: string;
  } | null;
  readonly vendorId: string | null;
  readonly vendor?: {
    readonly name: string;
  } | null;
  readonly name: string;
  readonly scopeDescription: string | null;
  readonly area: string;
  readonly quantity: string;
  readonly unit: string;
  readonly estimatedUnitCost: string;
  readonly estimatedTotalCost: string;
  readonly status: string;
  readonly internalNote: string | null;
  readonly displayOrder: number;
  readonly revision: number;
  readonly updatedAt: Date;
}

interface ChangeOrderData {
  readonly id: string;
  readonly status: string;
  readonly reason: string;
  readonly scopeSummary: string;
  readonly previousContractValue: string;
  readonly valueDelta: string;
  readonly revisedContractValue: string;
  readonly clientConfirmedAt: Date | null;
  readonly clientConfirmationReference: string | null;
  readonly createdAt: Date;
  readonly approvedAt: Date | null;
  readonly createdBy: { readonly name: string };
  readonly approvedBy: { readonly name: string } | null;
  readonly baseRab: {
    readonly revision: number;
    readonly sourceRap: { readonly revision: number } | null;
    readonly items: readonly {
      readonly sourceType: string;
      readonly sourceRevision: number | null;
    }[];
  };
  readonly revisedRab: {
    readonly revision: number;
    readonly sourceRap: { readonly revision: number } | null;
    readonly items: readonly {
      readonly sourceType: string;
      readonly sourceRevision: number | null;
    }[];
  };
}

interface ProjectCostLinkData {
  readonly projectCategoryPlanItemId?: string | null;
  readonly projectRapItemId?: string | null;
}

export type ProjectTabCost = ExpenseCostItem & ProjectCostLinkData;

export interface ProjectData {
  id: string;
  name: string;
  totalContractValue: string;
  financialHealth: string;
  location: string | null;
  roomArea: string | null;
  projectType: string | null;
  coverImageUrl: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  notes: string | null;
  status: string;
  createdAt: Date;
  client: ClientMetadata | null;
  projectManager: PmMetadata | null;
  budget: BudgetHeader | null;
  raps: ProjectRapData[];
  rabEstimates: RabEstimateData[];
  categoryPlanItems: CategoryPlanItemData[];
  changeOrders: ChangeOrderData[];
}

export interface StockMovement {
  id: string;
  movementType: string;
  quantity: string;
  unitCost: string;
  note: string | null;
  createdAt: Date;
  material: {
    name: string;
    unit: string;
  };
  location: {
    name: string;
  };
  createdBy: {
    name: string;
  };
}

export interface ProjectTabsProps {
  readonly project: ProjectData;
  readonly costCategories: readonly unknown[];
  readonly userRole: string;
  readonly userId: string;
  readonly bankAccounts: BankAccountItem[];
  readonly costs: ProjectTabCost[];
  readonly vendorBills: VendorListBill[];
  readonly vendorPayments: VendorListPayment[];
  readonly vendors: VendorListVendor[];
  readonly projectsForForms: VendorListProject[];
  readonly stockMovements: StockMovement[];
  readonly invoices: ClientInvoiceItem[];
  readonly projectBudgetDashboard: ProjectBudgetDashboard | null;
  readonly materialMasterCatalog: MaterialOption[];
  readonly pricingTemplateCatalog: PricingTemplateOption[];
}

export const TABS = [
  { id: "overview", label: "Ringkasan", icon: "space_dashboard" },
  { id: "rab", label: "RAB", icon: "request_quote" },
  { id: "rap", label: "RAP", icon: "architecture" },
  { id: "stok", label: "Stok", icon: "inventory_2" },
  { id: "expenses", label: "Pengeluaran", icon: "receipt_long" },
  { id: "payments", label: "Pembayaran", icon: "account_balance_wallet" },
  { id: "profitability", label: "Margin", icon: "trending_up" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function toTabId(value: string | null, isLocked: boolean): TabId {
  const tab = TABS.find((item) => item.id === value);
  if (tab) return tab.id;
  return isLocked ? "rap" : "overview";
}
