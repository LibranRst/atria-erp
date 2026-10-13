import type { ProjectDetailData, ProjectDetailPayload } from "./types";

/** The existing rich loader stays server-side; Phase 1 receives its own domain. */
export function projectDetailPayload(data: ProjectDetailData): ProjectDetailPayload {
  const project = data.project;
  return {
    project: {
      id: project.id,
      name: project.name,
      clientId: project.clientId,
      projectManagerId: project.projectManagerId,
      totalContractValue: project.totalContractValue,
      financialHealth: project.financialHealth,
      status: project.status,
      location: project.location,
      roomArea: project.roomArea,
      projectType: project.projectType,
      coverImageUrl: project.coverImageUrl,
      startDate: project.startDate,
      endDate: project.endDate,
      notes: project.notes,
      client: project.client ? { name: project.client.name } : null,
      projectManager: project.projectManager ? { name: project.projectManager.name } : null,
    },
    projectBudgetDashboard: data.projectBudgetDashboard,
  };
}
