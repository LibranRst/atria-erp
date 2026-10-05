"use client";

import { Suspense } from "react";
import { ProjectStateProvider } from "@/features/projects/detail/components/shared/project-state-context";
import { ActivityDetailProvider } from "@/features/activity-detail/components/activity-detail-provider";
import { TopBarSlotsProvider } from "./top-bar-slots";
import { GlobalExpenseDrawer } from "@/features/expenses/components/sheets/global-drawer";
import { GlobalProjectDrawer } from "@/features/projects/list/components/drawers/global-project-drawer";
import { GlobalVendorBillDrawer } from "@/features/expenses/components/sheets/global-vendor-bill-drawer";
import { GlobalInvoiceDrawer } from "@/features/projects/detail/components/invoices/global-invoice-drawer";

export function WorkspaceWorkflows({
  children,
  drawersEnabled,
}: {
  readonly children: React.ReactNode;
  readonly drawersEnabled: boolean;
}): React.JSX.Element {
  return (
    <ProjectStateProvider>
      <ActivityDetailProvider>
        <TopBarSlotsProvider>
          {children}
          {drawersEnabled ? (
            <Suspense fallback={null}>
              <GlobalExpenseDrawer />
              <GlobalProjectDrawer />
              <GlobalVendorBillDrawer />
              <GlobalInvoiceDrawer />
            </Suspense>
          ) : null}
        </TopBarSlotsProvider>
      </ActivityDetailProvider>
    </ProjectStateProvider>
  );
}
