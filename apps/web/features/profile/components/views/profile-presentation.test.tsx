import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import ProfileLoading from "@/app/profile/loading";
import { ProfileAccessList } from "./profile-access-list";
import { ProfileIdentitySurface } from "./profile-identity-surface";
import {
  countAccessibleProfileModules,
  getProfileInitials,
  summarizeProfileAccess,
} from "@/features/profile/utils/profile-access";

describe("Profile presentation", () => {
  test("excludes deferred AI access from the active profile modules", () => {
    const groups = summarizeProfileAccess(["view:bank_account", "view:settings", "view:ai_brief"]);

    expect(groups).toHaveLength(6);
    expect(groups.map((group: { title: string }) => group.title)).not.toContain("AI Brief");
    expect(countAccessibleProfileModules(groups)).toBe(2);
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
});
