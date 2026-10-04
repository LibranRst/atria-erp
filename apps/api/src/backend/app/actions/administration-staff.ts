import { and, eq, ne } from "drizzle-orm";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { db } from "@backend/db";
import { account, auditLog, role, session, tenantMember, user } from "@backend/db/schema";
import { INSTANCE_TENANT_ID } from "@backend/db/schema/tenant-constants";
import { auth } from "@backend/lib/auth";
import { assertPermission } from "@backend/lib/auth/permissions";
import { resolveActor } from "@backend/server/actor";
import { changeTemporaryPasswordUseCase } from "@backend/server/usecases/administration/change-temporary-password";
import { recordReadinessMilestonesTx } from "@backend/lib/onboarding/readiness-events";
import { OWNER_ROLE_ID } from "@atria/core/auth/role-constants";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  createStaffUserSchema,
  updateStaffUserSchema,
  type ChangeTemporaryPasswordInput,
  type CreateStaffUserInput,
  type UpdateStaffUserInput,
} from "@atria/core/validations/administration";
import { getAdministrationActor as currentUser } from "./administration-action-utils";
export async function createStaffUser(
  input: CreateStaffUserInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = createStaffUserSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "User tidak valid.",
      },
    };
  const actor = await currentUser();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  await assertPermission(actor, "manage:users");
  // Peran yang sah adalah peran yang ada di database, bukan empat UUID bawaan:
  // peran buatan Owner harus bisa ditugaskan, peran yang sudah dihapus tidak.
  const assignedRole = await db.query.role.findFirst({
    where: eq(role.id, validation.data.roleId),
    columns: { id: true },
  });
  if (!assignedRole)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Role tidak ditemukan." },
    };
  try {
    const passwordHash = await auth.$context.then((context) =>
      context.password.hash(validation.data.temporaryPassword),
    );
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(user)
        .values({
          name: validation.data.name,
          email: validation.data.email,
          emailVerified: true,
          roleId: validation.data.roleId,
          mustChangePassword: true,
          temporaryPasswordIssuedAt: new Date(),
        })
        .returning();
      await tx.insert(account).values({
        id: `credential-${row.id}`,
        accountId: row.id,
        providerId: "credential",
        userId: row.id,
        password: passwordHash,
      });
      await tx.insert(tenantMember).values({
        tenantId: INSTANCE_TENANT_ID,
        userId: row.id,
        roleId: row.roleId,
        isActive: true,
      });
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "CREATE_STAFF_USER",
        targetTable: "user",
        targetId: row.id,
        newState: JSON.stringify({
          name: row.name,
          email: row.email,
          roleId: row.roleId,
          mustChangePassword: true,
        }),
      });
      await recordReadinessMilestonesTx({
        tx,
        actorUserId: actor.id,
        changedItem: "core_team",
      });
      return row;
    });
    revalidatePath("/settings");
    return { success: true, data: { id: created.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal membuat user.";
    return {
      success: false,
      error: {
        code: message.includes("unique") ? "CONFLICT" : "INTERNAL_SERVER_ERROR",
        message: message.includes("unique") ? "Email sudah digunakan." : message,
      },
    };
  }
}

export async function updateStaffUser(
  input: UpdateStaffUserInput,
): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = updateStaffUserSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "User tidak valid.",
      },
    };
  const actor = await currentUser();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  await assertPermission(actor, "manage:users");
  try {
    await db.transaction(async (tx) => {
      const existing = await tx.query.user.findFirst({
        where: eq(user.id, validation.data.userId),
      });
      if (!existing) throw new Error("USER_NOT_FOUND");
      const assignedRole = await tx.query.role.findFirst({
        where: eq(role.id, validation.data.roleId),
        columns: { id: true },
      });
      if (!assignedRole) throw new Error("ROLE_NOT_ALLOWED");
      if (
        existing.roleId === OWNER_ROLE_ID &&
        (validation.data.roleId !== OWNER_ROLE_ID || !validation.data.isActive)
      ) {
        const otherOwner = await tx.query.user.findFirst({
          where: and(
            eq(user.roleId, OWNER_ROLE_ID),
            eq(user.isActive, true),
            ne(user.id, existing.id),
          ),
        });
        if (!otherOwner) throw new Error("LAST_ACTIVE_OWNER");
      }
      const [updated] = await tx
        .update(user)
        .set({
          name: validation.data.name,
          roleId: validation.data.roleId,
          isActive: validation.data.isActive,
          updatedAt: new Date(),
        })
        .where(eq(user.id, existing.id))
        .returning();
      if (!updated.isActive) await tx.delete(session).where(eq(session.userId, updated.id));
      await tx
        .update(tenantMember)
        .set({
          roleId: validation.data.roleId,
          isActive: validation.data.isActive,
          updatedAt: new Date(),
        })
        .where(
          and(eq(tenantMember.tenantId, INSTANCE_TENANT_ID), eq(tenantMember.userId, updated.id)),
        );
      await tx.insert(auditLog).values({
        userId: actor.id,
        action: "UPDATE_STAFF_USER",
        targetTable: "user",
        targetId: updated.id,
        originalState: JSON.stringify(existing),
        newState: JSON.stringify(updated),
      });
    });
    revalidatePath("/settings");
    return { success: true, data: { id: validation.data.userId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memperbarui user.";
    if (message === "LAST_ACTIVE_OWNER")
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Owner aktif terakhir tidak dapat dinonaktifkan atau diubah rolenya.",
        },
      };
    if (message === "ROLE_NOT_ALLOWED")
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Role tidak ditemukan." },
      };
    if (message === "USER_NOT_FOUND")
      return { success: false, error: { code: "NOT_FOUND", message: "User tidak ditemukan." } };
    return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message } };
  }
}

/**
 * Pembungkus tipis di atas `changeTemporaryPasswordUseCase`.
 *
 * Identitas SELALU diselesaikan di sini dari sesi, tidak pernah diterima
 * sebagai argumen — modul `"use server"` adalah endpoint HTTP, jadi parameter
 * aktor akan bisa dipalsukan klien. Prosedur tRPC memanggil use-case yang sama
 * dengan actor bearer, sehingga web dan native berbagi satu badan transaksi.
 */
export async function changeTemporaryPassword(
  input: ChangeTemporaryPasswordInput,
): Promise<ActionResponse<{ readonly changed: true }>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  return changeTemporaryPasswordUseCase(actor, input);
}
