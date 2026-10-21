import type { PermissionKey } from "@atria/core/auth/permissions";
import type {
  CategoryPlanFormState,
  MaterialOption,
  PricingTemplateOption,
  ProjectCategoryPlanItemView,
  ProjectPlanBudgetCategory,
  RapFormState,
  RapOverviewFilter,
  RapSetupStage,
  RapView,
  RapItemView,
} from "../types/rap-rab-types";

export const emptyRapForm: RapFormState = {
  templateId: "",
  materialId: "",
  area: "Umum",
  name: "",
  description: "",
  requiredQuantity: "",
  bufferQuantity: "0",
  unit: "",
  estimatedUnitCost: "",
  source: "PURCHASE",
  internalNote: "",
};

export const emptyCategoryPlanForm: CategoryPlanFormState = {
  templateId: "",
  projectBudgetCategoryId: "",
  vendorId: "",
  name: "",
  scopeDescription: "",
  area: "Umum",
  quantity: "1",
  unit: "ls",
  estimatedUnitCost: "",
  internalNote: "",
};

export interface RapManagerPermissions {
  readonly canCreateRap: boolean;
  readonly canEditRap: boolean;
  readonly canEditCategoryPlan: boolean;
  readonly canFinalizeRap: boolean;
}

export interface RapManagerDerivedValues {
  readonly plannedCost: number;
  readonly needToBuy: number;
  readonly tukangPlanItems: ProjectCategoryPlanItemView[];
  readonly subconPlanItems: ProjectCategoryPlanItemView[];
  readonly selectedMaterial: MaterialOption | undefined;
  readonly formTotalQty: number;
  readonly formNeedToBuy: number;
  readonly formAvailableStock: number;
  readonly formEstimatedTotal: number;
  readonly categoryFormEstimatedTotal: number;
  readonly packageItemCount: number;
}

export function getInitialRapStage(rap: RapView | null): RapSetupStage {
  const stage = rap?.setupStage;
  return stage === "TUKANG" || stage === "SUBCON" || stage === "REVIEW" ? stage : "MATERIAL";
}

export function getInitialRapOverviewFilter(): RapOverviewFilter {
  return "MATERIAL";
}

export function getRapPermissions(permissions: readonly PermissionKey[]): RapManagerPermissions {
  const canEditRap = permissions.includes("update:rap");
  const canEditCategoryPlan = permissions.includes("update:budget");

  return {
    canCreateRap: permissions.includes("create:rap"),
    canEditRap,
    canEditCategoryPlan,
    canFinalizeRap: permissions.includes("lock:rap"),
  };
}

export function getRapManagerDerivedValues({
  rap,
  materials,
  categoryPlanItems,
  rapForm,
  categoryPlanForm,
}: {
  readonly rap: RapView | null;
  readonly materials: readonly MaterialOption[];
  readonly categoryPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly rapForm: RapFormState;
  readonly categoryPlanForm: CategoryPlanFormState;
}): RapManagerDerivedValues {
  const plannedCost =
    rap?.items.reduce((sum, item) => sum + Number(item.estimatedTotalCost), 0) ?? 0;
  const needToBuy = rap?.items.reduce((sum, item) => sum + item.needToBuy, 0) ?? 0;
  const tukangPlanItems = getPlanItemsByCategory(categoryPlanItems, "TUKANG");
  const subconPlanItems = getPlanItemsByCategory(categoryPlanItems, "SUBCON");
  const selectedMaterial = materials.find((material) => material.id === rapForm.materialId);
  const formTotalQty =
    (Number(rapForm.requiredQuantity) || 0) + (Number(rapForm.bufferQuantity) || 0);
  /**
   * Sama seperti `projectMaterialProjection`: stok gudang yang masih bebas belum
   * menjadi milik proyek ini sampai direservasi, jadi ia tidak mengurangi
   * kebutuhan pembelian. Sebelumnya form mengurangkan `availableStock` sehingga
   * menampilkan "Perlu dibeli 0" saat menyusun RAP, lalu daftar RAP langsung
   * membantah dengan "Beli 20" untuk item yang sama.
   *
   * Jumlah stok bebas tetap ditampilkan terpisah sebagai konteks pada pemilih
   * Material Master ("Tersedia 22"), bukan dengan mengecilkan kebutuhan.
   */
  const formNeedToBuy = formTotalQty;
  const formAvailableStock = selectedMaterial?.availableStock ?? 0;
  const formEstimatedTotal = formTotalQty * (Number(rapForm.estimatedUnitCost) || 0);
  const categoryFormEstimatedTotal =
    (Number(categoryPlanForm.quantity) || 0) * (Number(categoryPlanForm.estimatedUnitCost) || 0);

  return {
    plannedCost,
    needToBuy,
    tukangPlanItems,
    subconPlanItems,
    selectedMaterial,
    formTotalQty,
    formNeedToBuy,
    formAvailableStock,
    formEstimatedTotal,
    categoryFormEstimatedTotal,
    packageItemCount: tukangPlanItems.length + subconPlanItems.length,
  };
}

