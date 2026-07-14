"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import {
  approveFieldRequest,
  approveVendorPayment,
} from "@/app/actions/finance/field-requests";
import { MoneyValue } from "@/components/ui/page-primitives";
import { Badge, BottomSheet, ConfirmationSheet } from "@/components/ui";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { getErrorMessage } from "@/lib/utils/error-message";
import {
  formatShortDate,
  shortMoney,
} from "@/features/finance-dashboard/lib/dashboard-formatters";
import {
  DashboardDetailSection,
  DashboardRowGroup,
  DashboardTabShell,
  type DashboardMetricItem,
} from "@/features/finance-dashboard/components/dashboard-primitives";
import {
  ApprovalBudgetContext,
  ApprovalWorkbenchRow,
  DashboardTabEmpty,
  MiniSignal,
} from "@/features/finance-dashboard/components/dashboard-rows";

type ApprovalDecision = {
  readonly item: ApprovalDetail;
  readonly status: "APPROVED" | "REJECTED";
};

type ApprovalsTabProps = {
  readonly approvals: readonly ApprovalDetail[];
  readonly approvalCount: number;
  readonly setApprovals: React.Dispatch<
    React.SetStateAction<readonly ApprovalDetail[]>
  >;
  readonly setApprovalCount: React.Dispatch<React.SetStateAction<number>>;
};

