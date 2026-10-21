import { getAdministrationOverview } from "@backend/app/actions/administration";
import {
  getInitialStockCandidates,
  getInventoryOpeningBatches,
} from "@backend/app/actions/material/opening-inventory";
import { getOrganizationSetupOverview } from "@backend/app/actions/organization-setup";
import { getPricingTemplates } from "@backend/app/actions/settings/pricing-library";
import { getApprovalThresholdSettings } from "@backend/app/actions/settings/approval-thresholds";
import { getSettingsOverview } from "@backend/app/actions/settings/system";
import type { AdministrationOverview } from "@backend/app/actions/administration";
import type {
  InitialStockCandidate,
  InventoryOpeningBatchView,
} from "@backend/app/actions/material/opening-inventory";
import type { PricingTemplateRow } from "@backend/app/actions/settings/pricing-library";
import type { ApprovalThresholdSettings } from "@backend/server/usecases/settings/approval-thresholds";
import type { SettingsOverview } from "@backend/app/actions/settings/system";
import type { OrganizationSetupOverview } from "@atria/core/onboarding/organization-setup";
import type { SettingsTab } from "@backend/features/settings/utils/settings-tabs-config";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { SettingsReadSource, SettingsReadSources } from "@atria/core/settings/read-sources";

async function readSource<T>(
  read: () => Promise<ActionResponse<T>>,
  message: string,
): Promise<ActionResponse<T>> {
  try {
    return await read();
  } catch (error: unknown) {
    const code =
      error instanceof Error && error.message.startsWith("FORBIDDEN")
        ? "FORBIDDEN"
        : error instanceof Error && error.message.startsWith("UNAUTHORIZED")
          ? "UNAUTHORIZED"
          : "INTERNAL_SERVER_ERROR";
    return { success: false, error: { code, message } };
  }
}

function sourceState<T>(result: ActionResponse<T>): SettingsReadSource {
  return result.success
    ? { status: "ready" }
    : {
        status:
          result.error.code === "FORBIDDEN"
            ? "restricted"
            : result.error.code === "UNAUTHORIZED"
              ? "unauthorized"
              : "unavailable",
        message: result.error.message,
      };
}

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
      readonly sources: SettingsReadSources;
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
    readSource(getSettingsOverview, "Pengaturan belum dapat dimuat. Coba lagi."),
    readSource(() => getPricingTemplates(true), "Library harga belum dapat dimuat. Coba lagi."),
    readSource(getAdministrationOverview, "Data administrasi belum dapat dimuat. Coba lagi."),
    readSource(getOrganizationSetupOverview, "Kesiapan organisasi belum dapat dimuat. Coba lagi."),
    loadInitialStock
      ? readSource(getInitialStockCandidates, "Daftar stok awal belum dapat dimuat. Coba lagi.")
      : Promise.resolve({ success: true as const, data: [] as readonly InitialStockCandidate[] }),
    loadInitialStock
      ? readSource(
          getInventoryOpeningBatches,
          "Pengajuan saldo awal belum dapat dimuat. Coba lagi.",
        )
      : Promise.resolve({
          success: true as const,
          data: [] as readonly InventoryOpeningBatchView[],
        }),
    readSource(getApprovalThresholdSettings, "Ambang persetujuan belum dapat dimuat. Coba lagi."),
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
      status:
        templates.error.code === "UNAUTHORIZED"
          ? "unauthorized"
          : templates.error.code === "FORBIDDEN"
            ? "restricted"
            : "error",
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
    sources: {
      administration: sourceState(administration),
      setup: sourceState(setup),
      initialStock: loadInitialStock ? sourceState(initialStock) : { status: "not-requested" },
      openingBatches: loadInitialStock ? sourceState(openingBatches) : { status: "not-requested" },
      approvalThresholds: sourceState(approvalThresholds),
    },
  };
}
