"use server";

import { cookies } from "next/headers";

import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName, type PermissionKey } from "@/lib/auth/permissions";
import { assertProjectAccess, assertProjectIsOperational } from "@/lib/auth/scoping";
import type { ActionResponse } from "@atria/core/types/action-response";

export type FieldRequestUser = {
  readonly id: string;
  readonly roleId: string;
};

type AuthResult = ActionResponse<{ readonly user: FieldRequestUser }>;

async function getActionUser(): Promise<FieldRequestUser | null> {
  const session = await auth.api.getSession({
    headers: {
      cookie: (await cookies()).toString(),
    },
  });

  return session?.user ? { id: session.user.id, roleId: session.user.roleId } : null;
}

export async function authorizeFieldRequestAction({
  permission,
  projectId,
}: {
  readonly permission: PermissionKey;
  readonly projectId?: string;
}): Promise<AuthResult> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };
  }

  try {
    await assertPermission(user, permission);
  } catch (err) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: err instanceof Error ? err.message : "Akses ditolak.",
      },
    };
  }

  if (projectId) {
    try {
      const userRoleName = await resolveRoleName(user.roleId);
      await assertProjectAccess(projectId, user.id, userRoleName);
      await assertProjectIsOperational(projectId);
    } catch (err) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: err instanceof Error ? err.message : "Akses ditolak.",
        },
      };
    }
  }

  return { success: true, data: { user } };
}

export async function authorizeOwnerVendorApproval(): Promise<AuthResult> {
  const user = await getActionUser();
  if (!user) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };
  }

  const userRoleName = await resolveRoleName(user.roleId);
  if (userRoleName !== "OWNER") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Hanya Owner yang dapat menyetujui/menolak pembayaran vendor.",
      },
    };
  }

  return { success: true, data: { user } };
}
