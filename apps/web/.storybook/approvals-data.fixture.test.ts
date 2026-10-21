import { expect, test } from "bun:test";
import {
  APPROVALS_FIXTURE_ITEMS,
  approvalsFixtureData,
  approvalsFixturePermissions,
} from "./approvals-data.fixture";
import {
  approveFieldRequest,
  approveVendorPayment,
  decideInventoryOpening,
  releaseApprovalsFixtureDecisions,
  setApprovalsFixtureDecisionMode,
} from "./approvals-actions.fixture";

test("Approval preview contains complete multi-page collections with all three decision types and exact cents", () => {
  expect(APPROVALS_FIXTURE_ITEMS).toHaveLength(36);
  for (const type of ["project_cost", "vendor_payment", "inventory_opening"] as const) {
    expect(APPROVALS_FIXTURE_ITEMS.filter((item) => item.type === type)).toHaveLength(12);
  }
  expect(APPROVALS_FIXTURE_ITEMS.some((item) => item.priority === "CRITICAL")).toBe(true);
  expect(APPROVALS_FIXTURE_ITEMS.some((item) => item.priority === "WARNING")).toBe(true);
  expect(APPROVALS_FIXTURE_ITEMS.some((item) => item.priority === "NORMAL")).toBe(true);
  expect(APPROVALS_FIXTURE_ITEMS.some((item) => !Number.isInteger(item.amount))).toBe(true);
  expect(new Set(APPROVALS_FIXTURE_ITEMS.map((item) => item.id)).size).toBe(36);
});

test("Opening balances and inventory purchases do not fabricate budget realization", () => {
  for (const item of APPROVALS_FIXTURE_ITEMS) {
    if (item.type === "inventory_opening") {
      expect(item.consumesBudgetActual).toBe(false);
      expect(item.allocatedAmount).toBe(0);
      expect(item.actualSpent).toBe(0);
      expect(item.inventoryItems.reduce((sum, row) => sum + row.totalValue, 0)).toBe(item.amount);
    }
  }
  expect(
    APPROVALS_FIXTURE_ITEMS.some(
      (item) => item.type === "vendor_payment" && !item.consumesBudgetActual,
    ),
  ).toBe(true);
});

test("Synthetic queue is supplied in priority order before any table pagination", () => {
  expect(APPROVALS_FIXTURE_ITEMS.slice(0, 2).every((item) => item.budgetOverrun)).toBe(true);
  expect(APPROVALS_FIXTURE_ITEMS[0]?.id).toBe("adf10000-0000-4000-8000-000000000001");
  const priorities = APPROVALS_FIXTURE_ITEMS.map((item) => item.priority);
  const firstWarning = priorities.indexOf("WARNING");
  const firstNormal = priorities.indexOf("NORMAL");
  expect(firstWarning).toBeGreaterThan(1);
  expect(firstNormal).toBeGreaterThan(firstWarning);
  expect(priorities.slice(0, firstWarning).every((priority) => priority === "CRITICAL")).toBe(true);
  expect(
    priorities.slice(firstWarning, firstNormal).every((priority) => priority === "WARNING"),
  ).toBe(true);
  expect(priorities.slice(firstNormal).every((priority) => priority === "NORMAL")).toBe(true);
});

test("Limited queue previews mirror server data visibility and action permissions independently", () => {
  expect(
    approvalsFixtureData("stock-only").every((item) => item.type === "inventory_opening"),
  ).toBe(true);
  expect(approvalsFixturePermissions("stock-only")).toContain("approve:opening_inventory");
  expect(approvalsFixturePermissions("stock-only")).not.toContain("approve:cost");
  expect(approvalsFixtureData("read-only")).toHaveLength(36);
  expect(approvalsFixturePermissions("read-only")).not.toContain("approve:cost");
  expect(approvalsFixturePermissions("read-only")).not.toContain("approve:opening_inventory");
  expect(approvalsFixtureData("self-override")[0]?.canEmergencyOverride).toBe(true);
  for (const scenario of ["empty", "source-error", "restricted"] as const)
    expect(approvalsFixtureData(scenario)).toEqual([]);
});

test("All visual decision actions fail explicitly and pending decisions can be safely released", async () => {
  setApprovalsFixtureDecisionMode("failure");
  for (const decide of [approveFieldRequest, approveVendorPayment, decideInventoryOpening]) {
    expect(await decide()).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  }
  setApprovalsFixtureDecisionMode("pending");
  let settled = false;
  const response = approveFieldRequest().then((result) => {
    settled = true;
    return result;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  releaseApprovalsFixtureDecisions();
  expect(await response).toMatchObject({ success: false });
  setApprovalsFixtureDecisionMode("failure");
});
