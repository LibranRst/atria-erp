import React from "react";

import { getFinanceDashboardOverview } from "@/app/actions/finance/dashboard-overview";
import {
  FinanceDashboard,
} from "@/features/finance-dashboard/components/finance-dashboard";
import { resolveRoleName } from "@/lib/auth/permissions";
import { requireServerSession } from "@/lib/server/session";

export default async function LedgerPage(): Promise<React.JSX.Element> {
  const session = await requireServerSession();

  const role = await resolveRoleName(session.user.roleId);
  if (role !== "OWNER" && role !== "FINANCE_ADMIN") {
    return (
      <section className="mx-auto max-w-sm space-y-3 px-6 py-16 text-center">
        <span className="material-symbols-outlined text-[36px] text-error">
          lock
        </span>
        <h1 className="text-xl font-semibold">Akses ditolak</h1>
        <p className="text-xs leading-5 text-on-surface-variant">
          Dashboard finansial hanya tersedia untuk Owner dan Finance Admin.
        </p>
      </section>
    );
  }

  const result = await getFinanceDashboardOverview();
  if (!result.success) {
    return (
      <section className="rounded-2xl bg-error-container/20 p-md text-center text-xs text-error">
        {result.error.message}
      </section>
    );
  }

  return <FinanceDashboard data={result.data} userName={session.user.name} />;
}
