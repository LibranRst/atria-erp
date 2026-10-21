import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ProfileLoading from "@/app/profile/loading";
import { ProfileAccessList } from "./profile-access-list";
import { ProfileIdentitySurface } from "./profile-identity-surface";
import {
  countAccessibleProfileModules,
  summarizeProfileAccess,
} from "@/features/profile/utils/profile-access";
import { getProfileInitials } from "@atria/core/presentation/user-identity";
import { PERMISSION_GROUPS } from "@atria/core/auth/permission-catalog";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";

describe("Profile presentation", () => {
  test("desktop access table keeps every module and exposes partial or missing permissions", () => {
    const groups = summarizeProfileAccess(["view:settings", "view:budget"]);
    const html = renderToStaticMarkup(
      <WorkspacePresentationProvider presentation="desktop">
        <ProfileAccessList groups={groups} roleLabel="Project Manager" />
      </WorkspacePresentationProvider>,
    );
    expect(html).toContain('aria-label="Hak akses per modul"');
    expect(html).toContain('role="grid"');
    for (const group of groups) expect(html).toContain(group.title.replaceAll("&", "&amp;"));
    expect(html).toContain("Sebagian");
    expect(html).toContain("Tidak ada");
    expect(html).not.toContain("view:settings");
  });
  test("excludes deferred AI access from the active profile modules", () => {
    const groups = summarizeProfileAccess(["view:bank_account", "view:settings", "view:ai_brief"]);

    expect(groups).toHaveLength(PERMISSION_GROUPS.length - 1);
    expect(groups.map((group: { title: string }) => group.title)).not.toContain("AI Brief");
    expect(countAccessibleProfileModules(groups)).toBe(2);
  });

  test("historical desktop grants do not imply a responsive workspace restriction", () => {
    const scoped = summarizeProfileAccess(["view:project", "view:budget"]);
    const withLegacyGrant = summarizeProfileAccess([
      "view:project",
      "view:budget",
      "use:desktop_admin",
    ]);

    expect(scoped).toEqual(withLegacyGrant);
    expect(scoped.some((group) => group.key === "workspace")).toBe(false);
    expect(scoped.every((group) => group.permissions.length > 0)).toBe(true);
    expect(countAccessibleProfileModules(scoped)).toBe(
      countAccessibleProfileModules(withLegacyGrant),
    );
  });

  test("tidak menghitung izin tertunda pada penyebutnya", () => {
    /*
     * Owner memegang `use:ai_chat` dan `view:ai_brief`. Penyaring AI CFO dulu
     * hanya mengenai pembilang, sehingga modul Asisten AI terbaca "1/2" —
     * mengumumkan hak yang hilang untuk fitur yang memang belum ada.
     */
    const groups = summarizeProfileAccess(["use:ai_chat", "view:ai_brief"]);
    const ai = groups.find((group: { key: string }) => group.key === "ai");

    expect(ai?.totalCount).toBe(1);
    expect(ai?.grantedCount).toBe(1);
    expect(ai?.permissions.map((permission: { key: string }) => permission.key)).toEqual([
      "use:ai_chat",
    ]);
  });

  test("menyebut hak yang tidak diberikan, bukan hanya yang diberikan", () => {
    // "7 dari 8" hanya berguna kalau yang satu itu bisa ditemukan.
    const groups = summarizeProfileAccess(["view:settings"]);
    const settings = groups.find((group: { key: string }) => group.key === "settings");
    const html = renderToStaticMarkup(<ProfileAccessList groups={groups} roleLabel="Owner" />);

    expect(settings?.grantedCount).toBe(1);
    expect(settings?.totalCount).toBeGreaterThan(1);
    expect(settings?.permissions.some((p: { granted: boolean }) => !p.granted)).toBe(true);
    expect(html).toContain("Sebagian");
  });

  test("renders grouped module access with Indonesian labels", () => {
    const groups = summarizeProfileAccess(["view:budget", "view:material"]);
    const html = renderToStaticMarkup(
      <ProfileAccessList groups={groups} roleLabel="Project Manager" />,
    );

    expect(html).toContain("Kontrol keuangan");
    expect(html).toContain("Budget proyek");
    expect(html).toContain("Material &amp; stok");
    expect(html).toContain("Tidak tersedia");
    expect(html).not.toContain("Finance Control");
    expect(html).not.toContain("AI Brief");
  });

  test("uses a readable initials fallback and contextual module summary", () => {
    const html = renderToStaticMarkup(
      <ProfileIdentitySurface
        displayName="Ronald Wijaya"
        displayEmail="ronald@dekoria.com"
        imageUrl={null}
        initials={getProfileInitials("Ronald Wijaya")}
        roleLabel="Owner"
        roleStatus="PRIMARY"
        isActive
        accessibleModuleCount={6}
        moduleCount={6}
      />,
    );

    expect(html).toContain("RW");
    expect(html).toContain("6 dari 6 modul tersedia");
    expect(html).toContain("Ronald Wijaya");
    expect(html).not.toContain("<img");
  });

  test("uses a route-specific structural loading state", () => {
    const html = renderToStaticMarkup(<ProfileLoading />);

    expect(html).toContain("Memuat profil");
    expect(html).toContain("Identitas akun dan hak akses sedang disiapkan");
    expect(html).toContain("rounded-owner");
  });

  test("desktop loading matches the permission table and compact identity/security layout", () => {
    const html = renderToStaticMarkup(
      <WorkspacePresentationProvider presentation="desktop">
        <ProfileLoading />
      </WorkspacePresentationProvider>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Memuat profil"');
    expect(html).toContain('aria-label="Struktur hak akses sedang dimuat"');
    expect(html).toContain('role="grid"');
    expect(html).toContain('data-profile-section="identity"');
    expect(html).toContain('data-profile-section="account"');
    expect(html).toContain('data-profile-section="notifications"');
    expect(html).toContain('data-profile-section="session"');
    expect(html).toContain("inert");
    expect(html).not.toContain("data-profile-mobile-only");
    expect((html.match(/<th /g) ?? []).length).toBe(2);
    expect((html.match(/<td /g) ?? []).length).toBe(summarizeProfileAccess([]).length * 2);
  });
});
