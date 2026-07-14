import { resolveRoleName } from "@/lib/auth/permissions";
import { ApprovalList } from "@/features/approvals/components/approval-list";
import { Badge } from "@/components/ui/badge";
import { PageState } from "@/components/ui";
import { PageHeader } from "@/components/ui/page-primitives";
import { getPendingApprovalDetails } from "@/lib/finance/approval-details";
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

  const resolvedApprovals = await getPendingApprovalDetails();

  return (
    <section className="space-y-sm select-none">
      <PageHeader
        title="Persetujuan"
        subtitle="Tinjau risiko dan konteks budget sebelum memberi keputusan."
        badge={(
          <Badge status={resolvedApprovals.length > 0 ? "CRITICAL" : "APPROVED"}>
            {resolvedApprovals.length > 0 ? `${resolvedApprovals.length} Antrean` : "Semua Bersih"}
          </Badge>
        )}
      />

      <div className="pt-xs">
        <ApprovalList initialApprovals={resolvedApprovals} />
      </div>
    </section>
  );
}
