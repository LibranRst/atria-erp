import { actorCan } from "@/lib/auth/permissions";
import "server-only";

import { type PermissionKey } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";

import { assertProjectAccess, assertProjectIsOperational } from "@/lib/auth/scoping";
import type { Actor } from "@/server/actor";

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
  if (!actorCan(actor, permission)) {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Akses ditolak." },
    };
  }

  if (projectId) {
    try {
      await assertProjectAccess(projectId, actor.userId, actor.roleName);
      await assertProjectIsOperational(projectId);
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
