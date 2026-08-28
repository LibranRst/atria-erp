import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { role } from "@/db/schema";
import { getAllCatalogPermissionKeys } from "@atria/core/auth/permission-catalog";
import {
  getRoleDataScope as getSeedRoleDataScope,
  ROLE_PERMISSIONS,
  type PermissionKey,
  type RoleDataScope,
} from "@atria/core/auth/permissions";

export type RoleAccess = {
  readonly roleId: string;
  readonly roleName: string;
  readonly permissions: readonly PermissionKey[];
  readonly dataScope: RoleDataScope;
};

function isDataScope(value: string): value is RoleDataScope {
  return value === "GLOBAL" || value === "ASSIGNED" || value === "NONE";
}

/**
 * Sumber kebenaran akses sebuah peran: tabel `role` dan `role_permission`.
 *
 * `cache()` membatasi biayanya pada satu kueri per peran per request — dan
 * sengaja tidak lebih lama dari itu. Izin yang di-cache lintas request akan
 * basi tepat ketika ketepatannya paling penting, yaitu sesaat setelah Owner
 * mencabutnya.
 *
 * **Cadangan ke matriks kode** dipakai ketika peran belum punya satu pun baris
 * izin — keadaan database yang belum menjalankan migrasi seed. Tanpa cadangan
 * itu, menjalankan aplikasi terhadap database lama akan menampilkan setiap
 * pengguna sebagai "peran tanpa izin", yang tampak seperti kerusakan data alih-alih
 * migrasi yang tertinggal. Peran yang memang sengaja dikosongkan izinnya oleh
 * Owner bukan kasus ini: ia tetap punya baris di tabel, hanya nol.
 */
export const getRoleAccess = cache(async (roleId: string): Promise<RoleAccess | null> => {
  try {
    const record = await db.query.role.findFirst({
      where: eq(role.id, roleId),
      with: { permissions: { columns: { permissionKey: true } } },
    });
    if (!record) return null;

    const roleName = record.name.toUpperCase();
    const seeded = ROLE_PERMISSIONS[roleName] ?? [];
    const storedKeys = record.permissions.map((row) => row.permissionKey as PermissionKey);

    return {
      roleId: record.id,
      roleName,
      permissions: record.permissions.length > 0 ? storedKeys : seeded,
      dataScope: isDataScope(record.dataScope)
        ? record.dataScope
        : getSeedRoleDataScope(roleName),
    };
  } catch (error) {
    console.error("Gagal membaca akses peran dari database:", error);
    return null;
  }
});

/**
 * Daftar izin efektif sebuah peran. Peran tak dikenal mendapat daftar kosong —
 * gagal ke arah tertutup.
 */
export async function getRolePermissions(roleId: string): Promise<readonly PermissionKey[]> {
  const access = await getRoleAccess(roleId);
  return access?.permissions ?? [];
}

export async function roleHasPermission(
  roleId: string,
  permission: PermissionKey,
): Promise<boolean> {
  const permissions = await getRolePermissions(roleId);
  return permissions.includes(permission);
}

export async function getRoleDataScopeFromDb(roleId: string): Promise<RoleDataScope> {
  const access = await getRoleAccess(roleId);
  return access?.dataScope ?? "NONE";
}

/**
 * Cakupan data berdasarkan **nama** peran.
 *
 * Ada karena penjaga cakupan yang sudah tersebar di aplikasi memegang nama
 * peran, bukan `roleId`. Membaca dari kolom `role.data_scope` di sini adalah
 * yang membuat peran kustom benar-benar punya cakupan — tanpa ini, tabel seed
 * akan menjawab "NONE" untuk setiap peran yang tidak dikenal kode, dan peran
 * buatan Owner akan selalu melihat nol proyek.
 */
export const getRoleDataScopeByName = cache(async (roleName: string): Promise<RoleDataScope> => {
  const normalized = roleName.toUpperCase();
  try {
    const record = await db.query.role.findFirst({
      where: eq(role.name, normalized.toLowerCase()),
      columns: { dataScope: true },
    });
    if (record && isDataScope(record.dataScope)) return record.dataScope;

    const byUpper = await db.query.role.findFirst({
      where: eq(role.name, normalized),
      columns: { dataScope: true },
    });
    if (byUpper && isDataScope(byUpper.dataScope)) return byUpper.dataScope;
  } catch (error) {
    console.error("Gagal membaca cakupan peran dari database:", error);
  }
  return getSeedRoleDataScope(normalized);
});

/**
 * Daftar seluruh kunci izin yang dikenal kode.
 *
 * Owner hanya menyalakan/mematikan kunci dari daftar ini; ia tidak pernah
 * membuat kunci baru, karena kunci yang belum ditegakkan kode adalah janji
 * kosong.
 *
 * Sumbernya katalog, bukan matriks seed: kunci yang kebetulan belum dipegang
 * peran bawaan mana pun tetap kunci yang sah untuk diberikan ke peran baru.
 * Menurunkannya dari matriks seed akan membuat server menolak kunci yang
 * ditampilkan layarnya sendiri.
 */
export function getAllPermissionKeys(): readonly PermissionKey[] {
  return getAllCatalogPermissionKeys();
}
