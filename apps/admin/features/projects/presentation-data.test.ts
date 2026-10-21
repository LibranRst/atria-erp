import { expect, test } from "bun:test";
import { projectDetailFixture } from "./fixtures/projects";
import { projectDetailPayload } from "./presentation-data";

test("project presentation does not serialize unrelated loader domains or contact data", () => {
  const payload = projectDetailPayload(projectDetailFixture);
  expect(payload.projectBudgetDashboard).toBe(projectDetailFixture.projectBudgetDashboard);
  expect(payload.project.id).toBe(projectDetailFixture.project.id);
  for (const key of [
    "costs",
    "vendorBills",
    "vendorPayments",
    "bankAccounts",
    "stockMovements",
    "invoices",
    "materialMasterCatalog",
  ])
    expect(key in payload).toBe(false);
  for (const key of ["raps", "rabEstimates", "categoryPlanItems", "changeOrders", "budget"])
    expect(key in payload.project).toBe(false);
  expect(JSON.stringify(payload)).not.toContain("client@example.test");
  expect(JSON.stringify(payload)).not.toContain("pm@example.test");
});
