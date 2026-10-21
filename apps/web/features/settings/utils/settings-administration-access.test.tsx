import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdministrationCapabilities } from "@atria/core/auth/administration-access";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { SettingsNavigation } from "../components/navigation/settings-navigation";
import { hasSettingsAdministrationAccess } from "./settings-administration-access";

const noAccess: AdministrationCapabilities = {
  canViewUsers: false,
  canManageUsers: false,
  canViewVendors: false,
  canManageVendors: false,
  canManageRoles: false,
};
const noFallback = { canManageUsers: false, canManageVendors: false };
const cases: readonly {
  readonly title: string;
  readonly capabilities: AdministrationCapabilities;
  readonly visible: boolean;
}[] = [
  {
    title: "role management only",
    capabilities: { ...noAccess, canManageRoles: true },
    visible: true,
  },
  {
    title: "user read access only",
    capabilities: { ...noAccess, canViewUsers: true },
    visible: true,
  },
  {
    title: "vendor read access only",
    capabilities: { ...noAccess, canViewVendors: true },
    visible: true,
  },
  { title: "no administration access", capabilities: noAccess, visible: false },
];
describe("Settings organization navigation access", () => {
  for (const scenario of cases)
    test(scenario.title, (): void => {
      const visible = hasSettingsAdministrationAccess(scenario.capabilities, noFallback);
      const html = renderToStaticMarkup(
        <WorkspacePresentationProvider presentation="desktop">
          <SettingsNavigation
            value="financial"
            onChange={(): void => {}}
            showAdministration={visible}
          />
        </WorkspacePresentationProvider>,
      );
      expect(visible).toBe(scenario.visible);
      expect(html.includes("Tim, Vendor &amp; Peran")).toBe(scenario.visible);
      expect(scenario.capabilities.canManageUsers).toBe(false);
      expect(scenario.capabilities.canManageVendors).toBe(false);
    });
  test("server capabilities override the compatibility management flags", (): void => {
    expect(
      hasSettingsAdministrationAccess(noAccess, { canManageUsers: true, canManageVendors: true }),
    ).toBe(false);
  });
  test("management flags remain a fallback only when the server DTO is absent", (): void => {
    expect(hasSettingsAdministrationAccess(null, noFallback)).toBe(false);
    expect(
      hasSettingsAdministrationAccess(null, { canManageUsers: true, canManageVendors: false }),
    ).toBe(true);
    expect(
      hasSettingsAdministrationAccess(null, { canManageUsers: false, canManageVendors: true }),
    ).toBe(true);
  });
});
