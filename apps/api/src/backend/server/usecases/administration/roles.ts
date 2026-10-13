import {
  writeAdministrationChangeTx,
  lockAdministrationTx,
  verifyRolePermissionSnapshotTx,
  assertRoleScopeGrant,
  refreshAdministrationActor,
  readAdministrationState,
  AdministrationChangeError,
  administrationChangeFailure,
} from "./change-writer";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@backend/db";
import { auditLog, role, rolePermission, user } from "@backend/db/schema";
import { getAllPermissionKeys } from "@backend/lib/auth/role-access";
import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { OWNER_ROLE_ID } from "@atria/core/auth/role-constants";
import { type PermissionKey, type RoleDataScope } from "@atria/core/auth/permissions";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  createRoleSchema,
  deleteRoleSchema,
  updateRoleDetailsSchema,
  updateRolePermissionsSchema,
  type CreateRoleInput,
  type DeleteRoleInput,
  type UpdateRoleDetailsInput,
  type UpdateRolePermissionsInput,
} from "@atria/core/validations/roles";

export type ManagedRole = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly dataScope: RoleDataScope;
  readonly isSystem: boolean;
  readonly isOwnerRole: boolean;
  readonly userCount: number;
  readonly permissions: readonly PermissionKey[];
};

function forbidden<T>(message: string): ActionResponse<T> {
  return { success: false, error: { code: "FORBIDDEN", message } };
}

function invalid<T>(message: string): ActionResponse<T> {
  return { success: false, error: { code: "VALIDATION_ERROR", message } };
}

/**
 * Aturan anti-eskalasi: sebuah peran tidak pernah bisa memberikan izin yang
 * tidak dimilikinya sendiri.
 *
 * Tanpa ini, mendelegasikan `manage:roles` sama dengan menyerahkan seluruh
 * sistem — penerimanya tinggal memberi dirinya `pay:cost`. Dengan ini, delegasi
 * menjadi apa yang dimaksudkan pemberi: membagi akses yang **sudah** ia pegang.
 */
function findEscalation(
  actor: Actor,
  requested: readonly string[],
): { readonly key: string } | null {
  for (const key of requested) {
    if (!actorCan(actor, key as PermissionKey)) return { key };
  }
  return null;
}

function findUnknownKey(requested: readonly string[]): string | null {
  const known = new Set<string>(getAllPermissionKeys());
  return requested.find((key) => !known.has(key)) ?? null;
}

async function assertManageable<T>(
  actor: Actor,
  roleId: string,
): Promise<ActionResponse<T> | null> {
  if (!actorCan(actor, "manage:roles")) {
    return forbidden<T>("Peran Anda tidak berhak mengelola peran.");
  }
  if (roleId === OWNER_ROLE_ID) {
    return forbidden<T>("Peran Owner tidak dapat diubah.");
  }
  return null;
}

/**
 * Asal perubahan izin, tercatat di audit.
 *
 * Perubahan dari layar dan perubahan dari kartu asisten punya bentuk keputusan
 * yang berbeda, dan audit yang menyamakannya menghilangkan satu-satunya cara
 * meninjau ulang jalur bergesekan-rendah itu di kemudian hari.
 */
export type RoleChangeOrigin = "SCREEN" | "AI_PROPOSAL";

const AUDIT_ACTION_BY_ORIGIN: Readonly<Record<RoleChangeOrigin, string>> = {
  SCREEN: "UPDATE_ROLE_PERMISSIONS",
  AI_PROPOSAL: "AI_PROPOSED_ROLE_CHANGE",
};

const CREATE_AUDIT_ACTION_BY_ORIGIN: Readonly<Record<RoleChangeOrigin, string>> = {
  SCREEN: "CREATE_ROLE",
  AI_PROPOSAL: "AI_PROPOSED_ROLE_CREATE",
};

export async function listManagedRolesUseCase(
  actor: Actor,
): Promise<ActionResponse<readonly ManagedRole[]>> {
  if (!actorCan(actor, "manage:roles")) {
    return forbidden("Peran Anda tidak berhak mengelola peran.");
  }

  const [rows, counts] = await Promise.all([
    db.query.role.findMany({ with: { permissions: { columns: { permissionKey: true } } } }),
    db
      .select({ roleId: user.roleId, total: sql<number>`count(*)::int` })
      .from(user)
      .groupBy(user.roleId),
  ]);
  const countByRole = new Map(counts.map((row) => [row.roleId, row.total]));

  return {
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      dataScope: row.dataScope as RoleDataScope,
      isSystem: row.isSystem,
      isOwnerRole: row.id === OWNER_ROLE_ID,
      userCount: countByRole.get(row.id) ?? 0,
      permissions: row.permissions.map((item) => item.permissionKey as PermissionKey),
    })),
  };
}

