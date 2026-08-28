import "server-only";

import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLog, role, rolePermission, user } from "@/db/schema";
import { getAllPermissionKeys } from "@/lib/auth/role-access";
import type { Actor } from "@/server/actor";
import { actorCan } from "@/lib/auth/permissions";
import { OWNER_ROLE_ID } from "@atria/core/auth/role-constants";
import type { PermissionKey, RoleDataScope } from "@atria/core/auth/permissions";
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

  const normalizedName = validation.data.name.trim().toUpperCase().replaceAll(" ", "_");
  const existing = await db.query.role.findFirst({ where: eq(role.name, normalizedName) });
  if (existing) return { success: false, error: { code: "CONFLICT", message: "Nama peran sudah dipakai." } };

  const created = await db.transaction(async (tx) => {
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
  if (!target) return { success: false, error: { code: "NOT_FOUND", message: "Peran tidak ditemukan." } };

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

  await db.transaction(async (tx) => {
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

  return { success: true, data: { updated: true } };
}

export async function updateRoleDetailsUseCase(
  actor: Actor,
  input: UpdateRoleDetailsInput,
): Promise<ActionResponse<{ readonly updated: boolean }>> {
  const validation = updateRoleDetailsSchema.safeParse(input);
  if (!validation.success)
    return invalid(validation.error.issues[0]?.message ?? "Peran tidak valid.");

  const blocked = await assertManageable<{ readonly updated: boolean }>(
    actor,
    validation.data.roleId,
  );
  if (blocked) return blocked;

  const target = await db.query.role.findFirst({ where: eq(role.id, validation.data.roleId) });
  if (!target) return { success: false, error: { code: "NOT_FOUND", message: "Peran tidak ditemukan." } };

  const normalizedName = validation.data.name.trim().toUpperCase().replaceAll(" ", "_");
  if (target.isSystem && normalizedName !== target.name) {
    return forbidden("Nama peran sistem tidak dapat diubah.");
  }

  const duplicate = await db.query.role.findFirst({
    where: and(eq(role.name, normalizedName), ne(role.id, target.id)),
  });
  if (duplicate)
    return { success: false, error: { code: "CONFLICT", message: "Nama peran sudah dipakai." } };

  const changed =
    normalizedName !== target.name ||
    (validation.data.description ?? null) !== target.description ||
    validation.data.dataScope !== target.dataScope;
  if (!changed) return { success: true, data: { updated: false } };

  await db.transaction(async (tx) => {
    await tx
      .update(role)
      .set({
        name: normalizedName,
        description: validation.data.description ?? null,
        dataScope: validation.data.dataScope,
        updatedAt: new Date(),
      })
      .where(eq(role.id, target.id));
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "UPDATE_ROLE_DETAILS",
      targetTable: "role",
      targetId: target.id,
      originalState: JSON.stringify({
        name: target.name,
        description: target.description,
        dataScope: target.dataScope,
      }),
      newState: JSON.stringify({
        name: normalizedName,
        description: validation.data.description ?? null,
        dataScope: validation.data.dataScope,
      }),
    });
  });

  return { success: true, data: { updated: true } };
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
  const validation = deleteRoleSchema.safeParse(input);
  if (!validation.success)
    return invalid(validation.error.issues[0]?.message ?? "Peran tidak valid.");

  const blocked = await assertManageable<{ readonly deleted: true }>(actor, validation.data.roleId);
  if (blocked) return blocked;

  const target = await db.query.role.findFirst({ where: eq(role.id, validation.data.roleId) });
  if (!target) return { success: false, error: { code: "NOT_FOUND", message: "Peran tidak ditemukan." } };
  if (target.isSystem) return forbidden("Peran sistem tidak dapat dihapus.");

  const holders = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(user)
    .where(eq(user.roleId, target.id));
  const userCount = holders[0]?.total ?? 0;
  if (userCount > 0) {
    return {
      success: false,
      error: {
        code: "CONFLICT",
        message: `Peran masih dipakai ${userCount} pengguna. Pindahkan mereka lebih dulu.`,
      },
    };
  }

  await db.transaction(async (tx) => {
    await tx.delete(role).where(eq(role.id, target.id));
    await tx.insert(auditLog).values({
      userId: actor.userId,
      action: "DELETE_ROLE",
      targetTable: "role",
      targetId: target.id,
      originalState: JSON.stringify({ name: target.name, dataScope: target.dataScope }),
    });
  });

  return { success: true, data: { deleted: true } };
}
