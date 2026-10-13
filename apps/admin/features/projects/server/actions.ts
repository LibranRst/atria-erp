"use server";

import type { ActionResponse } from "@atria/core/types/action-response";
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "@atria/core/validations/project";
import {
  approveCanonicalProjectBudgetSchema,
  createProjectBudgetFromRatiosSchema,
  rejectCanonicalProjectBudgetSchema,
  updateProjectBudgetCategoryAllocationSchema,
  type CreateProjectBudgetFromRatiosInput,
  type UpdateProjectBudgetCategoryAllocationInput,
} from "@atria/core/validations/budget";
import { revalidatePath } from "next/cache";
import { callBackendAction } from "@/lib/api/backend";
import { requireAdminActor } from "@/lib/auth/server";
import type { ProjectBudget } from "../types";

function invalid<T>(message: string): ActionResponse<T> {
  return { success: false, error: { code: "VALIDATION_ERROR", message } };
}
function forbidden<T>(): ActionResponse<T> {
  return {
    success: false,
    error: { code: "FORBIDDEN", message: "Anda tidak memiliki izin untuk tindakan ini." },
  };
}
function refreshProject(projectId: string): void {
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/budget`);
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ActionResponse<{ id: string }>> {
  const actor = await requireAdminActor();
  if (!actor.permissions.includes("create:project")) return forbidden();
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success)
    return invalid(parsed.error.issues[0]?.message ?? "Data proyek tidak valid.");
  const result = await callBackendAction(
    "app/actions/project/crud.createProjectAction",
    [parsed.data],
    { allowCookieWrites: true },
  );
  if (result.success) refreshProject(result.data.id);
  return result;
}

export async function updateProject(
  input: UpdateProjectInput,
): Promise<ActionResponse<{ id: string }>> {
  const actor = await requireAdminActor();
  if (!actor.permissions.includes("update:budget")) return forbidden();
  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success)
    return invalid(parsed.error.issues[0]?.message ?? "Data proyek tidak valid.");
  const result = await callBackendAction(
    "app/actions/project/crud.updateProjectAction",
    [parsed.data],
    { allowCookieWrites: true },
  );
  if (result.success) refreshProject(result.data.id);
  return result;
}

export async function createBudget(
  input: CreateProjectBudgetFromRatiosInput,
): Promise<ActionResponse<ProjectBudget>> {
  const actor = await requireAdminActor();
  if (!actor.permissions.includes("create:budget")) return forbidden();
  const parsed = createProjectBudgetFromRatiosSchema.safeParse(input);
  if (!parsed.success)
    return invalid(parsed.error.issues[0]?.message ?? "Data budget tidak valid.");
  const result = await callBackendAction(
    "app/actions/project/excel-budget.createProjectBudgetFromRatios",
    [parsed.data],
    { allowCookieWrites: true },
  );
  if (result.success) refreshProject(result.data.projectId);
  return result;
}

export async function updateCategoryAllocation(
  input: UpdateProjectBudgetCategoryAllocationInput,
): Promise<ActionResponse<ProjectBudget>> {
  const actor = await requireAdminActor();
  if (!actor.permissions.includes("update:budget")) return forbidden();
  const parsed = updateProjectBudgetCategoryAllocationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "Alokasi tidak valid.");
  const result = await callBackendAction(
    "app/actions/project/excel-budget.updateProjectBudgetCategoryAllocation",
    [parsed.data],
    { allowCookieWrites: true },
  );
  if (result.success) refreshProject(result.data.projectId);
  return result;
}

export async function submitBudget(
  projectBudgetId: string,
): Promise<ActionResponse<ProjectBudget>> {
  const actor = await requireAdminActor();
  if (!actor.permissions.includes("update:budget")) return forbidden();
  const parsed = approveCanonicalProjectBudgetSchema.safeParse({ projectBudgetId });
  if (!parsed.success) return invalid("ID budget tidak valid.");
  const result = await callBackendAction(
    "app/actions/project/excel-budget.submitProjectBudget",
    [projectBudgetId],
    { allowCookieWrites: true },
  );
  if (result.success) refreshProject(result.data.projectId);
  return result;
}

export async function approveBudget(
  projectBudgetId: string,
): Promise<ActionResponse<ProjectBudget>> {
  const actor = await requireAdminActor();
  if (!actor.permissions.includes("approve:budget")) return forbidden();
  const parsed = approveCanonicalProjectBudgetSchema.safeParse({ projectBudgetId });
  if (!parsed.success) return invalid("ID budget tidak valid.");
  const result = await callBackendAction(
    "app/actions/project/excel-budget.approveProjectBudget",
    [projectBudgetId],
    { allowCookieWrites: true },
  );
  if (result.success) refreshProject(result.data.projectId);
  return result;
}

export async function rejectBudget(
  projectBudgetId: string,
  reason: string,
): Promise<ActionResponse<ProjectBudget>> {
  const actor = await requireAdminActor();
  if (!actor.permissions.includes("approve:budget")) return forbidden();
  const parsed = rejectCanonicalProjectBudgetSchema.safeParse({ projectBudgetId, reason });
  if (!parsed.success)
    return invalid(parsed.error.issues[0]?.message ?? "Alasan revisi tidak valid.");
  const result = await callBackendAction(
    "app/actions/project/excel-budget.rejectProjectBudget",
    [projectBudgetId, parsed.data.reason],
    { allowCookieWrites: true },
  );
  if (result.success) refreshProject(result.data.projectId);
  return result;
}
