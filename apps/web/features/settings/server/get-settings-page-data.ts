import "server-only";

import { getAdministrationOverview } from "@/app/actions/administration";
import {
  getInitialStockCandidates,
  getInventoryOpeningBatches,
} from "@/app/actions/material/opening-inventory";
import { getOrganizationSetupOverview } from "@/app/actions/organization-setup";
import { getPricingTemplates } from "@/app/actions/settings/pricing-library";
import { getApprovalThresholdSettings } from "@/app/actions/settings/approval-thresholds";
import { getSettingsOverview } from "@/app/actions/settings/system";
import type { AdministrationOverview } from "@/app/actions/administration";
import type {
  InitialStockCandidate,
  InventoryOpeningBatchView,
} from "@/app/actions/material/opening-inventory";
import type { PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import type { ApprovalThresholdSettings } from "@/server/usecases/settings/approval-thresholds";
import type { SettingsOverview } from "@/app/actions/settings/system";
import type { OrganizationSetupOverview } from "@atria/core/onboarding/organization-setup";
import type { SettingsTab } from "@/features/settings/utils/settings-tabs-config";

export type SettingsPageData =
  | {
      readonly status: "ready";
      readonly overview: SettingsOverview;
      readonly pricingTemplates: readonly PricingTemplateRow[];
      readonly administration: AdministrationOverview | null;
      readonly setup: OrganizationSetupOverview | null;
      readonly initialStock: readonly InitialStockCandidate[];
      readonly openingBatches: readonly InventoryOpeningBatchView[];
      readonly approvalThresholds: ApprovalThresholdSettings | null;
    }
  | {
      readonly status: "unauthorized" | "restricted" | "error";
      readonly message: string;
      readonly source: "settings" | "library";
    };

export async function getSettingsPageData(
  input: {
    readonly activeTab?: SettingsTab;
    readonly flow?: string;
  } = {},
): Promise<SettingsPageData> {
  const loadInitialStock = input.activeTab === "readiness" && input.flow === "initial-stock";
  const [
    settings,
    templates,
    administration,
    setup,
    initialStock,
    openingBatches,
    approvalThresholds,
  ] = await Promise.all([
    getSettingsOverview(),
    getPricingTemplates(true),
    getAdministrationOverview(),
    getOrganizationSetupOverview(),
    loadInitialStock
      ? getInitialStockCandidates()
      : Promise.resolve({ success: true as const, data: [] as readonly InitialStockCandidate[] }),
    loadInitialStock
      ? getInventoryOpeningBatches()
      : Promise.resolve({
          success: true as const,
          data: [] as readonly InventoryOpeningBatchView[],
        }),
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
    setup: setup.success ? setup.data : null,
    initialStock: initialStock.success ? initialStock.data : [],
    openingBatches: openingBatches.success ? openingBatches.data : [],
    approvalThresholds: approvalThresholds.success ? approvalThresholds.data : null,
  };
}
