import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export type ServerSession = Awaited<ReturnType<typeof auth.api.getSession>>;
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
    return await auth.api.getSession({ headers: requestHeaders });
  } catch (error) {
    console.error("Failed to read Better Auth session:", error);
    return null;
  }
}

/**
 * Jalur web (Server Component / Server Action): sesi selalu datang dari cookie.
 *
 * Sengaja **tidak** memakai `headers()` dari `next/headers`. Fungsi itu melempar
 * error di luar request scope, dan karena `getServerSession` dibungkus
 * try/catch, kegagalannya akan tampak sebagai "tidak ada sesi" — bukan sebagai
 * error. Klien native tidak lewat sini; ia memakai `getSessionFromHeaders`
 * dengan `Headers` asli dari request, sehingga `Authorization: Bearer` terbaca.
 */
export async function getServerSession(): Promise<ServerSession> {
  const requestHeaders = new Headers();
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
