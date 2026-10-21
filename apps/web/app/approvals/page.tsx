import React from "react";

import { redirect } from "next/navigation";

import { resolveActor } from "@/server/actor";

import { PageState } from "@/components/ui";
import { ApprovalList } from "@/features/approvals/components/views/approval-list";
import { PendingChangeOrdersBanner } from "@/features/approvals/components/views/pending-change-orders-banner";
import { getApprovalsPageData } from "@/features/approvals/server/get-approvals-page-data";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage(): Promise<React.JSX.Element> {
  const actor = await resolveActor();
  if (!actor) redirect("/login");
  const data = await getApprovalsPageData(actor);

  if (data.status === "restricted") {
    return (
      <PageState
        kind="restricted"
        title="Akses terbatas"
        description="Antrean keputusan hanya tersedia untuk Owner dan Finance Admin sesuai permission masing-masing."
      />
    );
  }

  return (
    <ApprovalList
      initialApprovals={data.approvals}
      canEmergencyOverride={data.canEmergencyOverride}
      referenceDateIso={data.referenceDateIso}
      leadingContent={<PendingChangeOrdersBanner orders={data.pendingChangeOrders} />}
    />
  );
}
