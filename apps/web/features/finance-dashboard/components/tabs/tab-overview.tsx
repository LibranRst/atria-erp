"use client";

import { useCan } from "@/components/auth/permissions-provider";
import React from "react";

import type { FinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import type { OrganizationSetupOverview } from "@atria/core/onboarding/organization-setup";
import { RowGroup } from "@/components/ui";
import { OverviewPreviewSection } from "@/features/finance-dashboard/components/shared/dashboard-primitives";
import {
  OverviewCashRows,
  OverviewPreviewEmpty,
  OverviewPriorityList,
} from "@/features/finance-dashboard/components/cards/dashboard-cards";
import { ProjectRiskRow } from "@/features/finance-dashboard/components/rows/project-rows";
import { CashDueRow } from "@/features/finance-dashboard/components/rows/cash-due-rows";
import { MaterialIssueRow } from "@/features/finance-dashboard/components/rows/material-rows";
import { OrganizationSetupCard } from "@/features/onboarding/components/quick-start/organization-setup-card";

export function DashboardOverviewTab({
  data,
  financialPosition,
  setup,
}: {
  readonly data: FinanceDashboardOverview;
  readonly financialPosition: React.ReactNode;
  readonly setup: OrganizationSetupOverview | null;
}): React.JSX.Element {
  const can = useCan();
  const nextDue = data.dashboardDetails.cashDueGroups.flatMap((group) => group.items).slice(0, 3);
  const materialAttention = data.dashboardDetails.materials
    .filter((item) => item.severity !== "INFO")
    .slice(0, 3);

  return (
    <div className="space-y-sm">
      {financialPosition}
      {setup ? <OrganizationSetupCard overview={setup} density="dashboard" /> : null}
      <OverviewPreviewSection
        title={can("decide:all_approvals") ? "Perlu keputusan" : "Prioritas finance"}
        href={can("decide:all_approvals") ? "/ledger?tab=approvals" : "/ledger?tab=cash"}
      >
        {data.actions.length === 0 ? (
          <OverviewPreviewEmpty>
            Tidak ada tindakan mendesak. Kondisi utama sudah terkendali.
          </OverviewPreviewEmpty>
        ) : (
          <OverviewPriorityList actions={data.actions} />
        )}
      </OverviewPreviewSection>
      <OverviewPreviewSection title="Project berisiko" href="/ledger?tab=budget">
        {data.riskyProjects.length === 0 ? (
          <OverviewPreviewEmpty>Semua project aktif masih dalam batas budget.</OverviewPreviewEmpty>
        ) : (
          <RowGroup>
            {data.riskyProjects.slice(0, 3).map((project) => (
              <ProjectRiskRow key={project.projectId} project={project} compact />
            ))}
          </RowGroup>
        )}
      </OverviewPreviewSection>
      <OverviewPreviewSection title="Jatuh tempo terdekat" href="/ledger?tab=cash">
        {nextDue.length === 0 ? (
          <OverviewPreviewEmpty>Tidak ada tagihan atau invoice terbuka.</OverviewPreviewEmpty>
        ) : (
          <RowGroup connected>
            {nextDue.map((item) => (
              <CashDueRow
                key={`${item.type}-${item.id}`}
                item={item}
                referenceDate={new Date(data.generatedAt)}
                compact
              />
            ))}
          </RowGroup>
        )}
      </OverviewPreviewSection>
      <OverviewPreviewSection title="Perhatian material" href="/ledger?tab=materials">
        {materialAttention.length === 0 ? (
          <OverviewPreviewEmpty>Tidak ada masalah material aktif.</OverviewPreviewEmpty>
        ) : (
          <RowGroup>
            {materialAttention.map((item) => (
              <MaterialIssueRow key={item.id} item={item} compact />
            ))}
          </RowGroup>
        )}
      </OverviewPreviewSection>
      <OverviewPreviewSection title="Perubahan kas terbaru" href="/ledger?tab=accounts">
        {data.recentTransactions.length === 0 ? (
          <OverviewPreviewEmpty>Belum ada transaksi kas.</OverviewPreviewEmpty>
        ) : (
          <OverviewCashRows transactions={data.recentTransactions.slice(0, 3)} />
        )}
      </OverviewPreviewSection>
    </div>
  );
}
