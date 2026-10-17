import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import { Toaster } from "sonner";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { DesktopUIProvider } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import { updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import {
  SETTINGS_FIXTURE_PERMISSIONS,
  SETTINGS_FIXTURE_READ_PERMISSIONS,
  SETTINGS_FIXTURE_ROLE_PERMISSIONS,
  SETTINGS_FIXTURE_PRICING,
  fixtureId,
  settingsFixtureOverview,
  settingsFixtureAdministration,
  settingsFixtureSetup,
  settingsFixtureInitialStock,
  settingsFixtureOpeningBatches,
  type SettingsFixtureScenario,
} from "../../../../.storybook/settings-data.fixture";
import { setSettingsFixtureScenario } from "../../../../.storybook/settings-actions.fixture";
import type { SettingsTab } from "../../utils/settings-tabs-config";
import { SettingsDashboard } from "./settings-dashboard";
import { SettingsShell } from "./settings-shell";
import { SettingsDesktopSkeleton } from "../shared/settings-desktop-skeleton";

function ResponsiveSettings({
  initialTab = "financial",
  scenario = "complete",
  nativeFallback = false,
  initialCatalogSection,
  initialFlow,
  showSkeleton = false,
}: {
  readonly initialTab?: SettingsTab;
  readonly scenario?: SettingsFixtureScenario;
  readonly nativeFallback?: boolean;
  readonly initialCatalogSection?: "library" | "locations";
  readonly initialFlow?: "initial-stock";
  readonly showSkeleton?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  const permissions =
    scenario === "roles-only"
      ? SETTINGS_FIXTURE_ROLE_PERMISSIONS
      : scenario === "read-only"
        ? SETTINGS_FIXTURE_READ_PERMISSIONS
        : SETTINGS_FIXTURE_PERMISSIONS;
  React.useLayoutEffect(() => {
    setSettingsFixtureScenario(scenario);
    return () => setSettingsFixtureScenario("complete");
  }, [scenario]);
  React.useLayoutEffect(() => {
    const url = new URL(window.location.href);
    if (initialTab === "financial") url.searchParams.delete("tab");
    else url.searchParams.set("tab", initialTab);
    if (initialCatalogSection) url.searchParams.set("section", initialCatalogSection);
    else url.searchParams.delete("section");
    if (initialFlow) url.searchParams.set("flow", initialFlow);
    else url.searchParams.delete("flow");
    updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
  }, [initialTab, initialCatalogSection, initialFlow]);
  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={permissions}
          user={{
            id: fixtureId(1000),
            name: "Karin Putri",
            image: null,
            roleId: scenario === "roles-only" ? fixtureId(5) : fixtureId(1),
            dataScope: scenario === "roles-only" ? "ASSIGNED" : "GLOBAL",
          }}
        >
          <div
            className="min-h-screen bg-background"
            style={
              presentation === "desktop"
                ? { marginLeft: 208, padding: 24 }
                : { padding: "16px 12px 112px" }
            }
          >
            <SettingsShell>
              {showSkeleton ? (
                <SettingsDesktopSkeleton />
              ) : (
                <SettingsDashboard
                  overview={settingsFixtureOverview(scenario)}
                  pricingTemplates={scenario === "empty" ? [] : SETTINGS_FIXTURE_PRICING}
                  initialTab={initialTab}
                  administration={settingsFixtureAdministration(scenario)}
                  setup={settingsFixtureSetup(scenario)}
                  initialStock={settingsFixtureInitialStock(scenario)}
                  openingBatches={settingsFixtureOpeningBatches(scenario)}
                  approvalThresholds={{
                    fieldCostCents: 500_000_000,
                    vendorPaymentCents: 750_000_125,
                  }}
                />
              )}
            </SettingsShell>
          </div>
          <Toaster />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "Features/Settings/Responsive workspace",
  component: ResponsiveSettings,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/settings", query: {} } },
  },
} satisfies Meta<typeof ResponsiveSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Financial: Story = {};
export const Catalog: Story = { args: { initialTab: "catalog" } };
export const Library: Story = { args: { initialTab: "catalog", initialCatalogSection: "library" } };
export const Locations: Story = {
  args: { initialTab: "catalog", initialCatalogSection: "locations" },
};
export const Organization: Story = { args: { initialTab: "organization" } };
export const Readiness: Story = { args: { initialTab: "readiness" } };
export const Empty: Story = { args: { scenario: "empty" } };
export const ReadOnly: Story = { args: { scenario: "read-only" } };
export const RolesOnly: Story = { args: { initialTab: "organization", scenario: "roles-only" } };
export const ReadinessPending: Story = {
  args: { initialTab: "readiness", scenario: "readiness-pending" },
};
export const RoleLoadFailure: Story = {
  args: { initialTab: "organization", scenario: "roles-error" },
};
export const RoleLoading: Story = {
  args: { initialTab: "organization", scenario: "roles-loading" },
};
export const NativeFallback: Story = { args: { nativeFallback: true } };
export const InitialStock: Story = {
  args: { initialTab: "readiness", scenario: "readiness-pending", initialFlow: "initial-stock" },
  parameters: {
    nextjs: { navigation: { pathname: "/settings", query: { flow: "initial-stock" } } },
  },
};
export const FinancialSkeleton: Story = { args: { showSkeleton: true } };
export const CatalogSkeleton: Story = { args: { showSkeleton: true, initialTab: "catalog" } };
export const OrganizationSkeleton: Story = {
  args: { showSkeleton: true, initialTab: "organization" },
};
export const ReadinessSkeleton: Story = { args: { showSkeleton: true, initialTab: "readiness" } };
