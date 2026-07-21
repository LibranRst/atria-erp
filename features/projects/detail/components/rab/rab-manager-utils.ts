import { calculateQuotationTotal } from "@/lib/project/quotation-total";
import type {
  ManualQuotationLine,
  ProjectCategoryPlanItemView,
  RabBundleView,
  RabEstimateView,
  RabItemView,
  RabRevisionHistoryView,
  RapView,
} from "../shared/rap-rab-types";
import type { RabBundleForm, RabChangeOrderForm } from "./rab-drawer-types";

export const emptyManualQuotationLine: ManualQuotationLine = {
  clientLabel: "",
  description: "",
  quantity: "1",
  unit: "ls",
  unitPrice: "",
};

export const emptyRabBundleForm: RabBundleForm = {
  clientLabel: "",
  description: "",
  quantity: "1",
  unit: "paket",
  unitPrice: "",
  itemIds: [],
};

export function createEmptyRabChangeOrderForm(): RabChangeOrderForm {
  return {
    reason: "",
    scopeSummary: "",
    clientReference: "",
    clientConfirmedAt: new Date().toISOString().slice(0, 10),
  };
}

export interface RabManagerDerivedValues {
  readonly canApproveRab: boolean;
  readonly canManageRab: boolean;
  readonly visibleRabValue: number;
  readonly approvedBaseline: RabRevisionHistoryView | null;
  readonly isRevisionDraft: boolean;
  readonly selectedQuotationSourceCount: number;
  readonly sortedRabItems: RabItemView[];
}

export function getInitialSelectedRapQuotationIds(rap: RapView | null): string[] {
  return rap?.items.map((item) => item.id) ?? [];
}

export function getInitialSelectedCategoryQuotationIds(
  categoryPlanItems: readonly ProjectCategoryPlanItemView[],
): string[] {
  return categoryPlanItems
    .filter((item) => item.status === "ACTIVE" || item.status === "LOCKED")
    .map((item) => item.id);
}

export function getRabManagerDerivedValues({
  userRole,
  rabEstimate,
  revisionHistory,
  selectedRapQuotationIds,
  selectedCategoryQuotationIds,
  manualQuotationLine,
}: {
  readonly userRole: string;
  readonly rabEstimate: RabEstimateView | null;
  readonly revisionHistory: readonly RabRevisionHistoryView[];
  readonly selectedRapQuotationIds: readonly string[];
  readonly selectedCategoryQuotationIds: readonly string[];
  readonly manualQuotationLine: ManualQuotationLine;
}): RabManagerDerivedValues {
  const canApproveRab = userRole === "OWNER" || userRole === "FINANCE_ADMIN";
  const visibleRabValue = rabEstimate
    ? calculateQuotationTotal(rabEstimate.items, rabEstimate.bundles)
    : 0;
  const approvedBaseline =
    revisionHistory.find((estimate) => estimate.status === "APPROVED") ?? null;
  const hasManualQuotationLine = Boolean(manualQuotationLine.clientLabel.trim());

  return {
    canApproveRab,
    canManageRab: canApproveRab,
    visibleRabValue,
    approvedBaseline,
    isRevisionDraft:
      rabEstimate?.status === "DRAFT" && Boolean(rabEstimate.supersedesRabEstimateId),
    selectedQuotationSourceCount:
      selectedRapQuotationIds.length +
      selectedCategoryQuotationIds.length +
      (hasManualQuotationLine ? 1 : 0),
    sortedRabItems: getSortedRabItems(rabEstimate),
  };
}

export function buildManualQuotationLines(manualQuotationLine: ManualQuotationLine): {
  clientLabel: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}[] {
  return manualQuotationLine.clientLabel.trim()
    ? [
        {
          clientLabel: manualQuotationLine.clientLabel.trim(),
          description: manualQuotationLine.description.trim() || undefined,
          quantity: Number(manualQuotationLine.quantity),
          unit: manualQuotationLine.unit.trim(),
          unitPrice: Number(manualQuotationLine.unitPrice) || 0,
        },
      ]
    : [];
}

export function buildBundleFormFromBundle(bundle: RabBundleView): RabBundleForm {
  return {
    clientLabel: bundle.clientLabel,
    description: bundle.description ?? "",
    quantity: bundle.quantity,
    unit: bundle.unit,
    unitPrice: bundle.unitPrice,
    itemIds: [...bundle.itemIds],
  };
}

export function toggleBundleItemInForm({
  current,
  itemId,
  rabEstimate,
}: {
  readonly current: RabBundleForm;
  readonly itemId: string;
  readonly rabEstimate: RabEstimateView | null;
}): RabBundleForm {
  const itemIds = current.itemIds.includes(itemId)
    ? current.itemIds.filter((currentItemId) => currentItemId !== itemId)
    : [...current.itemIds, itemId];
  const suggestedTotal =
    rabEstimate?.items
      .filter((item) => itemIds.includes(item.id))
      .reduce((sum, item) => sum + Number(item.lineTotal), 0) ?? 0;

  return { ...current, itemIds, unitPrice: suggestedTotal.toFixed(2) };
}

function getSortedRabItems(rabEstimate: RabEstimateView | null): RabItemView[] {
  return rabEstimate?.items.slice().sort((a, b) => a.displayOrder - b.displayOrder) ?? [];
}
