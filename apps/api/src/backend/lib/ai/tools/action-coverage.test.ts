import { describe, test, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { AI_CAPABILITIES } from "./capability-catalog";

const root = path.resolve(import.meta.dir, "../../../../../../..");
const registry = readFileSync(
  path.join(root, "apps/api/src/backend/server/web-rpc/registry.ts"),
  "utf8",
);
const operationBlock = registry.split("const operations = {")[1]?.split("\n};")[0] ?? "";
const operations = Array.from(
  operationBlock.matchAll(/^\s*"([^"]+)":/gm),
  (match) => match[1],
).sort();
const matrix = readFileSync(path.join(root, "docs/06-technical/AI_ACTION_COVERAGE.md"), "utf8");
const rows = Array.from(matrix.matchAll(/^\| `([^`]+)`\s*\| ([^|]+)\| ([^|]+)\|$/gm), (match) => ({
  operation: match[1],
  status: match[2].trim(),
  route: match[3].trim(),
}));
const actions = path.join(root, "apps/api/src/backend/app/actions/ai");
const confirmations = new Set(
  readdirSync(actions)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .flatMap((name) =>
      Array.from(
        readFileSync(path.join(actions, name), "utf8").matchAll(
          /export async function (confirmAi\w+)/g,
        ),
        (match) => match[1],
      ),
    ),
);
describe("AI coverage inventory consistency", () => {
  test("every fixed registered operation has exactly one row, with no stale operations", () => {
    expect(operations.length).toBeGreaterThan(300);
    expect(rows.map((row) => row.operation).sort()).toEqual(operations);
    expect(new Set(rows.map((row) => row.operation)).size).toBe(rows.length);
  });
  test("supported routes name real model proposal tools and real human confirmation operations", () => {
    const missing: string[] = [];
    for (const row of rows.filter(
      (item) => item.status === "Supported" || item.status === "Partial support",
    )) {
      for (const tool of row.route.match(/\bpropose[A-Z]\w+/g) ?? [])
        if (!AI_CAPABILITIES[tool] || AI_CAPABILITIES[tool].mode !== "proposal")
          missing.push(`${row.operation}: ${tool}`);
      for (const name of row.route.match(/\bconfirmAi\w+/g) ?? [])
        if (!confirmations.has(name)) missing.push(`${row.operation}: ${name}`);
    }
    expect(missing).toEqual([]);
  });
  test("operational Settings routes are supported with human confirmation while security infrastructure remains separate", () => {
    for (const operation of [
      "app/actions/settings/approval-thresholds.updateApprovalThresholds",
      "app/actions/settings/system-budget-expense.updateExpenseCategoryDetails",
      "app/actions/settings/system-budget-expense.updateExpenseCategorySetting",
    ]) {
      const row = rows.find((row) => row.operation === operation);
      expect(row?.status).toBe("Supported");
      expect(row?.route).toContain("confirmAiFinanceInputProposal");
    }
  });
  test("completed business routes and infrastructure/legacy subsets are labelled", () => {
    for (const row of rows)
      expect([
        "Supported",
        "Partial support",
        "Legacy/manual",
        "Infrastructure/manual",
        "Manual only",
        "Gap",
        "Read/preview adapter",
        "Chat infrastructure",
      ]).toContain(row.status);
    for (const operation of [
      "app/actions/material/inventory-movements.adjustMaterialStock",
      "app/actions/material/inventory.adjustMaterialStock",
    ]) {
      const row = rows.find((entry) => entry.operation === operation);
      expect(row?.status).toBe("Supported");
      expect(row?.route).toContain("proposeStockCorrection");
      expect(row?.route).toContain("confirmAiProcurementWarehouseProposal");
    }
    expect(
      rows.find(
        (row) => row.operation === "app/actions/finance/create-client-invoice.createClientInvoice",
      )?.status,
    ).toBe("Supported");
    expect(
      rows.find((row) => row.operation === "app/actions/project/budget.createBudgetItem")?.status,
    ).toBe("Legacy/manual");
  });
});
