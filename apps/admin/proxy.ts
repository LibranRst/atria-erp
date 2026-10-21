import type { ServerSession } from "@atria/api/contract";
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import {
  canUseTemporaryPasswordDuringDeveloperSimulation,
  isDeveloperAccountSimulationEnabled,
} from "@atria/core/auth/developer-account-simulation";
import { readBackendSession } from "@/lib/api/session";
import { ADMIN_COOKIE_PREFIX } from "@/lib/api/admin-cookies";
import { safeAdminReturnTo } from "@/lib/navigation/paths";

function loginURL(request: NextRequest): URL {
  const url = new URL("/login", request.url);
  url.searchParams.set(
    "returnTo",
    safeAdminReturnTo(`${request.nextUrl.pathname}${request.nextUrl.search}`),
  );
  return url;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!getSessionCookie(request, { cookiePrefix: ADMIN_COOKIE_PREFIX }))
    return NextResponse.redirect(loginURL(request));
  let session: ServerSession;
  try {
    session = await readBackendSession(request.headers);
  } catch {
    return new NextResponse("API belum dapat dihubungi. Coba lagi sebentar lagi.", {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
  if (!session?.user || !session.user.isActive) return NextResponse.redirect(loginURL(request));
  const simulationAllowsPassword = canUseTemporaryPasswordDuringDeveloperSimulation({
    simulationEnabled: isDeveloperAccountSimulationEnabled(),
    developerActorUserId: session.session.developerActorUserId,
    effectiveRoleId: session.user.roleId,
  });
  if (
    session.user.mustChangePassword &&
    request.nextUrl.pathname !== "/change-password" &&
    !simulationAllowsPassword
  )
    return NextResponse.redirect(new URL("/change-password", request.url));
  const requestHeaders = new Headers(request.headers);
  // Overwrite the caller's header so server gates see the actual route, never a claimed one.
  requestHeaders.set("x-atria-admin-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login|restricted).*)"],
};
