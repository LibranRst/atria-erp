import "server-only";

import { notFound } from "next/navigation";
import { callBackendData } from "@/lib/api/backend";
import { requireAdminActor } from "@/lib/auth/server";
import { projectDetailPayload } from "../presentation-data";
import type {
  ProjectDetailPayload,
  ProjectFormOptions,
  ProjectListData,
  ProjectPermissions,
} from "../types";

export async function loadProjects(): Promise<{
  readonly data: ProjectListData;
  readonly permissions: ProjectPermissions;
  readonly formOptions: ProjectFormOptions | null;
}> {
  const actor = await requireAdminActor({ returnTo: "/projects" });
  const permissions: ProjectPermissions = {
    canCreate: actor.permissions.includes("create:project"),
    canEdit: actor.permissions.includes("update:budget"),
    canCreateBudget: actor.permissions.includes("create:budget"),
    canApproveBudget: actor.permissions.includes("approve:budget"),
  };
  if (!actor.permissions.includes("view:budget"))
    return { data: { status: "restricted" }, permissions, formOptions: null };
  const [data, form] = await Promise.all([
    callBackendData(
      "features/projects/list/server/get-project-list-page-data.getProjectListPageData",
      [actor],
    ),
    permissions.canCreate || permissions.canEdit
      ? callBackendData("app/actions/project/crud.getProjectFormData", [])
      : Promise.resolve(null),
  ]);
  return { data, permissions, formOptions: form?.success ? form.data : null };
}

export async function loadProject(projectId: string): Promise<{
  readonly data: ProjectDetailPayload | null;
  readonly permissions: ProjectPermissions;
  readonly formOptions: ProjectFormOptions | null;
}> {
  const actor = await requireAdminActor({ returnTo: `/projects/${projectId}` });
  const permissions: ProjectPermissions = {
    canCreate: actor.permissions.includes("create:project"),
    canEdit: actor.permissions.includes("update:budget"),
    canCreateBudget: actor.permissions.includes("create:budget"),
    canApproveBudget: actor.permissions.includes("approve:budget"),
  };
  if (!actor.permissions.includes("view:budget"))
    return { data: null, permissions, formOptions: null };
  const [data, form] = await Promise.all([
    callBackendData(
      "features/projects/detail/server/get-project-detail-data.getProjectDetailData",
      [projectId, "/projects"],
    ),
    permissions.canEdit
      ? callBackendData("app/actions/project/crud.getProjectFormData", [])
      : Promise.resolve(null),
  ]);
  if (!data.project) notFound();
  return {
    data: projectDetailPayload(data),
    permissions,
    formOptions: form?.success ? form.data : null,
  };
}
