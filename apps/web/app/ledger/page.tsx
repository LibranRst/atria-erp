import React from "react";

import { redirect } from "next/navigation";

import { resolveActor } from "@/server/actor";

import { PageState } from "@/components/ui";
import { FinanceDashboard } from "@/features/finance-dashboard/components/workspaces/finance-dashboard";
import { getFinanceDashboardPageData } from "@/features/finance-dashboard/server/get-finance-dashboard-page-data";

export const dynamic = "force-dynamic";

export default async function LedgerPage(): Promise<React.JSX.Element> {
  const actor = await resolveActor();
  if (!actor) redirect("/login");
  const data = await getFinanceDashboardPageData(actor);

  if (data.status === "restricted") {
    return (
      <PageState
        kind="restricted"
        title="Akses ditolak"
        description="Dashboard finansial hanya tersedia untuk Owner dan Finance Admin."
      />
    );
  }

  if (data.status === "error") {
    return (
      <PageState kind="error" title="Dashboard belum dapat dimuat" description={data.message} />
    );
  }

  return (
    <FinanceDashboard data={data.overview} userName={data.userName} onboarding={data.onboarding} />
  );
}
