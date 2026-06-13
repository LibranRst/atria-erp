import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const ROLE_OWNER_ID = "00000000-0000-0000-0000-000000000001";
const ROLE_FINANCE_ADMIN_ID = "00000000-0000-0000-0000-000000000002";

type SessionUserWithRole = {
  roleId?: string;
};

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const { pathname } = request.nextUrl;

  // 1. Verifikasi apakah pengguna terautentikasi
  if (!session || !session.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Ambil roleId dari user tambahan Better Auth
  const userRoleId = (session.user as SessionUserWithRole).roleId;

  // 2. Proteksi Rute Ledger (Hanya OWNER dan FINANCE_ADMIN)
  if (pathname.startsWith("/ledger")) {
    if (userRoleId !== ROLE_OWNER_ID && userRoleId !== ROLE_FINANCE_ADMIN_ID) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs", // Diperlukan agar auth.api.getSession dapat melakukan query ke database pg
  matcher: [
    "/projects/:path*",
    "/ledger/:path*",
    "/expenses/new/:path*",
    "/profile/:path*",
  ],
};
