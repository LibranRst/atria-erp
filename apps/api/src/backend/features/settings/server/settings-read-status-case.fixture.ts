import assert from "node:assert/strict";
import { mock } from "bun:test";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { SettingsOverview } from "@backend/app/actions/settings/system";

const overview: SettingsOverview = {
  roleName: "OWNER",
  permissions: {
    canManageBudgetSettings: true,
    canManageExpenseCategories: true,
    canManageItemLibrary: true,
    canManageMaterialSettings: true,
    canManageUsers: true,
    canManageVendors: true,
  },
  budgetAllocationSetting: null,
  expenseCategories: [],
  itemLibrary: [],
  materialCategories: [],
  vendors: [],
  inventoryLocations: [],
  materials: [],
};
let mode: "failure" | "denied" | "empty" = "failure";
let openingReads = 0;
function failed<T>(): ActionResponse<T> {
  return {
    success: false,
    error: {
      code: mode === "denied" ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
      message: mode === "denied" ? "Akses sumber dibatasi." : "Sumber gagal dibaca.",
    },
  };
}
mock.module("@backend/app/actions/settings/system", () => ({
  getSettingsOverview: async () => ({ success: true, data: overview }),
}));
mock.module("@backend/app/actions/settings/pricing-library", () => ({
  getPricingTemplates: async () => ({ success: true, data: [] }),
}));
mock.module("@backend/app/actions/administration", () => ({
  getAdministrationOverview: async () => {
    if (mode === "failure") throw new Error("Synthetic database outage");
    return failed();
  },
}));
mock.module("@backend/app/actions/organization-setup", () => ({
  getOrganizationSetupOverview: async () => failed(),
}));
mock.module("@backend/app/actions/material/opening-inventory", () => ({
  getInitialStockCandidates: async () => {
    openingReads += 1;
    return mode === "empty" ? { success: true, data: [] } : failed();
  },
  getInventoryOpeningBatches: async () => {
    openingReads += 1;
    if (mode === "failure") throw new Error("Synthetic query rejection");
    return mode === "empty" ? { success: true, data: [] } : failed();
  },
}));
mock.module("@backend/app/actions/settings/approval-thresholds", () => ({
  getApprovalThresholdSettings: async () => failed(),
}));
const { getSettingsPageData } = await import("./get-settings-page-data");
const failedPage = await getSettingsPageData({ activeTab: "readiness", flow: "initial-stock" });
assert.equal(failedPage.status, "ready");
if (failedPage.status !== "ready")
  throw new Error("Source errors remain local to the owning module");
assert.equal(failedPage.sources.administration.status, "unavailable");
assert.equal(failedPage.sources.setup.status, "unavailable");
assert.equal(failedPage.sources.initialStock.status, "unavailable");
assert.equal(failedPage.sources.openingBatches.status, "unavailable");
assert.equal(failedPage.sources.approvalThresholds.status, "unavailable");
assert(
  !JSON.stringify(failedPage).includes("Synthetic"),
  "Raw rejected-query detail is not exposed",
);
mode = "denied";
const denied = await getSettingsPageData({ activeTab: "readiness", flow: "initial-stock" });
assert(denied.status === "ready");
assert.equal(denied.sources.administration.status, "restricted");
assert.equal(denied.sources.initialStock.status, "restricted");
mode = "empty";
const empty = await getSettingsPageData({ activeTab: "readiness", flow: "initial-stock" });
assert(empty.status === "ready");
assert.equal(empty.sources.initialStock.status, "ready");
assert.equal(empty.sources.openingBatches.status, "ready");
assert.deepEqual(empty.openingBatches, []);
const before = openingReads;
const normal = await getSettingsPageData({ activeTab: "financial" });
assert(normal.status === "ready");
assert.equal(normal.sources.initialStock.status, "not-requested");
assert.equal(openingReads, before, "Ordinary Settings do not eagerly read stock history");
console.log("Settings source status passed");
