import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  canUseTemporaryPasswordDuringDeveloperSimulation,
  isDeveloperAccountSimulationEnabled,
} from "@atria/core/auth/developer-account-simulation";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  /*
   * `getSessionCookie` membaca nama cookie sesuai konfigurasi Better Auth.
   * Menuliskan `better-auth.session_token` langsung akan gagal di produksi:
   * di atas HTTPS Better Auth memakai prefiks `__Secure-`, sehingga pemeriksaan
   * manual tidak pernah menemukan sesi yang sah dan setiap halaman dipantulkan
   * kembali ke `/login`.
   */
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user || !session.user.isActive) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const canUseTemporaryPasswordDuringSimulation = canUseTemporaryPasswordDuringDeveloperSimulation({
    simulationEnabled: isDeveloperAccountSimulationEnabled(),
    developerActorUserId: session.session.developerActorUserId,
    effectiveRoleId: session.user.roleId,
  });
  if (
    session.user.mustChangePassword &&
    request.nextUrl.pathname !== "/profile/password" &&
    !canUseTemporaryPasswordDuringSimulation
  ) {
    return NextResponse.redirect(new URL("/profile/password", request.url));
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Berkas PWA statis ikut dikecualikan karena permintaannya tidak selalu
   * membawa cookie sesi: peramban memuat ulang skrip service worker untuk
   * memeriksa pembaruan, memasang ikon manifest, dan menyajikan halaman offline
   * dari cache. Pengalihan ke `/login` di jalur-jalur itu membuat pemeriksaan
   * pembaruan worker gagal dan halaman offline tersimpan sebagai halaman login.
   * Isinya tidak memuat data perusahaan: manifest, ikon, skrip worker, dan satu
   * halaman pemberitahuan tanpa sesi.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|notification-sw.js|icons/|offline|login|setup).*)",
  ],
};
