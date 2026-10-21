import React from "react";

import { getReconciliationWorkspace } from "@/app/actions/finance/reconciliation-workspace";
import { ReconciliationWorkspace } from "@/features/reconciliation/components/reconciliation-workspace";
import { requireServerSession } from "@/lib/server/session";
import { PageState } from "@/components/ui";
export const dynamic = "force-dynamic";

export default async function ReconciliationPage(): Promise<React.JSX.Element> {
  await requireServerSession();
  const result = await getReconciliationWorkspace();
  if (!result.success) {
    return (
      <PageState
        kind={
          result.error.code === "FORBIDDEN" || result.error.code === "UNAUTHORIZED"
            ? "restricted"
            : "error"
        }
        title={
          result.error.code === "FORBIDDEN" || result.error.code === "UNAUTHORIZED"
            ? "Akses rekonsiliasi tidak tersedia"
            : "Rekonsiliasi belum dapat dimuat"
        }
        description={result.error.message}
      />
    );
  }
  return <ReconciliationWorkspace initialData={result.data} />;
}
