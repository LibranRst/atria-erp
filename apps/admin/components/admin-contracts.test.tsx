import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthFrame } from "./auth-frame";
import { LoginForm } from "./login-form";
import { adminNavigation, adminPageLabel, avatarInitials } from "./admin-navigation";
import { atriaWebHref } from "./app-links";
import { passwordFieldErrors } from "./password-validation";

describe("standalone admin access and navigation contracts", (): void => {
  test("workspace entry does not invent domain access or unfinished module destinations", (): void => {
    expect(adminNavigation(["use:desktop_admin"])).toEqual([]);
    expect(adminNavigation(["use:desktop_admin", "view:budget"])).toEqual([
      { href: "/projects", label: "Proyek" },
    ]);
    expect(adminPageLabel("/projects/assigned-project/budget")).toBe("Budget proyek");
    expect(adminPageLabel("/account")).toBe("Akun saya");
    expect(avatarInitials("  Ronald Dekoria  ")).toBe("RD");
  });

  test("manual web handoff preserves canonical paths, query and hash and cannot escape its origin", (): void => {
    expect(atriaWebHref("/projects/p?tab=rap#material", "https://atria.example")).toBe(
      "https://atria.example/projects/p?tab=rap&surface=mobile#material",
    );
    expect(atriaWebHref("/onboarding/review?batch=123", "https://atria.example")).toBe(
      "https://atria.example/onboarding/review?batch=123&surface=mobile",
    );
    expect(() => atriaWebHref("//untrusted.example", "https://atria.example")).toThrow();
    expect(() => atriaWebHref("/", "javascript:alert(1)")).toThrow();
  });
});

describe("auth form semantics", (): void => {
  test("HeroUI sign-in fields remain labelled password-manager controls with one submit action", (): void => {
    const html = renderToStaticMarkup(
      <AuthFrame title="Masuk ke Admin" description="Gunakan akun Atria.">
        <LoginForm destination="/projects" />
      </AuthFrame>,
    );
    expect(html).toContain("Masuk ke Admin");
    expect(html).toMatch(/<input\b[^>]*name="email"/);
    expect(html).toMatch(/<input\b[^>]*type="email"/);
    expect(html).toContain('autoComplete="username"');
    expect(html).toMatch(/<input\b[^>]*name="password"/);
    expect(html).toMatch(/<input\b[^>]*type="password"/);
    expect(html).toContain('autoComplete="current-password"');
    expect(html.match(/type="submit"/g)).toHaveLength(1);
    const labels = [...html.matchAll(/<label\b[^>]*for="([^"]+)"/g)];
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(html).toContain(`id="${label[1]}"`);
    }
    expect(html).not.toContain("min-h-12");
    expect(html).not.toContain("data-atria-admin");
  });

  test("password form uses authoritative shared policy and catches confirm-only client mistakes", (): void => {
    const valid = {
      currentPassword: "Old-Password123",
      newPassword: "New-Password456",
      confirmPassword: "New-Password456",
    };
    expect(passwordFieldErrors(valid, false)).toEqual({});
    expect(passwordFieldErrors(valid, true)).toEqual({});
    expect(
      passwordFieldErrors({ ...valid, newPassword: "short", confirmPassword: "short" }, false)
        .newPassword,
    ).toContain("12");
    expect(passwordFieldErrors({ ...valid, confirmPassword: "typo" }, false).confirmPassword).toBe(
      "Konfirmasi kata sandi belum sama.",
    );
    expect(
      passwordFieldErrors(
        { ...valid, newPassword: valid.currentPassword, confirmPassword: valid.currentPassword },
        true,
      ).newPassword,
    ).toContain("sementara");
  });
});