export async function createRoleUseCase(
  actor: Actor,
  input: CreateRoleInput,
  origin: RoleChangeOrigin = "SCREEN",
): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = createRoleSchema.safeParse(input);
  if (!validation.success)
    return invalid(validation.error.issues[0]?.message ?? "Peran tidak valid.");
  if (!actorCan(actor, "manage:roles")) {
    return forbidden("Peran Anda tidak berhak mengelola peran.");
  }

  let permissions = validation.data.permissions;
  if (validation.data.duplicateFromRoleId) {
    const source = await db.query.rolePermission.findMany({
      where: eq(rolePermission.roleId, validation.data.duplicateFromRoleId),
      columns: { permissionKey: true },
    });
    permissions = source.map((row) => row.permissionKey);
  }

  const unknown = findUnknownKey(permissions);
  if (unknown) return invalid(`Izin tidak dikenal: ${unknown}.`);

  const escalation = findEscalation(actor, permissions);
  if (escalation) {
    return forbidden(`Anda tidak dapat memberikan izin yang tidak Anda miliki: ${escalation.key}.`);
  }

  try {
    assertRoleScopeGrant(actor, validation.data.dataScope);
  } catch (error: unknown) {
    return administrationChangeFailure(error);
  }
  const normalizedName = validation.data.name.trim().toUpperCase().replaceAll(" ", "_");
  const existing = await db.query.role.findFirst({ where: eq(role.name, normalizedName) });
  if (existing)
    return { success: false, error: { code: "CONFLICT", message: "Nama peran sudah dipakai." } };

  try {
    const created = await db.transaction(async (tx) => {
      await lockAdministrationTx(tx);
      const freshActor = refreshAdministrationActor(
        actor,
        await readAdministrationState(tx),
        "manage:roles",
        origin === "AI_PROPOSAL",
      );
      assertRoleScopeGrant(freshActor, validation.data.dataScope);
      if (findEscalation(freshActor, permissions))
        throw new AdministrationChangeError("FORBIDDEN", "Izin baru melampaui kewenangan Anda.");
      const [row] = await tx
        .insert(role)
        .values({
          name: normalizedName,
          description: validation.data.description ?? null,
          dataScope: validation.data.dataScope,
          isSystem: false,
        })
        .returning();

      if (permissions.length > 0) {
        await tx
          .insert(rolePermission)
          .values(permissions.map((key) => ({ roleId: row.id, permissionKey: key })));
      }

      await tx.insert(auditLog).values({
        userId: actor.userId,
        action: CREATE_AUDIT_ACTION_BY_ORIGIN[origin],
        targetTable: "role",
        targetId: row.id,
        newState: JSON.stringify({
          name: normalizedName,
          dataScope: validation.data.dataScope,
          permissions,
        }),
      });
      return row;
    });

    return { success: true, data: { id: created.id } };
  } catch (error: unknown) {
    return administrationChangeFailure(error);
  }
}

/**
 * Menyimpan izin sebuah peran sebagai **satu** keputusan.
 *
 * Auditnya satu baris berisi selisih, bukan satu baris per sakelar: yang
 * diputuskan manusia adalah bentuk akhir peran itu, bukan tiga puluh perubahan
 * kecil yang kebetulan disimpan bersamaan.
 */
