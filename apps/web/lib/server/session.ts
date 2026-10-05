import "server-only";

import type { ServerSession } from "@atria/api/contract";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { readBackendSession } from "@/lib/api/session";

export type { ServerSession } from "@atria/api/contract";
export type RequiredServerSession = NonNullable<ServerSession>;

/**
 * Jalur tunggal pembacaan sesi.
 *
 * Menerima `Headers` apa pun, sehingga cookie (web) dan
 * `Authorization: Bearer` (klien native) diproses plugin yang sama tanpa
 * percabangan di sisi pemanggil. Penting: objek `Headers` yang utuh harus
 * diteruskan — bentuk `{ cookie }` polos akan menjatuhkan header authorization
 * dan membuat plugin `bearer()` tidak pernah terpakai.
 */
export async function getSessionFromHeaders(requestHeaders: Headers): Promise<ServerSession> {
  try {
    return await readBackendSession(requestHeaders);
  } catch (error) {
    console.error("Failed to read Better Auth session:", error);
    return null;
  }
}

/**
 * Jalur web (Server Component / Server Action): sesi selalu datang dari cookie.
 *
 * Credential lengkap diteruskan ke API; Next tidak memeriksa database auth.
 */
export async function getServerSession(): Promise<ServerSession> {
  const requestHeaders = new Headers(await headers());
  requestHeaders.set("cookie", (await cookies()).toString());
  return getSessionFromHeaders(requestHeaders);
}

/**
 * Khusus jalur web — `redirect()` adalah control-flow throw milik Next.
 * Use-case bersama tidak boleh memanggil ini; mereka menerima `Actor` dan
 * mengembalikan status, bukan melakukan redirect.
 */
export async function requireServerSession(redirectTo = "/login"): Promise<RequiredServerSession> {
  const session = await getServerSession();
  if (!session?.user) {
    redirect(redirectTo);
  }
  return session;
}
