import type { ManualQuotationLine, RabEstimateView, RabItemView } from "../types/rap-rab-types";
import type { RabBundleForm, RabChangeOrderForm } from "../types/rab-drawer-types";
import { buildManualQuotationLines } from "../utils/rab-manager-utils";

export function buildGenerateRabPayload({
  projectId,
  selectedRapQuotationIds,
  selectedCategoryQuotationIds,
  manualQuotationLine,
}: {
  readonly projectId: string;
  readonly selectedRapQuotationIds: readonly string[];
  readonly selectedCategoryQuotationIds: readonly string[];
  readonly manualQuotationLine: ManualQuotationLine;
}) {
  return {
    projectId,
    projectRapItemIds: [...selectedRapQuotationIds],
    projectCategoryPlanItemIds: [...selectedCategoryQuotationIds],
    manualLines: buildManualQuotationLines(manualQuotationLine),
    title: "Client Estimate / Quotation",
  };
}

export function buildRabItemUpdatePayload(draft: RabItemView) {
  return {
    clientLabel: draft.clientLabel,
    description: draft.description || undefined,
    quantity: Number(draft.quantity),
    unit: draft.unit,
    unitPrice: Number(draft.unitPrice),
    displayOrder: Number(draft.displayOrder),
    isHidden: draft.isHidden,
    isBundle: draft.isBundle,
  };
}

export function buildManualRabItemPayload({
  rabEstimate,
  manualQuotationLine,
}: {
  readonly rabEstimate: RabEstimateView;
  readonly manualQuotationLine: ManualQuotationLine;
}) {
  return {
    rabEstimateId: rabEstimate.id,
    clientLabel: manualQuotationLine.clientLabel.trim(),
    description: manualQuotationLine.description.trim() || undefined,
    quantity: Number(manualQuotationLine.quantity),
    unit: manualQuotationLine.unit.trim(),
    unitPrice: Number(manualQuotationLine.unitPrice),
  };
}

export function buildBundleCommonPayload(bundleForm: RabBundleForm) {
  return {
    clientLabel: bundleForm.clientLabel.trim(),
    description: bundleForm.description.trim() || undefined,
    quantity: Number(bundleForm.quantity),
    unit: bundleForm.unit.trim(),
    unitPrice: Number(bundleForm.unitPrice),
  };
}

export function buildChangeOrderPayload({
  baselineApprovedRabId,
  rabEstimate,
  changeOrderForm,
}: {
  readonly baselineApprovedRabId: string;
  readonly rabEstimate: RabEstimateView;
  readonly changeOrderForm: RabChangeOrderForm;
}) {
  return {
    baseRabEstimateId: baselineApprovedRabId,
    revisedRabEstimateId: rabEstimate.id,
    reason: changeOrderForm.reason,
    scopeSummary: changeOrderForm.scopeSummary,
  };
}

export function buildClientConfirmationPayload({
  changeOrderId,
  changeOrderForm,
}: {
  readonly changeOrderId: string;
  readonly changeOrderForm: RabChangeOrderForm;
}) {
  return {
    changeOrderId,
    confirmedAt: new Date(changeOrderForm.clientConfirmedAt),
    confirmationReference: changeOrderForm.clientReference,
  };
}
