import { db } from "@/db";
import { role } from "@/db/schema";
import {
  actorHasPermission,
  type PermissionKey,
  resolveStaticRoleName,
} from "@atria/core/auth/permissions";
import { eq } from "drizzle-orm";

/**
 * Sisi server dari perizinan: resolusi peran lewat database dan assertion yang
 * melempar error.
 *
 * Matriks dan tipe murninya hidup di `@atria/core/auth/permissions` supaya
 * Client Component dan klien native bisa memakainya tanpa menarik Drizzle ke
 * dalam bundle. Re-export di bawah menjaga jalur impor lama tetap bekerja untuk
 * pemanggil sisi server — **jangan** dipakai dari file `"use client"`; impor
 * langsung dari `@atria/core/auth/permissions` di sana.
 */
export {
  actorHasPermission,
  ROLE_ID_TO_NAME,
  ROLE_PERMISSIONS,
  resolveStaticRoleName,
} from "@atria/core/auth/permissions";
export type { PermissionKey } from "@atria/core/auth/permissions";

/**
 * Menyelesaikan UUID role menjadi nama peran (string uppercase).
 * Menggunakan pencocokan statis terlebih dahulu sebelum melakukan fallback ke database.
 *
 * @param roleId UUID peran dari database/session
 * @returns Nama peran dalam format string huruf besar (misal: "PROJECT_MANAGER")
 */
export async function resolveRoleName(roleId: string): Promise<string> {
  const staticName = resolveStaticRoleName(roleId);
  if (staticName) {
    return staticName;
  }

  try {
    const dbRole = await db.query.role.findFirst({
      where: eq(role.id, roleId),
    });
    return dbRole?.name ? dbRole.name.toUpperCase() : "UNKNOWN";
  } catch (error) {
    console.error("Gagal mendeteksi nama peran dari database:", error);
    return "UNKNOWN";
  }
}

interface UserSessionAuth {
  id: string;
  roleId?: string;
  role?: string;
}

/**
 * Memverifikasi apakah pengguna memiliki izin yang diperlukan untuk melakukan aksi tertentu.
 * Jika tidak memiliki izin, fungsi ini akan melempar kesalahan (error) "FORBIDDEN".
 *
 * @param user Objek user dari sesi (minimal harus memiliki id dan salah satu dari roleId atau role)
 * @param permission Kunci izin finansial yang ingin diverifikasi
 */
export async function assertPermission(
  user: UserSessionAuth,
  permission: PermissionKey,
): Promise<void> {
  let roleName = user.role?.toUpperCase();

  if (!roleName && user.roleId) {
    roleName = await resolveRoleName(user.roleId);
  }

  if (!roleName) {
    throw new Error("FORBIDDEN: Pengguna tidak memiliki peran yang valid.");
  }

  if (!actorHasPermission(roleName, permission)) {
    throw new Error(`FORBIDDEN: Peran ${roleName} tidak memiliki izin ${permission}`);
  }
}
