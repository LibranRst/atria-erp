import { db } from "@backend/db";
import { project, INSTANCE_TENANT_ID } from "@backend/db/schema";
import type { RoleDataScope } from "@atria/core/auth/permissions";
import { type PermissionKey } from "@backend/lib/auth/permissions";
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
  readonly roleId: string;
  /**
   * Izin efektif sesi, diselesaikan dari database di route handler.
   *
   * Dulu tool menurunkannya sendiri dari `ROLE_PERMISSIONS[roleName]`. Sejak
   * izin sebuah peran bisa disunting Owner, matriks itu hanya nilai awal —
   * membacanya di sini membuat batas asisten menyimpang dari batas yang
   * ditegakkan Server Action, tanpa ada yang menyadarinya.
   */
  readonly permissions: readonly PermissionKey[];
  readonly dataScope: RoleDataScope;
  /** Validated human text, separate from extracted attachment/model content. */
  readonly userQuestion?: string;
  /** One server clock snapshot for all relative-period reads in this turn. */
  readonly asOf?: string;
};

/**
 * Cakupan data tool AI adalah cakupan data yang sama dengan halaman.
 *
 * Dulu himpunan peran ini ditulis ulang di sini, sehingga batas AI bisa
 * menyimpang dari batas halaman tanpa ada yang menyadarinya — persis kelas
 * kesalahan yang paling mahal untuk asisten yang membaca data finansial.
 * Sekarang cakupannya datang dari kolom `role.data_scope` yang sama.
 */
export function hasGlobalScope(context: AiToolContext): boolean {
  return context.dataScope === "GLOBAL";
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
      where: and(eq(project.id, projectId), eq(project.tenantId, INSTANCE_TENANT_ID)),
      columns: { id: true },
    });
    return found !== undefined;
  }

  if (context.dataScope !== "ASSIGNED") return false;
  const scoped = await db.query.project.findFirst({
    where: and(
      eq(project.id, projectId),
      eq(project.tenantId, INSTANCE_TENANT_ID),
      eq(project.projectManagerId, context.userId),
    ),
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
 * Sumber kebenarannya adalah daftar izin efektif yang sama dengan yang
 * ditegakkan Server Action.
 */
export function hasPermission(context: AiToolContext, permission: PermissionKey): boolean {
  return context.permissions.includes(permission);
}

export function permissionDenied(what: string): { readonly error: string } {
  return { error: `Peran Anda tidak memiliki akses ke ${what}.` };
}

/**
 * Topik yang tool-nya digerbangi izin atau lingkup global, dipasangkan dengan
 * penjelasan singkat untuk system prompt.
 *
 * Setiap entri di sini HARUS mencerminkan gerbang `hasPermission`/`hasGlobalScope`
 * yang sungguh ada di tool terkait (lihat `finance-tools.ts`). Daftar ini yang
 * membuat `suggestFollowUps` tidak menyarankan pertanyaan yang tool-nya sendiri
 * pasti akan menolak — tanpa ini, model hanya tahu "proyek yang dia pegang
 * sendiri" secara umum, dan tidak tahu ada tool yang tertutup total untuk
 * perannya (saldo bank, antrean persetujuan lintas proyek).
 */
const RESTRICTED_TOPICS: readonly {
  readonly isRestricted: (context: AiToolContext) => boolean;
  readonly label: string;
}[] = [
  {
    // Cermin gerbang getBankBalances di finance-tools.ts.
    isRestricted: (context) => !hasPermission(context, "view:bank_account"),
    label: "saldo dan mutasi rekening bank perusahaan",
  },
  {
    // Cermin gerbang getPendingApprovals di finance-tools.ts.
    isRestricted: (context) => !hasGlobalScope(context),
    label: "antrean persetujuan lintas seluruh proyek perusahaan",
  },
  {
    // Cermin gerbang whoCanDo dan analyzeRoleChangeImpact di role-tools.ts.
    isRestricted: (context) => !hasPermission(context, "manage:roles"),
    label: "daftar pemegang izin dan simulasi perubahan peran",
  },
];

export function unavailableTopicsForRole(context: AiToolContext): string[] {
  return RESTRICTED_TOPICS.filter((topic) => topic.isRestricted(context)).map(
    (topic) => topic.label,
  );
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
  if (context.dataScope !== "ASSIGNED") return [];

  const rows = await db.query.project.findMany({
    where: and(
      eq(project.tenantId, INSTANCE_TENANT_ID),
      eq(project.projectManagerId, context.userId),
    ),
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
