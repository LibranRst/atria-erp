import React from "react";

import { AppIcon } from "@/components/ui";
import { FinanceDashboard } from "@/features/finance-dashboard/components/workspaces/finance-dashboard";
import { getFinanceDashboardPageData } from "@/features/finance-dashboard/server/get-finance-dashboard-page-data";

export const dynamic = "force-dynamic";

export default async function LedgerPage(): Promise<React.JSX.Element> {
  const data = await getFinanceDashboardPageData();

  if (data.status === "restricted") {
    return (
      <section className="mx-auto max-w-sm space-y-3 px-6 py-16 text-center">
        <AppIcon name="lock" className="text-[36px] text-error" />
        <h1 className="text-xl font-semibold">Akses ditolak</h1>
        <p className="text-xs leading-5 text-on-surface-variant">
          Dashboard finansial hanya tersedia untuk Owner dan Finance Admin.
        </p>
      </section>
    );
  }

  if (data.status === "error") {
    return (
      <section className="rounded-2xl bg-error-container/20 p-md text-center text-xs text-error">
        {data.message}
      </section>
    );
  }

  return (
    <FinanceDashboard data={data.overview} userName={data.userName} onboarding={data.onboarding} />
  );
}
