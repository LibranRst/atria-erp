import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const sessionCookie = request.cookies.get("better-auth.session_token");

  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/projects/:path*",
    "/ledger/:path*",
    "/expenses/new/:path*",
    "/profile/:path*",
  ],
};
