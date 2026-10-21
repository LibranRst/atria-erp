import type { ProjectItem, ProjectStatus, FinancialHealth } from "@atria/core/types/projects";
import type { CreateProjectInput, UpdateProjectInput } from "@atria/core/validations/project";

export interface ProjectDraft {
  readonly name: string;
  readonly clientId: string;
  readonly newClientName: string;
  readonly projectManagerId: string;
  readonly totalContractValue: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly location: string;
  readonly roomArea: string;
  readonly projectType: string;
  readonly coverImageUrl: string;
  readonly notes: string;
  readonly status: ProjectStatus;
  readonly financialHealth: FinancialHealth;
}

export type EditableProject = Pick<
  ProjectItem,
  | "id"
  | "name"
  | "clientId"
  | "projectManagerId"
  | "totalContractValue"
  | "startDate"
  | "endDate"
  | "location"
  | "roomArea"
  | "projectType"
  | "coverImageUrl"
  | "notes"
  | "status"
  | "financialHealth"
>;

export function projectDraft(project: EditableProject | null): ProjectDraft {
  return {
    name: project?.name ?? "",
    clientId: project?.clientId ?? "",
    newClientName: "",
    projectManagerId: project?.projectManagerId ?? "",
    totalContractValue: project?.totalContractValue ?? 0,
    startDate: project?.startDate?.slice(0, 10) ?? "",
    endDate: project?.endDate?.slice(0, 10) ?? "",
    location: project?.location ?? "",
    roomArea: project?.roomArea ?? "",
    projectType: project?.projectType ?? "",
    coverImageUrl: project?.coverImageUrl ?? "",
    notes: project?.notes ?? "",
    status: project?.status ?? "DRAFT",
    financialHealth: project?.financialHealth ?? "HEALTHY",
  };
}

export function validateProjectDraft(draft: ProjectDraft, editing: boolean): string | null {
  if (!draft.name.trim()) return "Nama proyek wajib diisi.";
  if (!draft.clientId && (editing || !draft.newClientName.trim()))
    return "Pilih klien atau isi nama klien baru.";
  if (!draft.projectManagerId) return "Project Manager wajib dipilih.";
  if (!Number.isFinite(draft.totalContractValue) || draft.totalContractValue < 0)
    return "Nilai kontrak harus berupa nominal yang tidak negatif.";
  if (draft.startDate && draft.endDate && draft.endDate < draft.startDate)
    return "Tanggal selesai tidak boleh mendahului tanggal mulai.";
  return null;
}

export function createProjectInput(draft: ProjectDraft): CreateProjectInput {
  return {
    ...draft,
    name: draft.name.trim(),
    newClientName: draft.newClientName.trim(),
    status: "DRAFT",
  };
}

export function updateProjectInput(projectId: string, draft: ProjectDraft): UpdateProjectInput {
  return { ...draft, id: projectId, name: draft.name.trim() };
}
