import "server-only";

import { db } from "@/db";
import { project } from "@/db/schema";
import { ROLE_PERMISSIONS, type PermissionKey } from "@/lib/auth/permissions";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Konteks sesi yang ditutup (closure) ke dalam setiap tool.
 *
 * Model bahasa TIDAK PERNAH mengirimkan identitas pengguna atau peran.
 * Nilai-nilai ini hanya berasal dari sesi terverifikasi di route handler,
 * sehingga model tidak bisa memperluas aksesnya sendiri lewat argumen tool.
 */
export type AiToolContext = {
  readonly userId: string;
  readonly roleName: string;
};

/**
 * Peran dengan akses finansial global. Peran lain dibatasi pada proyek
 * yang mereka pegang sendiri.
 */
const GLOBAL_SCOPE_ROLES = new Set(["OWNER", "FINANCE_ADMIN"]);

export function hasGlobalScope(context: AiToolContext): boolean {
  return GLOBAL_SCOPE_ROLES.has(context.roleName);
}

/**
 * Memverifikasi bahwa sesi berhak membaca sebuah proyek.
 *
 * Wajib dipanggil oleh setiap tool yang menerima `projectId` dari model,
 * karena nilai itu berasal dari keluaran model dan tidak boleh dipercaya.
 */
export async function canAccessProject(
  context: AiToolContext,
  projectId: string,
): Promise<boolean> {
  if (hasGlobalScope(context)) {
    const found = await db.query.project.findFirst({
      where: eq(project.id, projectId),
      columns: { id: true },
    });
    return found !== undefined;
  }

  const scoped = await db.query.project.findFirst({
    where: and(eq(project.id, projectId), eq(project.projectManagerId, context.userId)),
    columns: { id: true },
  });
  return scoped !== undefined;
}

/**
 * Pesan penolakan yang dikembalikan ke model ketika akses proyek ditolak.
 * Sengaja tidak membocorkan apakah proyeknya ada atau tidak.
 */
export const PROJECT_ACCESS_DENIED = {
  error: "Proyek tidak ditemukan atau di luar akses Anda.",
} as const;

/**
 * Pemeriksaan izin yang tidak melempar, untuk dipakai di dalam tool.
 *
 * Tool mengembalikan penolakan sebagai data supaya model bisa menjelaskannya
 * kepada pengguna, bukan melempar error yang menghentikan seluruh jawaban.
 * Sumber kebenarannya tetap `ROLE_PERMISSIONS` yang sama dengan yang ditegakkan
 * di Server Action.
 */
export function hasPermission(context: AiToolContext, permission: PermissionKey): boolean {
  return (ROLE_PERMISSIONS[context.roleName] ?? []).includes(permission);
}

export function permissionDenied(what: string): { readonly error: string } {
  return { error: `Peran Anda tidak memiliki akses ke ${what}.` };
}

/**
 * Daftar id proyek yang boleh dibaca sesi ini.
 *
 * Dipakai oleh tool yang mengembalikan banyak baris lintas proyek, supaya
 * pembatasan terjadi di dalam query dan bukan setelah data terlanjur terbaca.
 * Peran berlingkup global mendapat `null`, artinya tanpa pembatasan.
 */
export async function accessibleProjectIds(context: AiToolContext): Promise<string[] | null> {
  if (hasGlobalScope(context)) {
    return null;
  }

  const rows = await db.query.project.findMany({
    where: eq(project.projectManagerId, context.userId),
    columns: { id: true },
  });
  return rows.map((row) => row.id);
}

/**
 * Membentuk kondisi pembatas proyek untuk query lintas proyek.
 * Mengembalikan `undefined` untuk peran global, dan kondisi yang tidak pernah
 * cocok ketika pengguna tidak memegang proyek sama sekali.
 */
export function projectScopeCondition(
  projectIds: string[] | null,
  column: Parameters<typeof inArray>[0],
) {
  if (projectIds === null) return undefined;
  return inArray(column, projectIds.length > 0 ? projectIds : [NO_PROJECT_SENTINEL]);
}

/** Id yang dijamin tidak pernah cocok, dipakai saat pengguna tidak memegang proyek. */
const NO_PROJECT_SENTINEL = "00000000-0000-0000-0000-000000000000";
