import { resolveRoleName } from "@/lib/auth/permissions";
import { ApprovalList } from "@/features/approvals/components/approval-list";
import { PageState } from "@/components/ui";
import { PageHeader } from "@/components/ui/page-primitives";
import {
  getPendingApprovalDetails,
  rankPendingApprovals,
} from "@/lib/finance/approval-details";
import { requireServerSession } from "@/lib/server/session";
import React from "react";

export default async function ApprovalsPage(): Promise<React.JSX.Element> {
  // 1. Get session
  const session = await requireServerSession();

  // 2. Resolve role & enforce permissions (Only OWNER can access approvals screen)
  const roleName = await resolveRoleName(session.user.roleId);
  if (roleName !== "OWNER") {
    return (
      <PageState
        kind="restricted"
        title="Akses terbatas"
        description="Antrean keputusan finansial hanya tersedia untuk Owner. Akses Anda tetap aktif pada modul yang sesuai dengan peran."
      />
    );
  }

  const resolvedApprovals = rankPendingApprovals(
    await getPendingApprovalDetails(),
    new Date(),
  );

  return (
    <section className="space-y-lg px-1 pb-8 select-none max-[430px]:-mx-1 max-[430px]:space-y-5 max-[430px]:pb-6">
      <PageHeader
        title="Persetujuan"
        subtitle="Tinjau risiko dan konteks budget sebelum memberi keputusan."
      />
      <ApprovalList initialApprovals={resolvedApprovals} />
    </section>
  );
}
