import type { Meta, StoryObj } from "@storybook/nextjs";
import React from "react";
import { Toaster } from "sonner";
import { PermissionsProvider } from "@/components/auth/permissions-provider";
import { DesktopUIProvider, RoutePageError } from "@/components/ui";
import { WorkspacePresentationProvider } from "@/lib/navigation/workspace-presentation";
import { useWorkspaceViewportPresentation } from "@/lib/navigation/workspace-viewport";
import { updateBrowserUrl } from "@/lib/utils/use-url-search-param";
import {
  EXPENSES_FIXTURE_PERMISSIONS,
  EXPENSES_FIXTURE_READ_PERMISSIONS,
  EXPENSES_FIXTURE_ASSIGNED_PERMISSIONS,
  EXPENSES_FIXTURE_VENDOR_PERMISSIONS,
  expensesFixtureData,
  expensesFixtureId,
  type ExpensesFixtureScenario,
} from "../../../../.storybook/expenses-data.fixture";
import { setExpensesFixtureScenario } from "../../../../.storybook/expenses-actions.fixture";
import { ExpenseList } from "./expense-list";
import { GlobalExpenseDrawer } from "../sheets/global-drawer";
import { GlobalVendorBillDrawer } from "../sheets/global-vendor-bill-drawer";
import {
  ExpensesDesktopSkeleton,
  type ExpensesSkeletonVariant,
} from "../shared/expenses-desktop-skeleton";
import ExpensesLoading from "@/app/expenses/loading";
import { ActivityDetailProvider } from "@/features/activity-detail/components/activity-detail-provider";

function ResponsiveExpenses({
  scenario = "complete",
  initialView = "field",
  nativeFallback = false,
  skeleton,
  sourceError = false,
}: {
  readonly scenario?: ExpensesFixtureScenario;
  readonly initialView?: "field" | "bills";
  readonly nativeFallback?: boolean;
  readonly skeleton?: ExpensesSkeletonVariant;
  readonly sourceError?: boolean;
}): React.JSX.Element {
  const presentation = useWorkspaceViewportPresentation(nativeFallback);
  const data = expensesFixtureData(scenario);
  const permissions =
    scenario === "vendor-only"
      ? EXPENSES_FIXTURE_VENDOR_PERMISSIONS
      : scenario === "read-only"
        ? EXPENSES_FIXTURE_READ_PERMISSIONS
        : scenario === "assigned"
          ? EXPENSES_FIXTURE_ASSIGNED_PERMISSIONS
          : EXPENSES_FIXTURE_PERMISSIONS;
  React.useLayoutEffect(() => {
    setExpensesFixtureScenario(scenario);
    return () => setExpensesFixtureScenario("complete");
  }, [scenario]);
  React.useLayoutEffect(() => {
    const url = new URL(window.location.href);
    if (initialView === "bills") url.searchParams.set("view", "vendor-bills");
    else url.searchParams.delete("view");
    for (const key of ["filter", "expense-tab", "expense-draft", "new-expense", "new-vendor-bill"])
      url.searchParams.delete(key);
    updateBrowserUrl(`${url.pathname}${url.search}${url.hash}`, "replace");
  }, [initialView]);
  return (
    <WorkspacePresentationProvider presentation={presentation} nativeBridge={nativeFallback}>
      <DesktopUIProvider responsive>
        <PermissionsProvider
          permissions={permissions}
          user={{
            id: expensesFixtureId(5000),
            roleId: expensesFixtureId(5001),
            name: scenario === "assigned" ? "Budi Santoso" : "Karin Putri",
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
              <div className={presentation === "desktop" ? "min-w-0" : "mx-auto w-full max-w-md"}>
                {sourceError ? (
                  <RoutePageError reset={(): void => {}} />
                ) : skeleton ? (
                  presentation === "desktop" ? (
                    <ExpensesDesktopSkeleton variant={skeleton} />
                  ) : (
                    <ExpensesLoading />
                  )
                ) : (
                  <ExpenseList
                    assignedScope={scenario === "assigned"}
                    canViewFieldClaims={scenario !== "vendor-only"}
                    initialCosts={data.costs}
                    bankAccounts={data.accounts}
                    vendorBills={data.bills}
                    vendorPayments={data.payments}
                    vendorPaymentApprovalThreshold={5_000_000}
                    vendors={data.vendors}
                    projects={data.projects}
                    pendingApprovalsCount={scenario === "complete" ? 4 : 0}
                  />
                )}
              </div>
            </div>
            <GlobalExpenseDrawer />
            <GlobalVendorBillDrawer />
            <Toaster />
          </ActivityDetailProvider>
        </PermissionsProvider>
      </DesktopUIProvider>
    </WorkspacePresentationProvider>
  );
}

const meta = {
  title: "Features/Expenses/Responsive workspace",
  component: ResponsiveExpenses,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Desktop starts without a selected row. Pointer, Enter, or Space selects a claim, bill, or payment; activating it again closes the detail. Pending operations protect the current selection.",
      },
    },
    nextjs: { appDirectory: true, navigation: { pathname: "/expenses", query: {} } },
  },
} satisfies Meta<typeof ResponsiveExpenses>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FieldClaims: Story = {};
export const VendorBills: Story = { args: { initialView: "bills" } };
export const Empty: Story = { args: { scenario: "empty" } };
export const ReadOnly: Story = { args: { scenario: "read-only" } };
export const Assigned: Story = { args: { scenario: "assigned" } };
export const VendorOnly: Story = { args: { scenario: "vendor-only", initialView: "bills" } };
export const DraftLoadFailure: Story = { args: { scenario: "drafts-error" } };
export const DraftLoading: Story = { args: { scenario: "drafts-loading" } };
export const NativeFallback: Story = { args: { nativeFallback: true } };
export const FieldSkeleton: Story = { args: { skeleton: "claims" } };
export const VendorSkeleton: Story = { args: { initialView: "bills", skeleton: "bills" } };
export const PaymentsSkeleton: Story = { args: { initialView: "bills", skeleton: "payments" } };
export const SourceError: Story = { args: { sourceError: true } };
