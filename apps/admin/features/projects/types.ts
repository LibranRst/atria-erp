import type { WebRpcResult } from "@atria/api/contract";

export type ProjectListData =
  WebRpcResult<"features/projects/list/server/get-project-list-page-data.getProjectListPageData">;
export type ProjectDetailData =
  WebRpcResult<"features/projects/detail/server/get-project-detail-data.getProjectDetailData">;
/** Send only the current project/budget domain to the Phase 1 client. */
export interface ProjectDetailPayload {
  readonly project: Pick<
    ProjectDetailData["project"],
    | "id"
    | "name"
    | "clientId"
    | "projectManagerId"
    | "totalContractValue"
    | "financialHealth"
    | "status"
    | "location"
    | "roomArea"
    | "projectType"
    | "coverImageUrl"
    | "startDate"
    | "endDate"
    | "notes"
  > & {
    readonly client: { readonly name: string } | null;
    readonly projectManager: { readonly name: string } | null;
  };
  readonly projectBudgetDashboard: ProjectDetailData["projectBudgetDashboard"];
}
type SuccessfulData<T> =
  Extract<T, { readonly success: true }> extends { readonly data: infer Data } ? Data : never;
export type ProjectBudget = SuccessfulData<
  WebRpcResult<"app/actions/project/excel-budget.getProjectBudgetDashboard">
>;
export type ProjectFormOptions = SuccessfulData<
  WebRpcResult<"app/actions/project/crud.getProjectFormData">
>;

export interface ProjectPermissions {
  readonly canCreate: boolean;
  readonly canEdit: boolean;
  readonly canCreateBudget: boolean;
  readonly canApproveBudget: boolean;
}