export async function updateRolePermissionsUseCase(
  actor: Actor,
  input: UpdateRolePermissionsInput,
  origin: RoleChangeOrigin = "SCREEN",
): Promise<ActionResponse<{ readonly updated: boolean }>> {
  const validation = updateRolePermissionsSchema.safeParse(input);
  if (!validation.success)
    return invalid(validation.error.issues[0]?.message ?? "Izin tidak valid.");

  const blocked = await assertManageable<{ readonly updated: boolean }>(
    actor,
    validation.data.roleId,
  );
  if (blocked) return blocked;

  const unknown = findUnknownKey(validation.data.permissions);
  if (unknown) return invalid(`Izin tidak dikenal: ${unknown}.`);

  const target = await db.query.role.findFirst({
    where: eq(role.id, validation.data.roleId),
    with: { permissions: { columns: { permissionKey: true } } },
  });
  if (!target)
    return { success: false, error: { code: "NOT_FOUND", message: "Peran tidak ditemukan." } };

  const before = new Set(target.permissions.map((row) => row.permissionKey));
  const after = new Set(validation.data.permissions);
  const granted = [...after].filter((key) => !before.has(key));
  const revoked = [...before].filter((key) => !after.has(key));

  if (granted.length === 0 && revoked.length === 0) {
    return { success: true, data: { updated: false } };
  }

  // Hanya izin yang BARU diberikan yang diperiksa: mencabut izin yang tidak
  // dimiliki pemberi tidak pernah menaikkan hak siapa pun.
  const escalation = findEscalation(actor, granted);
  if (escalation) {
    return forbidden(`Anda tidak dapat memberikan izin yang tidak Anda miliki: ${escalation.key}.`);
  }

  try {
    await db.transaction(async (tx) => {
      await lockAdministrationTx(tx);
      await verifyRolePermissionSnapshotTx(
        tx,
        actor,
        target.id,
        target.updatedAt,
        before,
        after,
        origin === "AI_PROPOSAL",
      );
      if (revoked.length > 0) {
        for (const key of revoked) {
          await tx
            .delete(rolePermission)
            .where(
              and(
                eq(rolePermission.roleId, validation.data.roleId),
                eq(rolePermission.permissionKey, key),
              ),
            );
        }
      }
      if (granted.length > 0) {
        await tx
          .insert(rolePermission)
          .values(granted.map((key) => ({ roleId: validation.data.roleId, permissionKey: key })));
      }
      await tx
        .update(role)
        .set({ updatedAt: new Date() })
        .where(eq(role.id, validation.data.roleId));
      await tx.insert(auditLog).values({
        userId: actor.userId,
        action: AUDIT_ACTION_BY_ORIGIN[origin],
        targetTable: "role",
        targetId: validation.data.roleId,
        originalState: JSON.stringify({ permissions: [...before] }),
        newState: JSON.stringify({ permissions: [...after], granted, revoked }),
      });
    });
  } catch (error: unknown) {
    return administrationChangeFailure(error);
  }
  return { success: true, data: { updated: true } };
}

export async function updateRoleDetailsUseCase(
  actor: Actor,
  input: UpdateRoleDetailsInput,
): Promise<ActionResponse<{ readonly updated: boolean }>> {
  const parsed = updateRoleDetailsSchema.safeParse(input);
  if (!parsed.success)
    return invalid(parsed.error.issues[0]?.message ?? "Detail peran tidak valid.");
  try {
    await db.transaction((tx) =>
      writeAdministrationChangeTx(
        tx,
        actor,
        {
          action: "ROLE_DETAILS",
          roleId: parsed.data.roleId,
          patch: {
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            dataScope: parsed.data.dataScope,
          },
          reason: "Perubahan detail peran melalui formulir administrasi",
        },
        "SCREEN",
      ),
    );
    return { success: true, data: { updated: true } };
  } catch (error: unknown) {
    if (
      error instanceof AdministrationChangeError &&
      error.code === "VALIDATION_ERROR" &&
      error.message.includes("tidak ada perubahan")
    )
      return { success: true, data: { updated: false } };
    return administrationChangeFailure(error);
  }
}

/**
 * Menghapus peran ditolak selama masih dipakai.
 *
 * Memindahkan orang ke peran lain adalah keputusan sadar, bukan efek samping
 * dari menekan tombol hapus — dan pesannya menyebut jumlahnya supaya
 * penghapusnya tahu persis apa yang menghalangi.
 */
export async function deleteRoleUseCase(
  actor: Actor,
  input: DeleteRoleInput,
): Promise<ActionResponse<{ readonly deleted: true }>> {
  const parsed = deleteRoleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "Peran tidak valid.");
  try {
    await db.transaction((tx) =>
      writeAdministrationChangeTx(
        tx,
        actor,
        {
          action: "ROLE_DELETE",
          roleId: parsed.data.roleId,
          reason: "Penghapusan peran melalui formulir administrasi",
        },
        "SCREEN",
      ),
    );
    return { success: true, data: { deleted: true } };
  } catch (error: unknown) {
    return administrationChangeFailure(error);
  }
}
