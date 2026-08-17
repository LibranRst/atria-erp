import { auth } from "@/lib/auth";
import { signImagekit } from "@/app/actions/media/sign-imagekit";
import { describe, it, expect, afterAll, mock } from "bun:test";
import crypto from "crypto";

// Mock next/headers untuk mencegah error cookies() di luar server Next.js
mock.module("next/headers", () => {
  return {
    cookies: () => {
      return {
        toString: () => "mocked-cookies",
      };
    },
  };
});

// Simpan method original
const originalGetSession = (auth.api as unknown as { getSession: unknown }).getSession;

// Helper untuk mock sesi pengguna
function mockUserSession(user: { id: string; roleId: string; email: string; name: string } | null) {
  const mockFn = async (): Promise<unknown> => {
    if (!user) return null;
    return {
      session: {
        id: "mock-session-id",
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        token: "mock-token",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      user: {
        id: user.id,
        roleId: user.roleId,
        email: user.email,
        name: user.name,
        emailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  };
  (auth.api as unknown as { getSession: unknown }).getSession = mockFn;
}

function restoreUserSession() {
  (auth.api as unknown as { getSession: unknown }).getSession = originalGetSession;
}

const PM_BUDI_USER = {
  id: "33333333-3333-3333-3333-333333333331",
  roleId: "00000000-0000-0000-0000-000000000003",
  email: "budi@dekoria.com",
  name: "Budi Santoso",
};

describe("Atria ERP Media Actions - TSK-011 signImagekit", () => {
  afterAll(() => {
    restoreUserSession();
  });

  it("harus menolak permohonan signature jika sesi pengguna tidak valid", async () => {
    mockUserSession(null);

    const res = await signImagekit();
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("harus menghasilkan parameter otentikasi ImageKit yang valid untuk sesi yang sah", async () => {
    mockUserSession(PM_BUDI_USER);

    const res = await signImagekit();
    expect(res.success).toBe(true);

    if (res.success) {
      const { token, expire, signature } = res.data;

      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThan(10);
      expect(expire).toBeGreaterThan(Math.floor(Date.now() / 1000));

      // Verifikasi ulang signature di sisi test menggunakan private key env
      const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || "";
      expect(privateKey).not.toBe("");

      const expectedSignature = crypto
        .createHmac("sha1", privateKey)
        .update(token + expire)
        .digest("hex");

      expect(signature).toBe(expectedSignature);
    }
  });
});
