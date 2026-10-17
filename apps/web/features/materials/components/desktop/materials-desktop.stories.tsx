import type { Meta, StoryObj } from "@storybook/nextjs";
import { getRouter } from "@storybook/nextjs/navigation.mock";
import React from "react";
import { Toaster } from "sonner";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { ActivityDetailProvider } from "@/features/activity-detail/components/activity-detail-provider";
import { DesktopUIProvider } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import { updateBrowserUrl, updateUrlSearchParam } from "@/lib/utils/use-url-search-param";
import { MaterialsControlCenter } from "@/features/materials/components/workspaces/materials-control-center";
import type { MaterialTab } from "@/features/materials/utils/material-ui-utils";
import type { MaterialDesktopActivityInput } from "@atria/core/material/material-desktop";
import MaterialsLoading from "@/app/materials/loading";
import { setMaterialsFixtureScenario } from "../../../../.storybook/materials-actions.fixture";
import {
  materialsFixtureData,
  materialsFixtureId,
  materialsFixturePermissions,
  type MaterialsFixtureScenario,
} from "../../../../.storybook/materials-data.fixture";
import { MaterialDesktopSkeleton } from "./material-desktop-skeleton";

function ResponsiveMaterials({
  scenario = "complete",
  initialTab = "overview",
  activityKind = "movements",
  nativeFallback = false,
  skeleton = false,
  contextSkeleton = false,
}: {
  readonly scenario?: MaterialsFixtureScenario;
  readonly initialTab?: MaterialTab;
  readonly activityKind?: MaterialDesktopActivityInput["kind"];
  readonly nativeFallback?: boolean;
  readonly skeleton?: boolean;
  readonly contextSkeleton?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  React.useLayoutEffect(() => {
    // The fixture router mirrors in-app URL state so the actual operation owner opens its sheet.
    const router = getRouter();
    const previousReplace = router.replace.getMockImplementation();
    router.replace.mockImplementation((href: string): void => updateBrowserUrl(href, "replace"));
    setMaterialsFixtureScenario(scenario);
    updateUrlSearchParam("tab", initialTab);
    updateUrlSearchParam("activity-kind", activityKind);
    updateUrlSearchParam("action", null);
    return (): void => {
      setMaterialsFixtureScenario("complete");
      if (previousReplace) router.replace.mockImplementation(previousReplace);
      else router.replace.mockReset();
    };
  }, [activityKind, initialTab, scenario]);
  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={materialsFixturePermissions(scenario)}
          user={{
            id: materialsFixtureId(9990),
            roleId: materialsFixtureId(9991),
            name: "Karin Putri",
            image: null,
            dataScope: scenario === "assigned" ? "ASSIGNED" : "GLOBAL",
          }}
        >
          <ActivityDetailProvider>
            <div
              className="min-h-screen bg-background"
              style={
                presentation === "desktop"
                  ? { marginLeft: 208, padding: 24 }
                  : { padding: "16px 12px 112px" }
              }
            >
              <div
                className={
                  presentation === "desktop"
                    ? "min-w-0 space-y-4"
                    : "mx-auto w-full max-w-md space-y-3"
                }
              >
                {contextSkeleton && presentation === "desktop" ? (
                  <MaterialDesktopSkeleton
                    tab={initialTab}
                    activityKind={activityKind}
                    showDetail
                  />
                ) : skeleton ? (
                  <MaterialsLoading />
                ) : (
                  <MaterialsControlCenter key={scenario} data={materialsFixtureData(scenario)} />
                )}
                <p className="px-1 text-support text-on-surface-variant">
                  Data sintetis untuk tinjauan visual. Penerimaan, pemakaian, transfer, dan
                  keputusan tidak menyimpan data.
                </p>
              </div>
            </div>
          </ActivityDetailProvider>
          <Toaster />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "Features/Materials/Responsive workspace",
  component: ResponsiveMaterials,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/materials", query: {} } },
  },
} satisfies Meta<typeof ResponsiveMaterials>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Complete: Story = {};
export const Stock: Story = { args: { initialTab: "inventory" } };
export const Needs: Story = { args: { initialTab: "needs" } };
export const Activity: Story = { args: { initialTab: "activity" } };
export const Receipts: Story = { args: { initialTab: "activity", activityKind: "receipts" } };
export const Transfers: Story = { args: { initialTab: "activity", activityKind: "transfers" } };
export const Counts: Story = { args: { initialTab: "activity", activityKind: "counts" } };
export const Empty: Story = { args: { scenario: "empty" } };
export const ReadOnly: Story = { args: { scenario: "read-only" } };
export const Assigned: Story = { args: { scenario: "assigned" } };
export const PartialError: Story = { args: { scenario: "partial-error" } };
export const RestrictedNeeds: Story = { args: { scenario: "restricted", initialTab: "needs" } };
export const ActivityError: Story = {
  args: { scenario: "activity-error", initialTab: "activity" },
};
export const PendingAction: Story = { args: { scenario: "pending" } };
export const NativeFallback: Story = { args: { nativeFallback: true } };
export const Loading: Story = { args: { skeleton: true } };
export const StockLoading: Story = { args: { initialTab: "inventory", skeleton: true } };
export const NeedsLoading: Story = { args: { initialTab: "needs", skeleton: true } };
export const ActivityLoading: Story = { args: { initialTab: "activity", skeleton: true } };
export const ContextLoading: Story = { args: { initialTab: "inventory", contextSkeleton: true } };
