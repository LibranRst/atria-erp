import { readManagedProjectContext } from "@backend/server/usecases/project/project-management-context";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "@backend/db";
import { INSTANCE_TENANT_ID, project, client, user, role } from "@backend/db/schema";
import { actorCan } from "@backend/lib/auth/permissions";
import { resolveActor, type Actor } from "@backend/server/actor";
import {
  prepareProjectManagementProposal,
  ProjectManagementError,
} from "@backend/server/usecases/project/project-management-writer";
import {
  projectManagementInputSchema,
  projectManagementProposalSchema,
  projectManagementPermissions,
} from "@atria/core/ai/project-management";
import type { AiToolContext } from "./context";
async function current(context: AiToolContext): Promise<Actor> {
  const actor = await resolveActor();
  if (
    !actor ||
    actor.userId !== context.userId ||
    !actorCan(actor, "use:ai_chat") ||
    actor.dataScope === "NONE"
  )
    throw new ProjectManagementError("FORBIDDEN", "Akses proyek tidak tersedia.");
  return actor;
}
const failure = (error: unknown): { error: string } => ({
  error:
    error instanceof ProjectManagementError
      ? error.message
      : "Data belum lengkap atau sumber tidak valid. Minta referensi atau isian yang jelas; jangan menebak.",
});
export function buildProjectManagementTools(context: AiToolContext): ToolSet {
  return {
    getProjectManagementContext: tool({
      description:
        "Read-only scoped project/budget and references before project metadata edit, PM reassignment, activation/closing, partial category allocation or budget submit/approve/reject. Current IDs, active ASSIGNED-scope PMs, existing clients and every category including unchanged allocations.20 candidates/page; continue hasMore and disambiguate, never auto-pick. Financial details require view:budget, closing requires view:profitability and close:project. Settings defaults do not rewrite saved budgets. Contract changes on approved projects use RAB/Change Order, not metadata patch.",
      inputSchema: z
        .object({
          action: projectManagementProposalSchema.shape.action,
          projectId: z.guid().optional(),
          query: z.string().trim().max(100).optional(),
          clientQuery: z.string().trim().max(100).optional(),
          managerQuery: z.string().trim().max(100).optional(),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      execute: async (input) => {
        try {
          const actor = await current(context);
          if (projectManagementPermissions(input.action).some((p) => !actorCan(actor, p)))
            throw new ProjectManagementError("FORBIDDEN", "Izin tindakan ini tidak tersedia.");
          const projects = await db
            .select({
              id: project.id,
              name: project.name,
              status: project.status,
              projectManagerId: project.projectManagerId,
            })
            .from(project)
            .where(
              and(
                eq(project.tenantId, INSTANCE_TENANT_ID),
                actor.dataScope === "ASSIGNED"
                  ? eq(project.projectManagerId, actor.userId)
                  : undefined,
                input.projectId ? eq(project.id, input.projectId) : undefined,
                input.query ? ilike(project.name, `%${input.query}%`) : undefined,
              ),
            )
            .orderBy(asc(project.name), asc(project.id))
            .limit(21)
            .offset(input.offset);
          const selected = input.projectId
            ? await readManagedProjectContext(actor, input.projectId)
            : null;
          const clients =
            input.action === "EDIT_PROJECT"
              ? await db
                  .select({ id: client.id, name: client.name })
                  .from(client)
                  .where(
                    and(
                      eq(client.tenantId, INSTANCE_TENANT_ID),
                      input.clientQuery ? ilike(client.name, `%${input.clientQuery}%`) : undefined,
                    ),
                  )
                  .orderBy(asc(client.name), asc(client.id))
                  .limit(21)
                  .offset(input.offset)
              : [];
          const managers =
            input.action === "ASSIGN_PM"
              ? await db
                  .select({ id: user.id, name: user.name })
                  .from(user)
                  .innerJoin(role, eq(role.id, user.roleId))
                  .where(
                    and(
                      eq(user.isActive, true),
                      eq(role.dataScope, "ASSIGNED"),
                      input.managerQuery ? ilike(user.name, `%${input.managerQuery}%`) : undefined,
                    ),
                  )
                  .orderBy(asc(user.name), asc(user.id))
                  .limit(21)
                  .offset(input.offset)
              : [];
          return {
            projects: projects.slice(0, 20),
            projectsHasMore: projects.length > 20,
            selected,
            clients: clients.slice(0, 20),
            clientsHasMore: clients.length > 20,
            managers: managers.slice(0, 20),
            managersHasMore: managers.length > 20,
            offset: input.offset,
            nextOffset:
              projects.length > 20 || clients.length > 20 || managers.length > 20
                ? input.offset + 20
                : null,
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
    proposeProjectManagement: tool({
      description:
        "Prepare immutable project/budget decision for explicit human approval. No business writes. Resolve actual IDs with getProjectManagementContext; preserve omitted metadata and untouched categories. Never infer activation, closing, PM assignment, budget approval or rejection. For reallocation request exact category amount OR ratio and a human reason; simulate every category including those unchanged against internal cap. Show actual/pending/paid, remaining and RAP/package warnings separately. Activation/closing blockers cannot be overridden. Metadata cannot alter contract, budget formula, financial health, project status or permissions. Corrections create a fresh proposal. Tools never execute a business mutation.",
      inputSchema: projectManagementInputSchema,
      execute: async (input) => {
        try {
          return {
            proposal: await prepareProjectManagementProposal(await current(context), input),
          };
        } catch (error: unknown) {
          return failure(error);
        }
      },
    }),
  };
}
