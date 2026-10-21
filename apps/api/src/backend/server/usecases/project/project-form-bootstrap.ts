import { actorCan } from "@backend/lib/auth/permissions";
import { db } from "@backend/db";
import { client, INSTANCE_TENANT_ID, project } from "@backend/db/schema";
import { assertProjectAccess } from "@backend/lib/auth/scoping";
import type { Actor } from "@backend/server/actor";
import type { ProjectItem } from "@atria/core/types/projects";
import type { ProjectFormBootstrapInput } from "@atria/core/validations/project";
import { and, eq } from "drizzle-orm";
import { isProjectManagerOption } from "./project-manager-options";

type ProjectFormIdentity = Pick<
  ProjectItem,
  | "id"
  | "name"
  | "clientId"
  | "projectManagerId"
  | "status"
  | "financialHealth"
  | "startDate"
  | "endDate"
  | "location"
  | "roomArea"
  | "projectType"
  | "coverImageUrl"
  | "notes"
>;

export type ProjectFormBootstrapData =
  | {
      readonly status: "ready";
      readonly canCreate: boolean;
      readonly canUpdate: boolean;
      readonly clients: ReadonlyArray<{ readonly id: string; readonly name: string }>;
      readonly projectManagers: ReadonlyArray<{ readonly id: string; readonly name: string }>;
      readonly project: ProjectFormIdentity | null;
    }
  | { readonly status: "notFound" }
  | { readonly status: "restricted" };

function toProjectStatus(status: string): ProjectItem["status"] {
  if (
    status === "ACTIVE" ||
    status === "ON_HOLD" ||
    status === "COMPLETED" ||
    status === "CANCELLED"
  ) {
    return status;
  }
  return "DRAFT";
}

function toFinancialHealth(health: string): ProjectItem["financialHealth"] {
  if (health === "WARNING" || health === "CRITICAL") return health;
  return "HEALTHY";
}

/** Memuat hanya opsi dan satu identitas proyek yang diperlukan form native. */
export async function getProjectFormBootstrap(
  actor: Actor,
  input: ProjectFormBootstrapInput,
): Promise<ProjectFormBootstrapData> {
  const canCreate = actorCan(actor, "create:project");
  const canUpdate = actorCan(actor, "update:budget");

  if (!actorCan(actor, "view:budget")) return { status: "restricted" };
  if (input.projectId ? !canUpdate : !canCreate) return { status: "restricted" };

  if (input.projectId) {
    try {
      await assertProjectAccess(input.projectId, actor.userId, actor.roleName);
    } catch {
      return { status: "restricted" };
    }
  }

  const [clients, users, projectRecord] = await Promise.all([
    db.query.client.findMany({
      columns: { id: true, name: true },
      where: eq(client.tenantId, INSTANCE_TENANT_ID),
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
    db.query.user.findMany({
      columns: { id: true, isActive: true, name: true },
      with: { role: { columns: { name: true, dataScope: true } } },
      orderBy: (table, { asc }) => [asc(table.name)],
    }),
    input.projectId
      ? db.query.project.findFirst({
          columns: {
            id: true,
            name: true,
            clientId: true,
            projectManagerId: true,
            status: true,
            financialHealth: true,
            startDate: true,
            endDate: true,
            location: true,
            roomArea: true,
            projectType: true,
            coverImageUrl: true,
            notes: true,
          },
          where: and(eq(project.id, input.projectId), eq(project.tenantId, INSTANCE_TENANT_ID)),
        })
      : Promise.resolve(undefined),
  ]);

  if (input.projectId && !projectRecord) return { status: "notFound" };

  return {
    status: "ready",
    canCreate,
    canUpdate,
    clients: canCreate
      ? clients
      : clients.filter((candidate) => candidate.id === projectRecord?.clientId),
    projectManagers: users
      .filter((candidate) => isProjectManagerOption(candidate, [projectRecord?.projectManagerId]))
      .map(({ id, name }) => ({ id, name })),
    project: projectRecord
      ? {
          ...projectRecord,
          status: toProjectStatus(projectRecord.status),
          financialHealth: toFinancialHealth(projectRecord.financialHealth),
          startDate: projectRecord.startDate?.toISOString() ?? null,
          endDate: projectRecord.endDate?.toISOString() ?? null,
        }
      : null,
  };
}
