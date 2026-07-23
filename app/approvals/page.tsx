import { resolveRoleName } from "@/lib/auth/permissions";
import { ApprovalList } from "@/features/approvals/components/views/approval-list";
import { PageState } from "@/components/ui";
import { PageHeader } from "@/components/ui/feedback/page-primitives";
import { getPendingApprovalDetails, rankPendingApprovals } from "@/lib/finance/approval-details";
import { requireServerSession } from "@/lib/server/session";
import React from "react";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage(): Promise<React.JSX.Element> {
  // 1. Get session
  const session = await requireServerSession();

  // 2. Resolve role & enforce permissions according to the decision type.
  const roleName = await resolveRoleName(session.user.roleId);
  if (roleName !== "OWNER" && roleName !== "FINANCE_ADMIN") {
    return (
      <PageState
        kind="restricted"
        title="Akses terbatas"
        description="Antrean keputusan hanya tersedia untuk Owner dan Finance Admin sesuai permission masing-masing."
      />
    );
  }

  const allApprovals = rankPendingApprovals(await getPendingApprovalDetails(), new Date());
  const resolvedApprovals =
    roleName === "FINANCE_ADMIN"
      ? allApprovals.filter((item) => item.type === "inventory_opening")
      : allApprovals;

  return (
    <section className="space-y-lg px-1 pb-8 select-none max-[430px]:-mx-1 max-[430px]:space-y-5 max-[430px]:pb-6">
      <PageHeader
        title="Persetujuan"
        subtitle="Tinjau dampak budget, kas, atau stok sebelum memberi keputusan."
      />
      <ApprovalList
        initialApprovals={resolvedApprovals}
        canEmergencyOverride={roleName === "OWNER"}
      />
    </section>
  );
}
