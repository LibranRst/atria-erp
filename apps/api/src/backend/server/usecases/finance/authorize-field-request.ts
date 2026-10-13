import { actorCan } from "@backend/lib/auth/permissions";
import { type PermissionKey } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";

import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { db } from "@backend/db";
import { project, INSTANCE_TENANT_ID } from "@backend/db/schema";
import { and, eq } from "drizzle-orm";
import type { Actor } from "@backend/server/actor";

export type AuthorizedFieldRequestUser = {
  readonly id: string;
  readonly roleId: string;
};

type AuthorizationResult = ActionResponse<{ readonly user: AuthorizedFieldRequestUser }>;

/** Otorisasi use-case yang tidak bergantung pada cookie/transport. */
export async function authorizeFieldRequestActor({
  actor,
  permission,
  projectId,
}: {
  readonly actor: Actor;
  readonly permission: PermissionKey;
  readonly projectId?: string;
}): Promise<AuthorizationResult> {
  if (!actorCan(actor, permission) || actor.dataScope === "NONE") {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses ditolak." },
    };
  }

  if (projectId) {
    try {
      const p = await db.query.project.findFirst({
        where: and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)),
      });
      if (!p || (actor.dataScope === "ASSIGNED" && p.projectManagerId !== actor.userId))
        throw new Error("Akses proyek ditolak.");
      assertProjectStatusIsOperational(p.status);
    } catch (error) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: error instanceof Error ? error.message : "Akses ditolak.",
        },
      };
    }
  }

  return {
    success: true,
    data: { user: { id: actor.userId, roleId: actor.roleId } },
  };
}
