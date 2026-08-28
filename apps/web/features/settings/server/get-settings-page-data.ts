import "server-only";

import { getAdministrationOverview, getProductionReadiness } from "@/app/actions/administration";
import {
  getInitialStockCandidates,
  getInventoryOpeningBatches,
} from "@/app/actions/material/opening-inventory";
import { getOwnerOnboardingOverview } from "@/app/actions/onboarding";
import { getPricingTemplates } from "@/app/actions/settings/pricing-library";
import { getApprovalThresholdSettings } from "@/app/actions/settings/approval-thresholds";
import { getSettingsOverview } from "@/app/actions/settings/system";
import type { AdministrationOverview, ProductionReadinessItem } from "@/app/actions/administration";
import type {
  InitialStockCandidate,
  InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import type { ApprovalThresholdSettings } from "@/server/usecases/settings/approval-thresholds";
import type { SettingsOverview } from "@/app/actions/settings/system";
import type { OwnerOnboardingOverview } from "@atria/core/onboarding/owner-onboarding";

export type SettingsPageData =
  | {
      readonly status: "ready";
      readonly overview: SettingsOverview;
      readonly pricingTemplates: readonly PricingTemplateRow[];
      readonly administration: AdministrationOverview | null;
      readonly readiness: readonly ProductionReadinessItem[];
      readonly onboarding: OwnerOnboardingOverview | null;
      readonly initialStock: readonly InitialStockCandidate[];
      readonly openingBatches: readonly InventoryOpeningBatchView[];
      readonly approvalThresholds: ApprovalThresholdSettings | null;
    }
  | {
      readonly status: "unauthorized" | "restricted" | "error";
      readonly message: string;
      readonly source: "settings" | "library";
    };

export async function getSettingsPageData(): Promise<SettingsPageData> {
  const [
    settings,
    templates,
    administration,
    readiness,
    onboarding,
    initialStock,
    openingBatches,
    approvalThresholds,
  ] = await Promise.all([
    getSettingsOverview(),
    getPricingTemplates(true),
    getAdministrationOverview(),
    getProductionReadiness(),
    getOwnerOnboardingOverview(),
    getInitialStockCandidates(),
    getInventoryOpeningBatches(),
    getApprovalThresholdSettings(),
  ]);

  if (!settings.success) {
    return {
      status:
        settings.error.code === "UNAUTHORIZED"
          ? "unauthorized"
          : settings.error.code === "FORBIDDEN"
            ? "restricted"
            : "error",
      message: settings.error.message,
      source: "settings",
    };
  }

  if (!templates.success) {
    return {
      status: templates.error.code === "UNAUTHORIZED" ? "unauthorized" : "error",
      message: templates.error.message,
      source: "library",
    };
  }

  return {
    status: "ready",
    overview: settings.data,
    pricingTemplates: templates.data,
    administration: administration.success ? administration.data : null,
    readiness: readiness.success ? readiness.data : [],
    onboarding: onboarding.success ? onboarding.data : null,
    initialStock: initialStock.success ? initialStock.data : [],
    openingBatches: openingBatches.success ? openingBatches.data : [],
    approvalThresholds: approvalThresholds.success ? approvalThresholds.data : null,
  };
}
