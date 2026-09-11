"use server";

import { resolveActor } from "@/server/actor";
import { createProjectUseCase } from "@/server/usecases/project/create-project";
import { getProjectFormBootstrap } from "@/server/usecases/project/project-form-bootstrap";
import { updateProjectUseCase } from "@/server/usecases/project/update-project";
import {
  assignProjectManagerUseCase,
  type AssignProjectManagerResult,
} from "@/server/usecases/project/assign-project-manager";
import type { ActionResponse } from "@atria/core/types/action-response";
import type {
  AssignProjectManagerInput,
  CreateProjectInput,
  UpdateProjectInput,
} from "@atria/core/validations/project";

export async function createProjectAction(
  input: CreateProjectInput,
): Promise<ActionResponse<{ id: string }>> {
  const actor = await resolveActor();
  if (!actor) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  return createProjectUseCase(actor, input);
}

export async function updateProjectAction(
  input: UpdateProjectInput,
): Promise<ActionResponse<{ id: string }>> {
  const actor = await resolveActor();
  if (!actor) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  return updateProjectUseCase(actor, input);
}

export async function assignProjectManagerAction(
  input: AssignProjectManagerInput,
): Promise<ActionResponse<AssignProjectManagerResult>> {
  const actor = await resolveActor();
  if (!actor) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  return assignProjectManagerUseCase(actor, input);
}

export async function getProjectFormData(): Promise<
  ActionResponse<{
    clients: Array<{ id: string; name: string }>;
    users: Array<{ id: string; name: string }>;
  }>
> {
  const actor = await resolveActor();
  if (!actor) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  const result = await getProjectFormBootstrap(actor, {});
  if (result.status !== "ready") {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Data form proyek tidak dapat diakses." },
    };
  }
  return {
    success: true,
    data: { clients: [...result.clients], users: [...result.projectManagers] },
  };
}
