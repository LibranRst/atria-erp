import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { mock } from "bun:test";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@backend/db/schema";
import { withTestRequest } from "@backend/lib/testing/request";
import type { Actor } from "@backend/server/actor";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { ProjectBudgetDashboard } from "@backend/app/actions/project/excel-budget-utils";

const postgres = new PGlite();
await postgres.exec(
  (await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))).join(";\n"),
);
const database = drizzle(postgres, { schema });
mock.module("@backend/db", () => ({ db: database }));
let sessionUser: { id: string; roleId: string } | null = null;
mock.module("@backend/lib/auth", () => ({
  auth: { api: { getSession: async () => (sessionUser ? { user: sessionUser } : null) } },
}));
const { buildProjectBudgetDashboard } =
  await import("@backend/app/actions/project/excel-budget-utils");
let sourceMode: "real" | "restricted" | "failure" | "throw" = "real";
mock.module("@backend/app/actions/project/excel-budget", () => ({
  getProjectBudgetDashboard: async (
    projectId: string,
  ): Promise<ActionResponse<ProjectBudgetDashboard>> => {
    if (sourceMode === "throw") throw new Error("Synthetic source failure");
    if (sourceMode === "failure")
      return {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "Synthetic source failure" },
      };
    if (sourceMode === "restricted")
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Synthetic restricted source" },
      };
    const budget = await buildProjectBudgetDashboard(projectId);
    return budget
      ? { success: true, data: budget }
      : { success: false, error: { code: "NOT_FOUND", message: "Budget belum tersedia" } };
  },
}));
const { getProjectListPageData } = await import("./get-project-list-page-data");
const { getProjectDetailData } =
  await import("@backend/features/projects/detail/server/get-project-detail-data");
const { getProjectFormBootstrap } =
  await import("@backend/server/usecases/project/project-form-bootstrap");
