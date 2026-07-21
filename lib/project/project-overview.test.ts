import { describe, expect, test } from "bun:test";
import { buildProjectOverviewActions } from "./project-overview";

describe("project overview actions", () => {
  test("prioritizes incomplete RAP and RAB during setup", () => {
    const actions = buildProjectOverviewActions({
      hasRap: false,
      rapStatus: null,
      rapSetupStage: null,
      hasApprovedRab: false,
      hasRabDraft: false,
      criticalCategoryNames: [],
      shortageCount: 0,
      overdueInvoiceCount: 0,
      overdueVendorBillCount: 0,
    });
    expect(actions.map((item) => item.id)).toEqual(["create-rap", "approve-rab"]);
  });

  test("returns no actions for a healthy ready project", () => {
    const actions = buildProjectOverviewActions({
      hasRap: true,
      rapStatus: "LOCKED",
      rapSetupStage: "MATERIAL",
      hasApprovedRab: true,
      hasRabDraft: false,
      criticalCategoryNames: [],
      shortageCount: 0,
      overdueInvoiceCount: 0,
      overdueVendorBillCount: 0,
    });
    expect(actions).toHaveLength(0);
  });

  test("caps operational risks to three in defined priority order", () => {
    const actions = buildProjectOverviewActions({
      hasRap: true,
      rapStatus: "LOCKED",
      rapSetupStage: "COMPLETE",
      hasApprovedRab: true,
      hasRabDraft: false,
      criticalCategoryNames: ["Material"],
      shortageCount: 4,
      overdueInvoiceCount: 1,
      overdueVendorBillCount: 1,
    });
    expect(actions.map((item) => item.id)).toEqual(["budget-risk", "material-shortage", "overdue"]);
  });
});
