import React from "react";

import { redirect } from "next/navigation";

import { resolveActor } from "@/server/actor";

import { PageHeader, PageState } from "@/components/ui";
import { ApprovalList } from "@/features/approvals/components/views/approval-list";
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
    <section className="space-y-sm px-1 pb-8 select-none max-[430px]:-mx-1 max-[430px]:pb-6">
      <PageHeader
        title="Persetujuan"
        subtitle="Tinjau dampak budget, kas, atau stok sebelum memberi keputusan."
      />
      <ApprovalList
        key={data.referenceDateIso}
        initialApprovals={data.approvals}
        canEmergencyOverride={data.canEmergencyOverride}
        referenceDateIso={data.referenceDateIso}
      />
    </section>
  );
}
