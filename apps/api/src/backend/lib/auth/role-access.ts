import { cache } from "@runtime/react-cache";
import { eq, ilike } from "drizzle-orm";

import { db } from "@backend/db";
import { role } from "@backend/db/schema";
import { getAllCatalogPermissionKeys } from "@atria/core/auth/permission-catalog";
import { type PermissionKey, type RoleDataScope } from "@atria/core/auth/permissions";

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
 * Daftar kosong adalah pencabutan semua izin, bukan permintaan fallback seed.
 * Instalasi lama harus menjalankan migrasi permission sebelum menerima request.
 */
export const getRoleAccess = cache(async (roleId: string): Promise<RoleAccess | null> => {
  try {
    const record = await db.query.role.findFirst({
      where: eq(role.id, roleId),
      with: { permissions: { columns: { permissionKey: true } } },
    });
    if (!record) return null;

    const roleName = record.name.toUpperCase();
    const storedKeys = record.permissions.map((row) => row.permissionKey as PermissionKey);

    return {
      roleId: record.id,
      roleName,
      permissions: storedKeys,
      dataScope: isDataScope(record.dataScope) ? record.dataScope : "NONE",
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
export const getRoleAccessByName = cache(async (roleName: string): Promise<RoleAccess | null> => {
  const normalized = roleName.trim().toUpperCase();
  if (!normalized) return null;
  // Match one literal name across every casing. LIKE metacharacters in custom
  // role names must not turn a permission lookup into a wildcard search.
  const literalName = normalized.replace(
    /[\\%_]/g,
    (character: string): string => `\\${character}`,
  );
  try {
    const records = await db.query.role.findMany({
      where: ilike(role.name, literalName),
      columns: { id: true },
    });
    // Nama ambigu tidak boleh memilih role dengan hak yang lebih tinggi.
    if (records.length !== 1) return null;
    return getRoleAccess(records[0].id);
  } catch (error) {
    console.error("Gagal membaca akses peran dari database:", error);
    return null;
  }
});

export async function roleNameHasPermission(
  roleName: string | null | undefined,
  permission: PermissionKey,
): Promise<boolean> {
  if (!roleName) return false;
  const access = await getRoleAccessByName(roleName);
  return access?.permissions.includes(permission) ?? false;
}

export async function getRoleDataScopeByName(roleName: string): Promise<RoleDataScope> {
  const access = await getRoleAccessByName(roleName);
  return access?.dataScope ?? "NONE";
}

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
