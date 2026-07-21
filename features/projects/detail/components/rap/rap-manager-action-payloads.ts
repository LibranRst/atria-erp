import type {
  CategoryPlanFormState,
  PricingTemplateOption,
  RapFormState,
  RapView,
} from "../shared/rap-rab-types";

export function buildCategoryPlanPayload({
  projectId,
  categoryPlanForm,
}: {
  readonly projectId: string;
  readonly categoryPlanForm: CategoryPlanFormState;
}) {
  return {
    projectId,
    projectBudgetCategoryId: categoryPlanForm.projectBudgetCategoryId,
    vendorId: categoryPlanForm.vendorId || undefined,
    name: categoryPlanForm.name,
    scopeDescription: categoryPlanForm.scopeDescription || undefined,
    area: categoryPlanForm.area,
    quantity: Number(categoryPlanForm.quantity),
    unit: categoryPlanForm.unit,
    estimatedUnitCost: Number(categoryPlanForm.estimatedUnitCost) || 0,
    internalNote: categoryPlanForm.internalNote || undefined,
  };
}

export function getCategoryPlanTemplateOverride({
  categoryPlanForm,
  pricingTemplates,
}: {
  readonly categoryPlanForm: CategoryPlanFormState;
  readonly pricingTemplates: readonly PricingTemplateOption[];
}): {
  readonly selectedTemplate: PricingTemplateOption | undefined;
  readonly overrideCost: number | undefined;
} {
  const selectedTemplate = pricingTemplates.find((item) => item.id === categoryPlanForm.templateId);
  const overrideCost =
    selectedTemplate && Number(categoryPlanForm.estimatedUnitCost) !== selectedTemplate.internalCost
      ? Number(categoryPlanForm.estimatedUnitCost)
      : undefined;

  return { selectedTemplate, overrideCost };
}

export function buildRapItemPayload({
  rap,
  rapForm,
}: {
  readonly rap: RapView;
  readonly rapForm: RapFormState;
}) {
  return {
    projectRapId: rap.id,
    materialId: rapForm.materialId || undefined,
    area: rapForm.area,
    name: rapForm.name,
    description: rapForm.description || undefined,
    requiredQuantity: Number(rapForm.requiredQuantity),
    bufferQuantity: Number(rapForm.bufferQuantity) || 0,
    unit: rapForm.unit,
    estimatedUnitCost: Number(rapForm.estimatedUnitCost) || 0,
    source: rapForm.source,
    internalNote: rapForm.internalNote || undefined,
  };
}

export function getRapTemplateOverride({
  rapForm,
  pricingTemplates,
}: {
  readonly rapForm: RapFormState;
  readonly pricingTemplates: readonly PricingTemplateOption[];
}): {
  readonly selectedTemplate: PricingTemplateOption | undefined;
  readonly overrideCost: number | undefined;
} {
  const selectedTemplate = pricingTemplates.find((item) => item.id === rapForm.templateId);
  const overrideCost =
    selectedTemplate && Number(rapForm.estimatedUnitCost) !== selectedTemplate.internalCost
      ? Number(rapForm.estimatedUnitCost)
      : undefined;

  return { selectedTemplate, overrideCost };
}
