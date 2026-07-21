import type {
  ProjectCategoryPlanItemView,
  RapSetupStage,
  RapView,
} from "../shared/rap-rab-manager";

export const RAP_SETUP_STAGES: readonly RapSetupStage[] = [
  "MATERIAL",
  "TUKANG",
  "SUBCON",
  "REVIEW",
];

export function getRapSetupStageLabel(stage: RapSetupStage): string {
  if (stage === "MATERIAL") return "Material";
  if (stage === "TUKANG") return "Tukang";
  if (stage === "SUBCON") return "Subcon";
  return "Review Akhir";
}

export function getRapSetupStageNumber(stage: RapSetupStage): number {
  return RAP_SETUP_STAGES.indexOf(stage) + 1;
}

export function isRapSetupStageUnlocked({
  stageIndex,
  rap,
}: {
  readonly stageIndex: number;
  readonly rap: RapView;
}): boolean {
  return stageIndex <= RAP_SETUP_STAGES.indexOf(rap.setupStage as RapSetupStage);
}

export function sumPackageCost(items: readonly ProjectCategoryPlanItemView[]): number {
  return items.reduce((sum, item) => sum + Number(item.estimatedTotalCost), 0);
}

export function isPackageScopeReady({
  skipped,
  items,
}: {
  readonly skipped: boolean;
  readonly items: readonly ProjectCategoryPlanItemView[];
}): boolean {
  return skipped || (items.length > 0 && !items.some((item) => item.status === "DRAFT"));
}