const { getProjectFormData } = await import("@backend/app/actions/project/crud");
const list = withTestRequest(getProjectListPageData);
const detail = withTestRequest(getProjectDetailData);
const bootstrap = withTestRequest(getProjectFormBootstrap);
const formData = withTestRequest(getProjectFormData);
const own = schema.INSTANCE_TENANT_ID;
const foreign = crypto.randomUUID();
const ids = {
  editorRole: crypto.randomUUID(),
  assignedRole: crypto.randomUUID(),
  deniedRole: crypto.randomUUID(),
  editor: crypto.randomUUID(),
  assigned: crypto.randomUUID(),
  inactive: crypto.randomUUID(),
  other: crypto.randomUUID(),
  client: crypto.randomUUID(),
  unrelatedClient: crypto.randomUUID(),
  foreignClient: crypto.randomUUID(),
  category: crypto.randomUUID(),
  budget: crypto.randomUUID(),
};
const projectIds: readonly string[] = Array.from({ length: 16 }, () => crypto.randomUUID());
const foreignProject = crypto.randomUUID();
const actor: Actor = {
  userId: ids.editor,
  roleId: ids.editorRole,
  roleName: "PORTFOLIO_EDITOR",
  permissions: ["view:budget", "create:project", "update:budget"],
  dataScope: "GLOBAL",
  name: "Editor",
  email: "editor@example.invalid",
  isActive: true,
  mustChangePassword: false,
  sessionId: "",
  developerActorUserId: null,
};
try {
  await database.insert(schema.tenant).values([
    { id: own, name: "Disposable", slug: "disposable" },
    { id: foreign, name: "Foreign", slug: "foreign" },
  ]);
  await database.insert(schema.role).values([
    { id: ids.editorRole, name: "PORTFOLIO_EDITOR", dataScope: "GLOBAL" },
    { id: ids.assignedRole, name: "PORTFOLIO_ASSIGNED", dataScope: "ASSIGNED" },
    { id: ids.deniedRole, name: "PORTFOLIO_DENIED", dataScope: "GLOBAL" },
  ]);
  await database
    .insert(schema.rolePermission)
    .values([
      ...actor.permissions.map((permissionKey) => ({ roleId: ids.editorRole, permissionKey })),
      { roleId: ids.assignedRole, permissionKey: "view:budget" },
    ]);
  await database.insert(schema.user).values([
    { id: ids.editor, roleId: ids.editorRole, name: "Editor", email: "editor@example.invalid" },
    {
      id: ids.assigned,
      roleId: ids.assignedRole,
      name: "Assigned",
      email: "assigned@example.invalid",
    },
    {
      id: ids.inactive,
      roleId: ids.assignedRole,
      name: "Former PM",
      email: "former@example.invalid",
      isActive: false,
    },
    { id: ids.other, roleId: ids.deniedRole, name: "Unassignable", email: "other@example.invalid" },
  ]);
  await database.insert(schema.client).values([
    { id: ids.client, name: "Own client", email: "client@example.invalid", phone: "0800000000" },
    {
      id: ids.unrelatedClient,
      name: "Unrelated client",
      email: "unrelated@example.invalid",
      phone: "0800000000",
    },
    {
      id: ids.foreignClient,
      tenantId: foreign,
      name: "Foreign client",
      email: "client@example.invalid",
      phone: "0800000000",
    },
  ]);
  await database.insert(schema.project).values([
    ...projectIds.map((id, index) => ({
      id,
      name: `Project ${index}`,
      clientId: index === 4 ? ids.foreignClient : ids.client,
      projectManagerId: index % 2 === 0 ? ids.assigned : ids.inactive,
      status: "ACTIVE",
      totalContractValue: index === 1 ? "0.00" : "100.50",
    })),
    {
      id: foreignProject,
      tenantId: foreign,
      name: "Foreign project",
      clientId: ids.foreignClient,
      projectManagerId: ids.assigned,
      status: "ACTIVE",
      totalContractValue: "999999.00",
    },
  ]);
  await database.insert(schema.projectBudgets).values([
    {
      id: ids.budget,
      projectId: projectIds[0],
      status: "APPROVED",
      contractValue: "100.50",
      internalBudget: "90.00",
      targetGrossAmount: "10.50",
      targetGrossPercentage: "10.4478",
    },
    { projectId: projectIds[1], status: "APPROVED", contractValue: "0.00", internalBudget: "0.00" },
    {
      projectId: projectIds[3],
      tenantId: foreign,
      contractValue: "999.00",
      internalBudget: "999.00",
    },
  ]);
  await database
    .insert(schema.expenseCategory)
    .values({ id: ids.category, code: "MATERIAL", name: "Material" });
  await database.insert(schema.projectBudgetCategory).values({
    projectBudgetId: ids.budget,
    expenseCategoryId: ids.category,
    allocatedAmount: "90.00",
    actualAmount: "60.25",
    paidAmount: "20.10",
    pendingAmount: "10.05",
    remainingAmount: "29.75",
    usedPercentage: "66.9444",
  });

  const all = await list(actor);
  assert.equal(all.status, "ready");
  if (all.status !== "ready") throw new Error("Expected ready");
  assert.equal(all.projects.length, 16, "complete collection is not capped to a visual page");
  assert.equal(
    all.projects.find((project) => project.id === projectIds[4])?.clientName,
    "-",
    "an attached foreign client cannot expose its name",
  );
  assert.deepEqual(all.clients, [
    { id: ids.client, name: "Own client" },
    { id: ids.unrelatedClient, name: "Unrelated client" },
  ]);
  assert.deepEqual(
    new Set(all.users.map((user) => user.id)),
    new Set([ids.assigned, ids.inactive]),
  );
  const measured = all.projects.find((project) => project.id === projectIds[0]);
  assert.equal(measured?.actualCost, 60.25);
  assert.equal(measured?.paidCost, 20.1);
  assert.equal(measured?.pendingCost, 10.05);
  assert.equal(measured?.remainingBudget, 29.75);
  assert.equal(measured?.projectedMarginAmount, 10.5);
  assert.equal(measured?.budgetId, ids.budget);
  const missing = all.projects.find((project) => project.id === projectIds[2]);
  assert.equal(missing?.budgetId, null);
  assert.equal(missing?.projectedMarginAmount, null);
  const zero = all.projects.find((project) => project.id === projectIds[1]);
  assert.ok(zero?.budgetId);
  assert.equal(zero.projectedMarginAmount, 0);
  assert.equal(
    all.projects.find((project) => project.id === projectIds[3])?.budgetId,
    null,
    "foreign budget is not a valid canonical source",
  );

  const assignedActor: Actor = {
    ...actor,
    userId: ids.assigned,
    roleId: ids.assignedRole,
    roleName: "PORTFOLIO_ASSIGNED",
    dataScope: "ASSIGNED",
    permissions: ["view:budget"],
  };
  const assigned = await list(assignedActor);
  assert.equal(assigned.status, "ready");
  if (assigned.status !== "ready") throw new Error("Expected assigned ready");
  assert.equal(assigned.projects.length, 8);
  assert.deepEqual(assigned.clients, []);
  assert.deepEqual(assigned.users, []);
  assert.equal((await list({ ...actor, permissions: [] })).status, "restricted");

  sessionUser = { id: ids.editor, roleId: ids.editorRole };
  const createBootstrap = await bootstrap(actor, {});
  assert.equal(createBootstrap.status, "ready");
  if (createBootstrap.status !== "ready") throw new Error("Expected create bootstrap");
  assert.deepEqual(createBootstrap.clients, all.clients);
  assert.deepEqual(createBootstrap.projectManagers, [{ id: ids.assigned, name: "Assigned" }]);
  const createForm = await formData();
  assert.equal(createForm.success, true);
  if (!createForm.success) throw new Error("Expected create form options");
  assert.deepEqual(createForm.data.clients, createBootstrap.clients);
  assert.deepEqual(createForm.data.users, createBootstrap.projectManagers);
  const editBootstrap = await bootstrap(actor, { projectId: projectIds[1] });
  assert.equal(editBootstrap.status, "ready");
  if (editBootstrap.status !== "ready") throw new Error("Expected edit bootstrap");
  assert.deepEqual(
    new Set(editBootstrap.projectManagers.map((user) => user.id)),
    new Set([ids.assigned, ids.inactive]),
  );
  assert.equal((await bootstrap(actor, { projectId: foreignProject })).status, "notFound");
  const updateOnlyActor: Actor = {
    ...assignedActor,
    permissions: ["view:budget", "update:budget"],
  };
  assert.equal((await bootstrap(updateOnlyActor, {})).status, "restricted");
  const updateOnlyBootstrap = await bootstrap(updateOnlyActor, { projectId: projectIds[0] });
  assert.equal(updateOnlyBootstrap.status, "ready");
  if (updateOnlyBootstrap.status !== "ready") throw new Error("Expected scoped update form");
  assert.deepEqual(updateOnlyBootstrap.clients, [{ id: ids.client, name: "Own client" }]);
  const updateOnlyList = await list(updateOnlyActor);
  assert.equal(updateOnlyList.status, "ready");
  if (updateOnlyList.status !== "ready") throw new Error("Expected scoped update list");
  assert.deepEqual(updateOnlyList.clients, [{ id: ids.client, name: "Own client" }]);
  const readyDetail = await detail(projectIds[0]);
  assert.equal(readyDetail.projectBudgetSource?.status, "ready");
  assert.equal(readyDetail.projectBudgetDashboard?.actualCost, measured?.actualCost);
  assert.equal(readyDetail.projectBudgetDashboard?.paidCost, measured?.paidCost);
  assert.equal(readyDetail.projectBudgetDashboard?.pendingCost, measured?.pendingCost);
  assert.equal(readyDetail.projectBudgetDashboard?.remainingBudget, measured?.remainingBudget);
  assert.equal(
    readyDetail.projectBudgetDashboard?.projectedMarginAmount,
    measured?.projectedMarginAmount,
  );
  assert.equal(
    readyDetail.projectBudgetDashboard?.projectedMarginPercentage,
    measured?.projectedMarginPercentage,
  );
  assert.equal(
    readyDetail.projectsForForms.find((project) => project.id === projectIds[3])?.canonicalBudgets
      ?.length,
    0,
  );
  assert.equal((await detail(projectIds[2])).projectBudgetSource?.status, "missing");
  assert.equal((await detail(projectIds[3])).projectBudgetSource?.status, "missing");
  assert.equal(
    (await detail(projectIds[4])).project.client,
    null,
    "foreign attached client details are withheld",
  );
  await assert.rejects(detail(foreignProject), /API_NOT_FOUND/);
  sourceMode = "failure";
  assert.equal((await detail(projectIds[0])).projectBudgetSource?.status, "unavailable");
  sourceMode = "throw";
  assert.equal((await detail(projectIds[0])).projectBudgetSource?.status, "unavailable");
  sourceMode = "restricted";
  assert.equal((await detail(projectIds[0])).projectBudgetSource?.status, "restricted");
  sourceMode = "real";
  sessionUser = { id: ids.assigned, roleId: ids.assignedRole };
  assert.equal((await bootstrap(assignedActor, {})).status, "restricted");
  assert.equal((await formData()).success, false);
  const assignedDetail = await detail(projectIds[0]);
  assert.deepEqual(assignedDetail.clients, []);
  assert.deepEqual(assignedDetail.projectManagers, []);
  assert.ok(
    assignedDetail.projectsForForms.every((project) => projectIds.indexOf(project.id) % 2 === 0),
  );
  await assert.rejects(detail(projectIds[1]), /API_REDIRECT/);
  sessionUser = { id: ids.other, roleId: ids.deniedRole };
  await assert.rejects(detail(projectIds[0]), /API_REDIRECT/);
  console.log("Project desktop reads passed");
} finally {
  await postgres.close();
}
