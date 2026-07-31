"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { account, auditLog, session, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission } from "@/lib/auth/permissions";
import { OWNER_ROLE_ID, STAFF_ROLE_IDS } from "@/lib/auth/role-constants";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  changeTemporaryPasswordSchema,
  createStaffUserSchema,
  updateStaffUserSchema,
  type ChangeTemporaryPasswordInput,
  type CreateStaffUserInput,
  type UpdateStaffUserInput,
} from "@/lib/validations/administration";
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
  if (!STAFF_ROLE_IDS.has(validation.data.roleId))
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Role tidak diizinkan." },
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
      const keepsExistingOwnerRole =
        existing.roleId === OWNER_ROLE_ID && validation.data.roleId === OWNER_ROLE_ID;
      if (!STAFF_ROLE_IDS.has(validation.data.roleId) && !keepsExistingOwnerRole)
        throw new Error("ROLE_NOT_ALLOWED");
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
        error: { code: "VALIDATION_ERROR", message: "Role tidak diizinkan." },
      };
    if (message === "USER_NOT_FOUND")
      return { success: false, error: { code: "NOT_FOUND", message: "User tidak ditemukan." } };
    return { success: false, error: { code: "INTERNAL_SERVER_ERROR", message } };
  }
}

export async function changeTemporaryPassword(
  input: ChangeTemporaryPasswordInput,
): Promise<ActionResponse<{ readonly changed: true }>> {
  const validation = changeTemporaryPasswordSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Password tidak valid.",
      },
    };
  const actor = await currentUser();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  const credential = await db.query.account.findFirst({
    where: and(eq(account.userId, actor.id), eq(account.providerId, "credential")),
  });
  if (!credential?.password)
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Credential user tidak ditemukan." },
    };
  const context = await auth.$context;
  const valid = await context.password.verify({
    hash: credential.password,
    password: validation.data.currentPassword,
  });
  if (!valid)
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Password sementara tidak sesuai." },
    };
  const newHash = await context.password.hash(validation.data.newPassword);
  await db.transaction(async (tx) => {
    await tx
      .update(account)
      .set({ password: newHash, updatedAt: new Date() })
      .where(eq(account.id, credential.id));
    await tx
      .update(user)
      .set({ mustChangePassword: false, temporaryPasswordIssuedAt: null, updatedAt: new Date() })
      .where(eq(user.id, actor.id));
    await tx.delete(session).where(and(eq(session.userId, actor.id), ne(session.id, "")));
    await tx.insert(auditLog).values({
      userId: actor.id,
      action: "CHANGE_TEMPORARY_PASSWORD",
      targetTable: "user",
      targetId: actor.id,
      newState: JSON.stringify({ mustChangePassword: false }),
    });
  });
  return { success: true, data: { changed: true } };
}
