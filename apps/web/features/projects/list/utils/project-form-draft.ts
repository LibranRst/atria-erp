import { z } from "zod";

import type { ProjectFinancialHealthOption, ProjectStatusOption } from "./project-drawer-options";

export const projectFormDraftSchema = z.object({
  name: z.string(),
  clientId: z.string(),
  isNewClient: z.boolean(),
  newClientName: z.string(),
  newClientEmail: z.string(),
  newClientPhone: z.string(),
  newClientAddress: z.string(),
  projectManagerId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string(),
  roomArea: z.string(),
  projectType: z.string(),
  coverImageUrl: z.string(),
  notes: z.string(),
  status: z.enum(["DRAFT", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]),
  financialHealth: z.enum(["HEALTHY", "WARNING", "CRITICAL"]),
});

export type ProjectFormDraft = z.infer<typeof projectFormDraftSchema>;

type ExistingProject = {
  readonly name: string;
  readonly clientId: string;
  readonly projectManagerId: string | null;
  readonly status: ProjectStatusOption;
  readonly financialHealth: ProjectFinancialHealthOption;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly location?: string | null;
  readonly roomArea?: string | null;
  readonly projectType?: string | null;
  readonly coverImageUrl?: string | null;
  readonly notes?: string | null;
};

function toDateInputValue(value?: string | null): string {
  return value ? new Date(value).toISOString().split("T")[0] : "";
}

export function createProjectFormDraft(
  project: ExistingProject | null | undefined,
  users: readonly { readonly id: string }[],
): ProjectFormDraft {
  return {
    name: project?.name ?? "",
    clientId: project?.clientId ?? "",
    isNewClient: false,
    newClientName: "",
    newClientEmail: "",
    newClientPhone: "",
    newClientAddress: "",
    projectManagerId: project?.projectManagerId ?? (users.length === 1 ? (users[0]?.id ?? "") : ""),
    startDate: toDateInputValue(project?.startDate),
    endDate: toDateInputValue(project?.endDate),
    location: project?.location ?? "",
    roomArea: project?.roomArea ?? "",
    projectType: project?.projectType ?? "",
    coverImageUrl: project?.coverImageUrl ?? "",
    notes: project?.notes ?? "",
    status: project?.status ?? "DRAFT",
    financialHealth: project?.financialHealth ?? "HEALTHY",
  };
}

export function getProjectDateError(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return null;
  return endDate < startDate ? "Tanggal selesai tidak boleh lebih awal dari tanggal mulai." : null;
}