export function applyMaterialToRapForm({
  current,
  materialId,
  materials,
}: {
  readonly current: RapFormState;
  readonly materialId: string;
  readonly materials: readonly MaterialOption[];
}): RapFormState {
  const material = materials.find((item) => item.id === materialId);

  return {
    ...current,
    materialId,
    name: current.name || material?.name || "",
    unit: material?.unit || current.unit,
    estimatedUnitCost:
      current.estimatedUnitCost || (material ? String(Number(material.lastPurchasePrice)) : ""),
    source: material && material.availableStock > 0 ? "STOCK_AND_PURCHASE" : "PURCHASE",
  };
}

export function applyRapTemplateToForm({
  current,
  templateId,
  materials,
  pricingTemplates,
}: {
  readonly current: RapFormState;
  readonly templateId: string;
  readonly materials: readonly MaterialOption[];
  readonly pricingTemplates: readonly PricingTemplateOption[];
}): RapFormState {
  const template = pricingTemplates.find(
    (item) => item.id === templateId && item.itemType === "MATERIAL_ITEM",
  );
  if (!template) return { ...current, templateId: "" };

  const material = materials.find((item) => item.id === template.materialId);
  return {
    ...current,
    templateId,
    materialId: template.materialId ?? "",
    name: template.name,
    description: template.description ?? "",
    unit: template.unit,
    estimatedUnitCost: String(template.internalCost),
    source: material && material.availableStock > 0 ? "STOCK_AND_PURCHASE" : "PURCHASE",
  };
}

export function applyCategoryTemplateToForm({
  current,
  templateId,
  budgetCategories,
  pricingTemplates,
}: {
  readonly current: CategoryPlanFormState;
  readonly templateId: string;
  readonly budgetCategories: readonly ProjectPlanBudgetCategory[];
  readonly pricingTemplates: readonly PricingTemplateOption[];
}): CategoryPlanFormState {
  const template = pricingTemplates.find((item) => item.id === templateId);
  if (
    !template ||
    (template.itemType !== "WORK_PACKAGE" && template.itemType !== "SUBCON_PACKAGE")
  ) {
    return { ...current, templateId: "" };
  }

  const categoryCode = template.itemType === "WORK_PACKAGE" ? "TUKANG" : "SUBCON";
  const category = budgetCategories.find((item) => item.code === categoryCode);

  return {
    ...current,
    templateId,
    projectBudgetCategoryId: category?.id ?? current.projectBudgetCategoryId,
    vendorId: template.defaultVendorId ?? "",
    name: template.name,
    scopeDescription: template.description ?? "",
    unit: template.unit,
    estimatedUnitCost: String(template.internalCost),
  };
}

export function buildRapFormFromItem(item: RapItemView): RapFormState {
  return {
    templateId: "",
    materialId: item.materialId ?? "",
    area: item.area,
    name: item.name,
    description: item.description ?? "",
    requiredQuantity: item.requiredQuantity,
    bufferQuantity: item.bufferQuantity,
    unit: item.unit,
    estimatedUnitCost: item.estimatedUnitCost,
    source: item.source as RapFormState["source"],
    internalNote: item.internalNote ?? "",
  };
}

export function buildNewCategoryPlanForm({
  categoryCode,
  budgetCategories,
}: {
  readonly categoryCode: "TUKANG" | "SUBCON";
  readonly budgetCategories: readonly ProjectPlanBudgetCategory[];
}): CategoryPlanFormState {
  const category = budgetCategories.find((item) => item.code === categoryCode);
  return {
    ...emptyCategoryPlanForm,
    projectBudgetCategoryId: category?.id ?? "",
    unit: categoryCode === "SUBCON" ? "paket" : "ls",
  };
}

export function buildCategoryPlanFormFromItem(
  item: ProjectCategoryPlanItemView,
): CategoryPlanFormState {
  return {
    templateId: "",
    projectBudgetCategoryId: item.projectBudgetCategoryId,
    vendorId: item.vendorId ?? "",
    name: item.name,
    scopeDescription: item.scopeDescription ?? "",
    area: item.area,
    quantity: item.quantity,
    unit: item.unit,
    estimatedUnitCost: item.estimatedUnitCost,
    internalNote: item.internalNote ?? "",
  };
}

function getPlanItemsByCategory(
  categoryPlanItems: readonly ProjectCategoryPlanItemView[],
  expenseCategoryCode: "TUKANG" | "SUBCON",
): ProjectCategoryPlanItemView[] {
  return categoryPlanItems
    .filter(
      (item) =>
        item.expenseCategoryCode === expenseCategoryCode &&
        !["SUPERSEDED", "CANCELLED"].includes(item.status),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
