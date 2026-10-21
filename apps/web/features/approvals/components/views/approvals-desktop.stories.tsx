import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import { Toaster } from "sonner";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { DesktopUIProvider, PageState, RoutePageError } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import { setApprovalsFixtureDecisionMode } from "../../../../.storybook/approvals-actions.fixture";
import {
  APPROVALS_FIXTURE_REFERENCE,
  APPROVALS_FIXTURE_CHANGE_ORDERS,
  approvalsFixtureData,
  approvalsFixtureId,
  approvalsFixturePermissions,
  type ApprovalsFixtureScenario,
} from "../../../../.storybook/approvals-data.fixture";
import ApprovalsLoading from "@/app/approvals/loading";
import { ApprovalList } from "./approval-list";
import { PendingChangeOrdersBanner } from "./pending-change-orders-banner";

function ResponsiveApprovals({
  scenario = "complete",
  nativeFallback = false,
  skeleton = false,
  changeOrders = false,
}: {
  readonly scenario?: ApprovalsFixtureScenario;
  readonly nativeFallback?: boolean;
  readonly skeleton?: boolean;
  readonly changeOrders?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  React.useLayoutEffect(() => {
    setApprovalsFixtureDecisionMode(scenario === "pending" ? "pending" : "failure");
    return (): void => setApprovalsFixtureDecisionMode("failure");
  }, [scenario]);
  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={approvalsFixturePermissions(scenario)}
          user={{
            id: approvalsFixtureId(5000),
            roleId: approvalsFixtureId(5001),
            name: "Karin Putri",
            image: null,
            dataScope: scenario === "restricted" ? "ASSIGNED" : "GLOBAL",
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
              {scenario === "source-error" ? (
                <RoutePageError reset={(): void => {}} />
              ) : scenario === "restricted" ? (
                <PageState
                  kind="restricted"
                  title="Akses terbatas"
                  description="Antrean keputusan memerlukan akses global sesuai izin Anda."
                />
              ) : skeleton ? (
                <ApprovalsLoading />
              ) : (
                <ApprovalList
                  key={scenario}
                  initialApprovals={approvalsFixtureData(scenario)}
                  canEmergencyOverride={scenario !== "read-only" && scenario !== "stock-only"}
                  referenceDateIso={APPROVALS_FIXTURE_REFERENCE}
                  leadingContent={
                    changeOrders ? (
                      <PendingChangeOrdersBanner orders={APPROVALS_FIXTURE_CHANGE_ORDERS} />
                    ) : undefined
                  }
                />
              )}
              <p className="px-1 text-support text-on-surface-variant">
                Data sintetis untuk tinjauan visual. Tindakan tidak menyimpan keputusan.
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
  title: "Features/Approvals/Responsive workspace",
  component: ResponsiveApprovals,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true, navigation: { pathname: "/approvals", query: {} } },
  },
} satisfies Meta<typeof ResponsiveApprovals>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Complete: Story = {};
export const Empty: Story = { args: { scenario: "empty" } };
export const ReadOnly: Story = { args: { scenario: "read-only" } };
export const StockOnly: Story = { args: { scenario: "stock-only" } };
export const SelfOverride: Story = { args: { scenario: "self-override" } };
export const DecisionFailure: Story = {};
export const PendingDecision: Story = { args: { scenario: "pending" } };
export const SourceError: Story = { args: { scenario: "source-error" } };
export const Restricted: Story = { args: { scenario: "restricted" } };
export const NativeFallback: Story = { args: { nativeFallback: true } };
export const Loading: Story = { args: { skeleton: true } };
export const ChangeOrders: Story = { args: { changeOrders: true } };
