import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import { Toaster } from "sonner";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { DesktopUIProvider } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import { updateUrlSearchParam } from "@/lib/utils/use-url-search-param";
import ReconciliationLoading from "@/app/reconciliation/loading";
import { setReconciliationFixtureScenario } from "../../../.storybook/reconciliation-actions.fixture";
import {
  RECONCILIATION_FIXTURE_PERMISSIONS,
  reconciliationFixtureData,
  reconciliationFixtureId,
  type ReconciliationFixtureScenario,
} from "../../../.storybook/reconciliation-data.fixture";
import { ReconciliationWorkspace } from "./reconciliation-workspace";
import { ReconciliationDesktopSkeleton } from "./reconciliation-desktop-skeleton";

function ResponsiveReconciliation({
  scenario = "complete",
  initialView = "statement",
  nativeFallback = false,
  skeleton = false,
  detailSkeleton = false,
}: {
  readonly scenario?: ReconciliationFixtureScenario;
  readonly initialView?: "statement" | "cash" | "history";
  readonly nativeFallback?: boolean;
  readonly skeleton?: boolean;
  readonly detailSkeleton?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  React.useLayoutEffect(() => {
    setReconciliationFixtureScenario(scenario);
    updateUrlSearchParam("view", initialView);
    return (): void => setReconciliationFixtureScenario("complete");
  }, [initialView, scenario]);
  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={RECONCILIATION_FIXTURE_PERMISSIONS}
          user={{
            id: reconciliationFixtureId(5000),
            roleId: reconciliationFixtureId(5001),
            name: "Karin Putri",
            image: null,
            dataScope: "GLOBAL",
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
            <div
              className={
                presentation === "desktop"
                  ? "min-w-0 space-y-4"
                  : "mx-auto w-full max-w-md space-y-3"
              }
            >
              {detailSkeleton && presentation === "desktop" ? (
                <ReconciliationDesktopSkeleton view={initialView} showDetail />
              ) : skeleton ? (
                <ReconciliationLoading />
              ) : (
                <ReconciliationWorkspace
                  key={scenario}
                  initialData={reconciliationFixtureData(scenario)}
                />
              )}
              <p className="px-1 text-support text-on-surface-variant">
                Data sintetis untuk tinjauan visual. Pencocokan, pengecualian, impor, dan input
                manual tidak menyimpan data.
              </p>
            </div>
          </div>
          <Toaster />
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}
const meta = {
  title: "Features/Reconciliation/Responsive workspace",
  component: ResponsiveReconciliation,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Bank, cash, and history collections start unselected. Activate a row to inspect its evidence, then activate it again to clear the detail. Explicit selection survives resize and refresh; loading never replaces the live tab navigation.",
      },
    },
    nextjs: { appDirectory: true, navigation: { pathname: "/reconciliation", query: {} } },
  },
} satisfies Meta<typeof ResponsiveReconciliation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Complete: Story = {};
export const Cash: Story = { args: { initialView: "cash" } };
export const History: Story = { args: { initialView: "history" } };
export const Empty: Story = { args: { scenario: "empty" } };
export const SourceError: Story = { args: { scenario: "source-error" } };
export const Loading: Story = { args: { skeleton: true } };
export const CashLoading: Story = { args: { initialView: "cash", skeleton: true } };
export const HistoryLoading: Story = { args: { initialView: "history", skeleton: true } };
export const ContextLoading: Story = { args: { detailSkeleton: true } };
export const NativeFallback: Story = { args: { nativeFallback: true } };
export const PendingAction: Story = { args: { initialView: "cash", scenario: "pending" } };
