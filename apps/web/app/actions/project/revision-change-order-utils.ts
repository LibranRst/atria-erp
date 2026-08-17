import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import type { ActionResponse } from "@/lib/types/action-response";

export type RevisionActionUser = {
  readonly id: string;
  readonly roleId?: string;
};

export async function getRevisionActionUser(): Promise<RevisionActionUser | null> {
  const session = await auth.api.getSession({
    headers: {
      cookie: (await cookies()).toString(),
    },
  });
  return session?.user ? (session.user as RevisionActionUser) : null;
}

export function revisionActionFailure<T>(error: unknown, fallback: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("FORBIDDEN") || message.includes("Akses")) {
    return { success: false, error: { code: "FORBIDDEN", message } };
  }
  if (message.includes("NOT_FOUND")) {
    return { success: false, error: { code: "NOT_FOUND", message: fallback } };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}

export async function assertRevisionProjectScope(
  user: RevisionActionUser,
  projectId: string,
  permission: "update:rap" | "update:budget" | "update:rab" | "approve:rab",
): Promise<string> {
  await assertPermission(user, permission);
  const roleName = await resolveRoleName(user.roleId ?? "");
  await assertProjectAccess(projectId, user.id, roleName);
  return roleName;
}
