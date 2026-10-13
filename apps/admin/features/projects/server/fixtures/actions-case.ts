import { expect, mock } from "bun:test";
import type { AdminActor } from "@/lib/auth/server";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  FIXTURE_PROJECT_ID,
  FIXTURE_BUDGET_ID,
  projectBudgetFixture,
} from "../../fixtures/projects";

mock.module("server-only", () => ({}));
let permissions: AdminActor["permissions"] = ["use:desktop_admin"];
let backendFailure = false;
const calls: {
  readonly operation: string;
  readonly args: readonly unknown[];
  readonly cookies: boolean;
}[] = [];
const invalidations: string[] = [];
mock.module("@/lib/auth/server", () => ({
  requireAdminActor: async (): Promise<Pick<AdminActor, "permissions">> => ({ permissions }),
}));
mock.module("next/cache", () => ({
  revalidatePath: (path: string): void => {
    invalidations.push(path);
  },
}));
mock.module("@/lib/api/backend", () => ({
  callBackendAction: async (
    operation: string,
    args: readonly unknown[],
    options?: { readonly allowCookieWrites?: boolean },
  ): Promise<ActionResponse<unknown>> => {
    calls.push({ operation, args, cookies: options?.allowCookieWrites === true });
    if (backendFailure)
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Proyek di luar cakupan Anda." },
      };
    return {
      success: true,
      data: operation.includes("crud.") ? { id: FIXTURE_PROJECT_ID } : projectBudgetFixture,
    };
  },
}));

const actions = await import("../actions");
const input = {
  name: "Proyek uji",
  clientId: "client",
  projectManagerId: "pm",
  totalContractValue: 10_000_000,
};
expect((await actions.createProject(input)).success).toBe(false);
expect((await actions.approveBudget(FIXTURE_BUDGET_ID)).success).toBe(false);
expect(calls).toHaveLength(0);

permissions = ["use:desktop_admin", "create:project", "create:budget", "update:budget"];
expect((await actions.createProject({ ...input, name: "" })).success).toBe(false);
expect(
  (
    await actions.updateCategoryAllocation({
      projectBudgetCategoryId: "invalid",
      allocatedAmount: -1,
    })
  ).success,
).toBe(false);
expect(calls).toHaveLength(0);
expect((await actions.createProject(input)).success).toBe(true);
expect(calls[0]).toEqual({
  operation: "app/actions/project/crud.createProjectAction",
  args: [{ ...input, status: "DRAFT" }],
  cookies: true,
});
expect(invalidations).toEqual([
  "/projects",
  `/projects/${FIXTURE_PROJECT_ID}`,
  `/projects/${FIXTURE_PROJECT_ID}/budget`,
]);
expect(JSON.stringify(calls[0].args)).not.toContain("userId");
expect(JSON.stringify(calls[0].args)).not.toContain("permissions");

await actions.submitBudget(FIXTURE_BUDGET_ID);
expect(calls.at(-1)).toMatchObject({
  operation: "app/actions/project/excel-budget.submitProjectBudget",
  args: [FIXTURE_BUDGET_ID],
  cookies: true,
});
expect((await actions.approveBudget(FIXTURE_BUDGET_ID)).success).toBe(false);
permissions = ["use:desktop_admin", "approve:budget"];
expect((await actions.rejectBudget(FIXTURE_BUDGET_ID, " ")).success).toBe(false);
await actions.rejectBudget(FIXTURE_BUDGET_ID, "  Perbaiki alokasi  ");
expect(calls.at(-1)).toMatchObject({
  operation: "app/actions/project/excel-budget.rejectProjectBudget",
  args: [FIXTURE_BUDGET_ID, "Perbaiki alokasi"],
});

backendFailure = true;
const invalidationCount = invalidations.length;
const failure = await actions.approveBudget(FIXTURE_BUDGET_ID);
expect(failure).toEqual({
  success: false,
  error: { code: "FORBIDDEN", message: "Proyek di luar cakupan Anda." },
});
expect(invalidations).toHaveLength(invalidationCount);
console.log("project-actions: passed");
