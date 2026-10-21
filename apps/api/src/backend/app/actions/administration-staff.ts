import {
  writeAdministrationChangeTx,
  administrationChangeFailure,
  lockAdministrationTx,
  readAdministrationState,
  assertNewStaffRole,
  AdministrationChangeError,
} from "@backend/server/usecases/administration/change-writer";
import { eq } from "drizzle-orm";
import { revalidateWorkspacePath as revalidatePath } from "@backend/lib/cache/revalidate-workspace";
import { db } from "@backend/db";
import { account, auditLog, role, tenantMember, user } from "@backend/db/schema";
import { INSTANCE_TENANT_ID } from "@backend/db/schema/tenant-constants";
import { auth } from "@backend/lib/auth";
import { assertPermission } from "@backend/lib/auth/permissions";
import { resolveActor } from "@backend/server/actor";
import { changeTemporaryPasswordUseCase } from "@backend/server/usecases/administration/change-temporary-password";
import { recordReadinessMilestonesTx } from "@backend/lib/onboarding/readiness-events";
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
    const authority = await resolveActor();
    if (!authority) throw new Error("UNAUTHORIZED");
    const created = await db.transaction(async (tx) => {
      await lockAdministrationTx(tx);
      assertNewStaffRole(authority, await readAdministrationState(tx), validation.data.roleId);
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
    if (error instanceof AdministrationChangeError) return administrationChangeFailure(error);
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
  const parsed = updateStaffUserSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Data staf tidak valid.",
      },
    };
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const { userId, ...patch } = parsed.data;
    const id = await db.transaction((tx) =>
      writeAdministrationChangeTx(
        tx,
        actor,
        {
          action: "STAFF_CHANGES",
          users: [{ userId, patch }],
          reason: "Perubahan staf melalui formulir administrasi",
        },
        "SCREEN",
      ),
    );
    revalidatePath("/settings");
    return { success: true, data: { id } };
  } catch (error: unknown) {
    if (
      error instanceof AdministrationChangeError &&
      error.code === "VALIDATION_ERROR" &&
      error.message.includes("tidak ada perubahan")
    )
      return { success: true, data: { id: parsed.data.userId } };
    return administrationChangeFailure(error);
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