export function ApprovalsTab({
  approvals,
  approvalCount,
  setApprovals,
  setApprovalCount,
}: ApprovalsTabProps): React.JSX.Element {
  const router = useRouter();
  const [selectedApproval, setSelectedApproval] =
    React.useState<ApprovalDetail | null>(null);
  const [decision, setDecision] = React.useState<ApprovalDecision | null>(null);
  const [pending, startTransition] = React.useTransition();

  function requestDecision(
    item: ApprovalDetail,
    status: ApprovalDecision["status"],
  ): void {
    setDecision({ item, status });
  }

  function confirmDecision(): void {
    if (!decision) return;
    const { item, status } = decision;
    startTransition(async () => {
      try {
        const notes =
          status === "APPROVED"
            ? "Disetujui Owner dari dashboard"
            : "Ditolak Owner dari dashboard";
        const result =
          item.type === "project_cost"
            ? await approveFieldRequest({
                projectCostId: item.referenceId,
                status,
                notes,
              })
            : await approveVendorPayment(item.referenceId, notes, status);

        if (!result.success) throw new Error(result.error.message);

        setApprovals((current) =>
          current.filter((approval) => approval.id !== item.id),
        );
        setApprovalCount((current) => Math.max(0, current - 1));
        if (selectedApproval?.id === item.id) setSelectedApproval(null);
        setDecision(null);
        toast.success(
          `${status === "APPROVED" ? "Menyetujui" : "Menolak"} pengajuan ${shortMoney(item.amount)} berhasil.`,
        );
        router.refresh();
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Gagal memproses persetujuan."));
      }
    });
  }

  const projectCostApprovals = approvals.filter(
    (item) => item.type === "project_cost",
  );
  const vendorPaymentApprovals = approvals.filter(
    (item) => item.type === "vendor_payment",
  );
  const metrics: readonly DashboardMetricItem[] = [
    {
      label: "Pending",
      value: String(approvalCount),
      tone: approvalCount > 0 ? "danger" : "default",
    },
    {
      label: "Cost",
      value: String(projectCostApprovals.length),
      tone: projectCostApprovals.length > 0 ? "warning" : "default",
    },
    {
      label: "Vendor",
      value: String(vendorPaymentApprovals.length),
      tone: vendorPaymentApprovals.length > 0 ? "warning" : "default",
    },
  ];

  return (
    <DashboardTabShell metrics={metrics}>
      {approvals.length === 0 ? (
        <DashboardDetailSection
          title="Antrean approval"
          href="/approvals"
          actionLabel="Lihat semua"
        >
          <DashboardTabEmpty>
            Tidak ada approval yang perlu diputuskan.
          </DashboardTabEmpty>
        </DashboardDetailSection>
      ) : (
        <>
          <DashboardDetailSection
            title="Project cost"
            href="/approvals"
            actionLabel="Lihat semua"
          >
            {projectCostApprovals.length === 0 ? (
              <DashboardTabEmpty>
                Tidak ada project cost menunggu approval.
              </DashboardTabEmpty>
            ) : (
              <DashboardRowGroup>
                {projectCostApprovals.map((item) => (
                  <ApprovalWorkbenchRow
                    key={item.id}
                    item={item}
                    pending={pending}
                    onOpen={setSelectedApproval}
                    onDecide={requestDecision}
                  />
                ))}
              </DashboardRowGroup>
            )}
          </DashboardDetailSection>
          <DashboardDetailSection
            title="Vendor payment"
            href="/approvals"
            actionLabel="Lihat semua"
          >
            {vendorPaymentApprovals.length === 0 ? (
              <DashboardTabEmpty>
                Tidak ada vendor payment menunggu approval.
              </DashboardTabEmpty>
            ) : (
              <DashboardRowGroup>
                {vendorPaymentApprovals.map((item) => (
                  <ApprovalWorkbenchRow
                    key={item.id}
                    item={item}
                    pending={pending}
                    onOpen={setSelectedApproval}
                    onDecide={requestDecision}
                  />
                ))}
              </DashboardRowGroup>
            )}
          </DashboardDetailSection>
        </>
      )}
      <BottomSheet
        open={Boolean(selectedApproval)}
        title="Detail Approval"
        onClose={() => setSelectedApproval(null)}
      >
        {selectedApproval && (
          <div className="space-y-sm">
            <div className="rounded-2xl bg-white p-3 shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
              <Badge
                status={
                  selectedApproval.type === "project_cost"
                    ? "WARNING"
                    : "PRIMARY"
                }
              >
                {selectedApproval.type === "project_cost"
                  ? "Dana Lapangan"
                  : "Vendor Payment"}
              </Badge>
              <MoneyValue
                amount={selectedApproval.amount}
                variant="fullDynamic"
                size="hero"
                className="mt-2"
              />
              <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                {selectedApproval.description}
              </p>
              {selectedApproval.notes && (
                <p className="mt-2 rounded-2xl bg-surface-container-low p-3 text-xs leading-5 text-on-surface-variant">
                  {selectedApproval.notes}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniSignal
                label="Project"
                value={selectedApproval.projectName}
              />
              <MiniSignal
                label="Pengaju"
                value={selectedApproval.requestedBy}
              />
              <MiniSignal
                label="Kategori"
                value={selectedApproval.budgetItemName}
              />
              <MiniSignal
                label="Tanggal"
                value={formatShortDate(selectedApproval.createdAt)}
              />
            </div>
            <ApprovalBudgetContext item={selectedApproval} />
            {selectedApproval.receiptImageUrl && (
              <div className="overflow-hidden rounded-2xl bg-surface-container-low">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedApproval.receiptImageUrl}
                  alt="Nota approval"
                  className="max-h-[360px] w-full object-contain"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => requestDecision(selectedApproval, "REJECTED")}
                className="min-h-12 rounded-full bg-error-container/25 text-xs font-bold text-error disabled:opacity-45"
              >
                Tolak
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => requestDecision(selectedApproval, "APPROVED")}
                className="min-h-12 rounded-full bg-primary text-xs font-bold text-on-primary disabled:opacity-45"
              >
                Setujui
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
      <ConfirmationSheet
        open={Boolean(decision)}
        title={
          decision?.status === "REJECTED" ? "Tolak approval?" : "Setujui approval?"
        }
        description="Keputusan ini akan memperbarui status approval dan dicatat di audit log."
        confirmLabel={decision?.status === "REJECTED" ? "Tolak" : "Setujui"}
        danger={decision?.status === "REJECTED"}
        pending={pending}
        onClose={() => setDecision(null)}
        onConfirm={confirmDecision}
      />
    </DashboardTabShell>
  );
}
