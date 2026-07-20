import { db } from "@/db";
import { project } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveRoleName } from "./permissions";

/**
 * Menghasilkan kondisi filter Drizzle ORM untuk kueri tabel `project`.
 * 
 * - OWNER & FINANCE_ADMIN: Mengembalikan `undefined` (tidak ada filter, akses global).
 * - PROJECT_MANAGER & DESIGNER: Mengembalikan filter `eq(project.projectManagerId, userId)`.
 * - Peran lainnya: Mengembalikan kondisi palsu agar data tidak bocor.
 * 
 * @param userId ID pengguna aktif
 * @param roleName Nama peran (misal: "PROJECT_MANAGER")
 * @returns Ekspresi Drizzle SQL filter atau `undefined`
 */
export function scopeProjectQuery(userId: string, roleName: string) {
  const normalizedRole = roleName.toUpperCase();

  if (normalizedRole === "OWNER" || normalizedRole === "FINANCE_ADMIN") {
    return undefined; // Akses global - tidak ada filter penugasan proyek
  }

  if (normalizedRole === "PROJECT_MANAGER" || normalizedRole === "DESIGNER") {
    return eq(project.projectManagerId, userId);
  }

  // Untuk peran lain yang tidak memiliki izin membaca proyek
  // Kembalikan filter UUID kosong agar mengembalikan 0 baris data
  return eq(project.id, "00000000-0000-0000-0000-000000000000");
}

/**
 * Memverifikasi apakah seorang pengguna diizinkan untuk mengakses proyek tertentu.
 * Jika tidak diizinkan, fungsi ini melempar error "UNAUTHORIZED".
 * 
 * @param projectId ID proyek target
 * @param userId ID pengguna aktif
 * @param roleIdOrName ID Peran (UUID) atau nama peran string (misal: "PROJECT_MANAGER")
 */
export async function assertProjectAccess(
  projectId: string,
  userId: string,
  roleIdOrName: string
): Promise<void> {
  let roleName = roleIdOrName;

  // Jika input berupa UUID, konversi terlebih dahulu ke nama peran
  if (roleIdOrName.includes("-") && roleIdOrName.length === 36) {
    roleName = await resolveRoleName(roleIdOrName);
  }

  const normalizedRole = roleName.toUpperCase();

  // OWNER dan FINANCE_ADMIN memiliki otorisasi penuh secara global
  if (normalizedRole === "OWNER" || normalizedRole === "FINANCE_ADMIN") {
    return;
  }

  // PROJECT_MANAGER dan DESIGNER dibatasi hanya pada proyek di mana mereka ditugaskan
  if (normalizedRole === "PROJECT_MANAGER" || normalizedRole === "DESIGNER") {
    const assignedProject = await db.query.project.findFirst({
      where: and(
        eq(project.id, projectId),
        eq(project.projectManagerId, userId)
      ),
    });

    if (!assignedProject) {
      throw new Error("UNAUTHORIZED: Anda tidak ditugaskan pada proyek ini.");
    }
    return;
  }

  // Peran lain tidak memiliki hak akses
  throw new Error(`UNAUTHORIZED: Peran ${roleName} tidak diizinkan mengakses proyek.`);
}

/**
 * Operational transactions are allowed only after the project has been
 * explicitly activated. Draft projects remain available for budget, RAP, and
 * RAB setup through their normal scoped actions.
 */
export async function assertProjectIsOperational(projectId: string): Promise<void> {
  const projectRecord = await db.query.project.findFirst({
    where: eq(project.id, projectId),
    columns: { status: true },
  });

  assertProjectStatusIsOperational(projectRecord?.status);
}

export function assertProjectStatusIsOperational(status: string | undefined): void {
  if (status !== "ACTIVE") {
    throw new Error("PROJECT_NOT_ACTIVE: Proyek belum Aktif. Aktifkan proyek sebelum mencatat transaksi atau pergerakan stok.");
  }
}
