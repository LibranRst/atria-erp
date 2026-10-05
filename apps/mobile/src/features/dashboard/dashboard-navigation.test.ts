import { expect, test } from "bun:test";
import { parseDashboardTab } from "./dashboard-navigation";
test("deep-link tab tidak menawarkan approval yang tidak diizinkan", () => {
  expect(parseDashboardTab("approvals", [])).toBe("overview");
  expect(parseDashboardTab("approvals", ["view:approval_queue"])).toBe("approvals");
  expect(parseDashboardTab("accounts", [])).toBe("accounts");
  expect(parseDashboardTab("unknown", [])).toBe("overview");
});
