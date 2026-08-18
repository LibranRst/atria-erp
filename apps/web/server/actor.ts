import "server-only";

import { resolveRoleName } from "@/lib/auth/permissions";
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
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
  /** Dibawa supaya gerbang kata sandi sementara bisa menghormati mode simulasi developer. */
  readonly developerActorUserId: string | null;
};

type SessionUser = {
  readonly id: string;
  readonly roleId: string;
  readonly name?: string | null;
  readonly email?: string | null;
  readonly isActive?: boolean | null;
  readonly mustChangePassword?: boolean | null;
};

type SessionRecord = {
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

  return {
    userId: user.id,
    roleId: user.roleId,
    roleName: await resolveRoleName(user.roleId),
    name: user.name ?? "",
    email: user.email ?? "",
    isActive: user.isActive ?? true,
    mustChangePassword: user.mustChangePassword ?? false,
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
