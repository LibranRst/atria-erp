import "server-only";

import { resolveRoleName } from "@/lib/auth/permissions";
import { getRoleAccess } from "@/lib/auth/role-access";
import type { PermissionKey, RoleDataScope } from "@atria/core/auth/permissions";
import { getServerSession, getSessionFromHeaders } from "@/lib/server/session";

/**
 * Identitas pemanggil yang sudah diselesaikan, termasuk nama peran.
 *
 * Use-case menerima objek ini alih-alih membaca `next/headers` sendiri. Itulah
 * yang membuat satu badan logika bisa dipakai dua transport: Server Action
 * (cookie) dan tRPC (cookie atau `Authorization: Bearer`). Peran di-resolve
 * sekali per request di sini, bukan berulang kali di dalam action.
 */
export type Actor = {
  readonly userId: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly name: string;
  readonly email: string;
  readonly image?: string | null;
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
  /**
   * Sesi yang sedang dipakai pemanggil.
   *
   * Dibawa supaya operasi yang mencabut sesi bisa menyisakan sesi ini — ganti
   * kata sandi mandiri tidak seharusnya mengeluarkan pengguna dari perangkat
   * yang baru saja dipakainya mengganti kata sandi.
   */
  readonly sessionId: string;
  /**
   * Izin efektif peran ini, dibaca dari database sekali per request.
   *
   * Dibawa di `Actor` — bukan dibaca ulang di setiap use-case — supaya satu
   * request tidak pernah menegakkan dua jawaban berbeda untuk pengguna yang
   * sama, misalnya ketika Owner menyunting peran tepat di tengah request.
   */
  readonly permissions: readonly PermissionKey[];
  readonly dataScope: RoleDataScope;
  /** Dibawa supaya gerbang kata sandi sementara bisa menghormati mode simulasi developer. */
  readonly developerActorUserId: string | null;
};

type SessionUser = {
  readonly id: string;
  readonly roleId: string;
  readonly name?: string | null;
  readonly email?: string | null;
  readonly image?: string | null;
  readonly isActive?: boolean | null;
  readonly mustChangePassword?: boolean | null;
};

type SessionRecord = {
  readonly id?: string | null;
  readonly developerActorUserId?: string | null;
};

async function toActor(
  user: SessionUser | undefined,
  session: SessionRecord | undefined,
): Promise<Actor | null> {
  if (!user) return null;

  // `isActive` yang eksplisit `false` memblokir; `undefined` dianggap aktif
  // supaya sesi lama tanpa kolom itu tidak tiba-tiba tertolak.
  if (user.isActive === false) return null;

  const access = await getRoleAccess(user.roleId);

  return {
    userId: user.id,
    roleId: user.roleId,
    roleName: access?.roleName ?? (await resolveRoleName(user.roleId)),
    permissions: access?.permissions ?? [],
    dataScope: access?.dataScope ?? "NONE",
    name: user.name ?? "",
    email: user.email ?? "",
    image: user.image ?? null,
    isActive: user.isActive ?? true,
    mustChangePassword: user.mustChangePassword ?? false,
    // Kosong hanya jika sesi tidak terbaca sama sekali. Konsumennya memakai ini
    // sebagai "sesi yang dikecualikan dari pencabutan", jadi nilai kosong
    // menggagalkan ke arah aman: semua sesi ikut dicabut.
    sessionId: session?.id ?? "",
    developerActorUserId: session?.developerActorUserId ?? null,
  };
}

/** Jalur Server Action / Server Component — sesi dari cookie. */
export async function resolveActor(): Promise<Actor | null> {
  const session = await getServerSession();
  return toActor(
    session?.user as SessionUser | undefined,
    session?.session as SessionRecord | undefined,
  );
}

/**
 * Jalur tRPC — menerima `Headers` asli dari request, sehingga cookie (web) dan
 * `Authorization: Bearer` (klien native) sama-sama terbaca.
 */
export async function resolveActorFromHeaders(requestHeaders: Headers): Promise<Actor | null> {
  const session = await getSessionFromHeaders(requestHeaders);
  return toActor(
    session?.user as SessionUser | undefined,
    session?.session as SessionRecord | undefined,
  );
}
