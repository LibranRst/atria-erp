import { expect, test } from "bun:test";
import { buildCompanyBudgetTools, readCompanyBudgetPolicy } from "./company-budget-tools";
import { aiToolContextForRole } from "@backend/lib/testing/ai-tool-context";
import type { BudgetAllocationSnapshot } from "@backend/lib/budget/allocation-defaults";

const snapshot: BudgetAllocationSnapshot = {
  settingId: "setting-1",
  settingName: "Budget aktif",
  budgetCapRatio: 0.91,
  categories: [
    {
      expenseCategoryId: "material",
      code: "MATERIAL",
      name: "Material",
      ratioPercentage: 0.35,
      sortOrder: 1,
    },
  ],
};
const reader = {
  readAllocation: async (): Promise<BudgetAllocationSnapshot> => snapshot,
  readCompany: async (): Promise<{ name: string }> => ({ name: "Studio Contoh" }),
};
test("a denied tool result carries a failure marker for the chat tracer", async () => {
  const tools = buildCompanyBudgetTools({
    ...aiToolContextForRole("OWNER"),
    permissions: ["use:ai_chat"],
  });
  const policyTool = tools.getCompanyBudgetDefaults;
  if (policyTool.type !== undefined && policyTool.type !== "function")
    throw new Error("Expected function tool");
  const execute = policyTool.execute;
  if (!execute) throw new Error("Missing policy executor");
  const result = await execute({}, { toolCallId: "test-policy", messages: [], context: {} });
  expect(result).toMatchObject({
    status: "forbidden",
    error: "Peran Anda tidak memiliki akses ke Pengaturan Budget perusahaan.",
  });
});
test("company policy uses active Settings, its category ratios and actual company identity", async () => {
  const policy = await readCompanyBudgetPolicy(aiToolContextForRole("OWNER"), reader);
  expect(policy.status).toBe("configured");
  if (policy.status !== "configured") throw new Error("Expected configured policy");
  expect(policy.budgetCapRatio).toBe(0.91);
  expect(policy.targetGrossMarginPercentage).toBe(9);
  expect(policy.categories[0].ratioPercentage).toBe(0.35);
  expect(policy.companyName).toBe("Studio Contoh");
  expect(policy.source).toEqual({
    label: "Pengaturan Budget",
    href: "/settings/budget",
    settingId: "setting-1",
    settingName: "Budget aktif",
  });
});
test("permission denial cannot query company Settings", async () => {
  let reads = 0;
  const policy = await readCompanyBudgetPolicy(
    { ...aiToolContextForRole("OWNER"), permissions: ["use:ai_chat"] },
    {
      readAllocation: async (): Promise<BudgetAllocationSnapshot> => {
        reads++;
        return snapshot;
      },
      readCompany: reader.readCompany,
    },
  );
  expect(policy.status).toBe("forbidden");
  expect(reads).toBe(0);
});
test("fallback defaults cannot be advertised as a configured company policy", async () => {
  const policy = await readCompanyBudgetPolicy(aiToolContextForRole("OWNER"), {
    ...reader,
    readAllocation: async (): Promise<BudgetAllocationSnapshot> => ({
      ...snapshot,
      settingId: null,
      settingName: null,
    }),
  });
  expect(policy.status).toBe("unconfigured");
  expect(policy).not.toHaveProperty("targetGrossMarginPercentage");
});
test("read failures and invalid ratios never fabricate a margin", async () => {
  const context = aiToolContextForRole("OWNER");
  expect(
    (
      await readCompanyBudgetPolicy(context, {
        ...reader,
        readAllocation: async (): Promise<BudgetAllocationSnapshot> => {
          throw new Error("offline");
        },
      })
    ).status,
  ).toBe("unavailable");
  expect(
    (
      await readCompanyBudgetPolicy(context, {
        ...reader,
        readAllocation: async (): Promise<BudgetAllocationSnapshot> => ({
          ...snapshot,
          budgetCapRatio: NaN,
        }),
      })
    ).status,
  ).toBe("unavailable");
});
