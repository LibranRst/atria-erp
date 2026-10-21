import type { Meta, StoryObj } from "@storybook/nextjs";
import { getRouter } from "@storybook/nextjs/navigation.mock";
import React from "react";
import { Toaster } from "sonner";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { DesktopUIProvider } from "@/components/ui";
import { ActivityDetailProvider } from "@/features/activity-detail/components/activity-detail-provider";
import { GlobalExpenseDrawer } from "@/features/expenses/components/sheets/global-drawer";
import { GlobalVendorBillDrawer } from "@/features/expenses/components/sheets/global-vendor-bill-drawer";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import { updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import { setExpensesFixtureScenario } from "../../../../../.storybook/expenses-actions.fixture";
import { setMaterialsFixtureScenario } from "../../../../../.storybook/materials-actions.fixture";
import {
  PROJECT_OPERATIONS_FIXTURE_PATH,
  PROJECT_OPERATIONS_FIXTURE_USER,
  projectOperationsFixtureData,
  projectOperationsFixturePermissions,
  type ProjectOperationsFixtureKind,
} from "../../../../../.storybook/project-operations-data.fixture";
import { ProjectTabs } from "./project-tabs";
import { ProjectStateProvider } from "./project-state-context";
import { ProjectDetailDesktopLoading } from "./project-planning-desktop-loading";

function ResponsiveProjectOperations({
  kind = "complete",
  tab = "stok",
  nativeFallback = false,
  pending = false,
  skeleton = false,
}: {
  readonly kind?: ProjectOperationsFixtureKind;
  readonly tab?: "stok" | "expenses";
  readonly nativeFallback?: boolean;
  readonly pending?: boolean;
  readonly skeleton?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  const data = React.useMemo(() => projectOperationsFixtureData(kind), [kind]);
  React.useLayoutEffect(() => {
    setExpensesFixtureScenario(
      kind === "assigned"
        ? "assigned"
        : kind === "empty"
          ? "empty"
          : kind === "read-only" || kind === "no-banks"
            ? "read-only"
            : "complete",
    );
    setMaterialsFixtureScenario(pending ? "pending" : "complete");
    const initial = new URL(window.location.href);
    const restoredTab = initial.searchParams.get("tab");
    initial.searchParams.set(
      "tab",
      restoredTab === "stok" || restoredTab === "expenses" ? restoredTab : tab,
    );
    updateBrowserUrl(`${initial.pathname}${initial.search}${initial.hash}`, "replace");
    const router = getRouter();
    const previousPush = router.push.getMockImplementation();
    const previousReplace = router.replace.getMockImplementation();
    const navigate = (href: string): void => {
      const target = new URL(href, window.location.origin);
      const current = new URL(window.location.href);
      // The mocked canonical pathname locks forms; the real URL stays on this safe preview across refresh.
      for (const key of [...current.searchParams.keys()])
        if (key !== "id" && key !== "viewMode" && key !== "globals" && key !== "args")
          current.searchParams.delete(key);
      target.searchParams.forEach((value, key) => current.searchParams.set(key, value));
      current.hash = target.hash;
      updateBrowserUrl(`${current.pathname}${current.search}${current.hash}`, "push");
    };
    router.push.mockImplementation(navigate);
    router.replace.mockImplementation(navigate);
    return (): void => {
      setMaterialsFixtureScenario("complete");
      setExpensesFixtureScenario("complete");
      if (previousPush) router.push.mockImplementation(previousPush);
      else router.push.mockReset();
      if (previousReplace) router.replace.mockImplementation(previousReplace);
      else router.replace.mockReset();
    };
  }, [kind, pending, tab]);
  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={projectOperationsFixturePermissions(kind)}
          user={{
            ...PROJECT_OPERATIONS_FIXTURE_USER,
            dataScope: kind === "assigned" ? "ASSIGNED" : "GLOBAL",
          }}
        >
          <ProjectStateProvider>
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
                  <p className="px-1 text-support text-on-surface-variant">
                    Preview interaktif · data sintetis. Tindakan tidak menyimpan perubahan ke
                    backend.
                  </p>
                  {skeleton ? (
                    <ProjectDetailDesktopLoading kind={tab} projectId={data.project.id} />
                  ) : (
                    <ProjectTabs {...data} />
                  )}
                </div>
              </div>
              <GlobalExpenseDrawer />
              <GlobalVendorBillDrawer />
              <Toaster />
            </ActivityDetailProvider>
          </ProjectStateProvider>
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "Features/Projects/Responsive Stock and Expenses",
  component: ResponsiveProjectOperations,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: PROJECT_OPERATIONS_FIXTURE_PATH, query: { tab: "stok" } },
    },
  },
} satisfies Meta<typeof ResponsiveProjectOperations>;
export default meta;
type Story = StoryObj<typeof meta>;
export const StockComplete: Story = {};
export const ExpensesComplete: Story = { args: { tab: "expenses" } };
export const StockEmpty: Story = { args: { kind: "empty" } };
export const ExpensesEmpty: Story = { args: { kind: "empty", tab: "expenses" } };
export const StockLocked: Story = { args: { kind: "locked" } };
export const ExpensesLocked: Story = { args: { kind: "locked", tab: "expenses" } };
export const StockReadOnly: Story = { args: { kind: "read-only" } };
export const ExpensesReadOnly: Story = { args: { kind: "read-only", tab: "expenses" } };
export const StockWithoutRapPermission: Story = { args: { kind: "stock-only" } };
export const ExpensesAssigned: Story = { args: { kind: "assigned", tab: "expenses" } };
export const ExpensesWithoutBanks: Story = { args: { kind: "no-banks", tab: "expenses" } };
export const StockRestricted: Story = { args: { kind: "restricted" } };
export const ExpensesRestricted: Story = { args: { kind: "restricted", tab: "expenses" } };
export const StockSourceError: Story = { args: { kind: "source-error" } };
export const ExpensesSourceError: Story = { args: { kind: "source-error", tab: "expenses" } };
export const StockNativeFallback: Story = { args: { nativeFallback: true } };
export const ExpensesNativeFallback: Story = { args: { nativeFallback: true, tab: "expenses" } };
export const StockPending: Story = { args: { pending: true } };
export const StockLoading: Story = { args: { skeleton: true } };
export const ExpensesLoading: Story = { args: { skeleton: true, tab: "expenses" } };
