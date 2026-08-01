import React from "react";

import { getReconciliationWorkspace } from "@/app/actions/finance/reconciliation-workspace";
import { ReconciliationWorkspace } from "@/features/reconciliation/components/reconciliation-workspace";
import { requireServerSession } from "@/lib/server/session";
import { AppIcon } from "@/components/ui";
export const dynamic = "force-dynamic";

export default async function ReconciliationPage(): Promise<React.JSX.Element> {
  await requireServerSession();
  const result = await getReconciliationWorkspace();
  if (!result.success) {
    return (
      <section className="mx-auto max-w-sm space-y-3 px-6 py-16 text-center">
        <AppIcon name="lock" className="text-[36px] text-error" />
        <h1 className="text-xl font-semibold">Akses rekonsiliasi tidak tersedia</h1>
        <p className="text-xs leading-5 text-on-surface-variant">{result.error.message}</p>
      </section>
    );
  }
  return <ReconciliationWorkspace initialData={result.data} />;
}
