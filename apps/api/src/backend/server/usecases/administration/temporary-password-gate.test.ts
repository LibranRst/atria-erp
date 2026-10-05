import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..", "..", "..", "..", "..");
const MOBILE_ROOT = path.join(REPO_ROOT, "apps/mobile/src");

/**
 * Kontrak klien untuk P2.1.
 *
 * Gerbang server (`activeProcedure`) sudah diuji terpisah. Test ini menjaga sisi
 * klien yang tidak akan tertangkap typecheck: akun dengan kata sandi sementara
 * harus punya layar tujuan yang nyata di perangkat, dan tidak boleh lagi
 * diarahkan keluar ke Atria web seperti sebelum P2.1.
 */
describe("native temporary password gate", () => {
  const layoutSource = readFileSync(path.join(MOBILE_ROOT, "app/_layout.tsx"), "utf8");

  test("layar /profile/password tersedia di klien native", () => {
    expect(existsSync(path.join(MOBILE_ROOT, "app/profile/password.tsx"))).toBe(true);
  });

  test("gate mengurung akun kata sandi sementara ke layar password", () => {
    expect(layoutSource).toContain("mustChangePassword");
    expect(layoutSource).toContain('name="profile/password"');
    expect(layoutSource).toMatch(/guard=\{mustChangePassword\}/);
  });

  test("shell operasional hanya terbuka saat kata sandi bukan sementara", () => {
    expect(layoutSource).toMatch(/canEnterApp\s*=\s*isAuthenticated\s*&&\s*!mustChangePassword/);
    expect(layoutSource).toMatch(/guard=\{canEnterApp\}/);
  });

  test("login native tidak lagi mengarahkan pengguna ke Atria web", () => {
    const loginSource = readFileSync(path.join(MOBILE_ROOT, "app/login.tsx"), "utf8");

    expect(loginSource).not.toContain("Atria web");
    expect(loginSource).not.toContain("mustChangePassword");
  });

  test("layar password memanggil mutation bersama dan membersihkan sesi lokal", () => {
    const screenSource = readFileSync(path.join(MOBILE_ROOT, "app/profile/password.tsx"), "utf8");

    expect(screenSource).toContain("administration.changeTemporaryPassword.mutate");
    expect(screenSource).toContain("signOut()");
    expect(screenSource).toContain("secureTextEntry");
    expect(screenSource).toContain("accessibilityLabel");
  });
});
