"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

import {
  approveFieldRequest,
  approveVendorPayment,
} from "@/app/actions/finance/field-requests";
import {
  BottomSheet,
  ConfirmationSheet,
  Textarea,
  useSheetPresenceValue,
} from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import {
  DashboardDetailSection,
  DashboardRowGroup,
  DashboardSummarySurface,
} from "@/features/finance-dashboard/components/dashboard-primitives";
import {
  ApprovalBudgetContext,
  ApprovalWorkbenchRow,
  DashboardTabEmpty,
} from "@/features/finance-dashboard/components/dashboard-rows";
import {
  formatShortDate,
  shortMoney,
} from "@/features/finance-dashboard/lib/dashboard-formatters";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { getErrorMessage } from "@/lib/utils/error-message";

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
  const {
    presentedValue: presentedApproval,
    open: approvalOpen,
    handleExitComplete: handleApprovalExitComplete,
  } = useSheetPresenceValue(selectedApproval, selectedApproval?.id);
  const [decision, setDecision] = React.useState<ApprovalDecision | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const criticalCount = approvals.filter(
    (item) => item.priority === "CRITICAL",
  ).length;
  const visibleAmount = approvals.reduce((sum, item) => sum + item.amount, 0);

  function requestDecision(
    item: ApprovalDetail,
    status: ApprovalDecision["status"],
  ): void {
    setDecision({ item, status });
    if (status === "REJECTED") setRejectionReason("");
  }

  function closeDecision(): void {
    if (pending) return;
    setDecision(null);
    setRejectionReason("");
  }

  function confirmDecision(): void {
    if (!decision) return;
    if (decision.status === "REJECTED" && rejectionReason.trim().length < 5) {
      toast.error("Tuliskan alasan penolakan minimal 5 karakter.");
      return;
    }
    const { item, status } = decision;
    startTransition(async () => {
      try {
        const notes =
          status === "APPROVED"
            ? "Disetujui Owner dari Dashboard"
            : rejectionReason.trim();
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
        setSelectedApproval(null);
        setDecision(null);
        setRejectionReason("");
        toast.success(
          `${status === "APPROVED" ? "Persetujuan" : "Penolakan"} ${shortMoney(item.amount)} berhasil dicatat.`,
        );
        router.refresh();
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Gagal memproses persetujuan."));
      }
    });
  }

  return (
    <div className="space-y-lg max-[430px]:space-y-5">
      <DashboardSummarySurface
        ariaLabel="Antrean keputusan"
        eyebrow="Antrean keputusan"
        icon="approval"
        status={approvalCount > 0 ? "Perlu ditinjau" : "Selesai"}
        statusTone={approvalCount > 0 ? "warning" : "positive"}
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[30px] font-black leading-none text-on-surface max-[430px]:text-[27px]">
              {approvalCount}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-on-surface-variant">
              persetujuan menunggu keputusan
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[8px] font-semibold text-on-surface-variant/60">
              Total antrean
            </p>
            <MoneyValue
              amount={visibleAmount}
              variant="compactWithFull"
              size="sm"
              align="right"
              className="mt-1"
            />
          </div>
        </div>
        <div className="mt-3.5 grid grid-cols-2 divide-x divide-black/[0.055] rounded-[18px] bg-surface-container-low/65 px-3 py-2.5 max-[430px]:gap-0">
          <div>
            <p className="text-[9px] font-semibold text-on-surface-variant/60">
              Prioritas kritis
            </p>
            <p
              className={`mt-1 font-mono text-sm font-black ${criticalCount > 0 ? "text-error" : "text-on-surface"}`}
            >
              {criticalCount}
            </p>
          </div>
          <div className="pl-3 text-right">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">
              Urutan otomatis
            </p>
            <p className="mt-1 text-[10px] font-bold text-on-surface">
              Risiko &amp; urgensi
            </p>
          </div>
        </div>
      </DashboardSummarySurface>

      <DashboardDetailSection
        title="Urutan prioritas"
        href="/approvals"
        actionLabel="Buka semua"
      >
        {approvals.length === 0 ? (
          <DashboardTabEmpty>
            Tidak ada persetujuan tertunda. Semua keputusan saat ini sudah
            ditangani.
          </DashboardTabEmpty>
        ) : (
          <>
            <div className="mx-3 mt-3 rounded-[15px] bg-surface-container-low/65 px-3 py-2 text-[10px] leading-4 text-on-surface-variant">
              Diurutkan berdasarkan risiko budget, jatuh tempo, lama menunggu,
              dan nominal.
            </div>
            <DashboardRowGroup>
              {approvals.map((item) => (
                <ApprovalWorkbenchRow
                  key={item.id}
                  item={item}
                  pending={pending}
                  onOpen={setSelectedApproval}
                />
              ))}
            </DashboardRowGroup>
          </>
        )}
      </DashboardDetailSection>

      <BottomSheet
        open={approvalOpen}
        title="Tinjau Persetujuan"
        onClose={() => setSelectedApproval(null)}
        onExitComplete={handleApprovalExitComplete}
        footer={
          presentedApproval ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => requestDecision(presentedApproval, "REJECTED")}
                className="min-h-12 rounded-full bg-error-container/30 px-4 text-xs font-bold text-error disabled:opacity-45"
              >
                Tolak
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => requestDecision(presentedApproval, "APPROVED")}
                className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-45"
              >
                Setujui
              </button>
            </div>
          ) : undefined
        }
      >
        {presentedApproval ? (
          <div className="space-y-md">
            <section className="overflow-hidden rounded-[24px] bg-surface-container-lowest shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-[9px] font-bold ${presentedApproval.priority === "CRITICAL" ? "bg-error-container/30 text-error" : presentedApproval.priority === "WARNING" ? "bg-warning-light text-warning" : "bg-primary/8 text-primary"}`}
                  >
                    {presentedApproval.priorityReason}
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold text-on-surface-variant">
                    {formatShortDate(presentedApproval.createdAt)}
                  </span>
                </div>
                <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/65">
                  Nominal pengajuan
                </p>
                <MoneyValue
                  amount={presentedApproval.amount}
                  variant="fullDynamic"
                  size="hero"
                  className="mt-1"
                />
                <p className="mt-3 text-sm font-semibold leading-[1.3] text-on-surface">
                  {presentedApproval.description}
                </p>
              </div>
              {presentedApproval.notes ? (
                <div className="border-t border-outline-variant/20 bg-surface-container-low/55 px-4 py-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/65">
                    Catatan pengajuan
                  </p>
                  <p className="mt-1 text-xs leading-[1.4] text-on-surface-variant">
                    {presentedApproval.notes}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="overflow-hidden rounded-[24px] bg-surface-container-lowest shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
              {[
                ["Proyek", presentedApproval.projectName],
                ["Pengaju", presentedApproval.requestedBy],
                ["Kategori", presentedApproval.budgetItemName],
                [
                  "Jatuh tempo",
                  presentedApproval.dueDate
                    ? formatShortDate(presentedApproval.dueDate)
                    : "Tidak ditentukan",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex min-h-12 items-center justify-between gap-4 border-b border-outline-variant/20 px-4 py-3 last:border-b-0"
                >
                  <p className="shrink-0 text-[10px] font-medium text-on-surface-variant">
                    {label}
                  </p>
                  <p className="min-w-0 truncate text-right text-xs font-semibold text-on-surface">
                    {value}
                  </p>
                </div>
              ))}
            </section>

            <ApprovalBudgetContext item={presentedApproval} />
            {presentedApproval.receiptImageUrl ? (
              <section className="space-y-2.5">
                <h3 className="px-1 text-[10px] font-bold uppercase tracking-[0.11em] text-on-surface">
                  Bukti pengajuan
                </h3>
                <div className="overflow-hidden rounded-[24px] bg-surface-container-lowest p-3 shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1 ring-outline-variant/15">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={presentedApproval.receiptImageUrl}
                    alt="Bukti pengajuan"
                    className="max-h-[280px] w-full rounded-[16px] bg-surface-container-low object-contain"
                  />
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <ConfirmationSheet
        open={decision?.status === "APPROVED"}
        title="Setujui pengajuan?"
        description="Dampak budget sudah ditampilkan di detail. Keputusan ini akan dicatat dalam audit log."
        confirmLabel="Setujui"
        pending={pending}
        onClose={closeDecision}
        onConfirm={confirmDecision}
      />

      <BottomSheet
        open={decision?.status === "REJECTED"}
        title="Alasan Penolakan"
        onClose={closeDecision}
      >
        <div className="space-y-md">
          <div className="rounded-[20px] bg-error-container/25 p-4 text-xs leading-5 text-error">
            Pengajuan tidak akan dilanjutkan. Jelaskan alasan yang dapat
            ditindaklanjuti oleh pengaju.
          </div>
          <div>
            <label
              htmlFor="dashboard-rejection-reason"
              className="px-1 text-xs font-bold text-on-surface"
            >
              Alasan penolakan
            </label>
            <Textarea
              id="dashboard-rejection-reason"
              autoFocus
              rows={4}
              value={rejectionReason}
              onChange={setRejectionReason}
              disabled={pending}
              placeholder="Contoh: nominal belum sesuai dengan progres pekerjaan"
              className="mt-2"
              aria-invalid={
                rejectionReason.length > 0 && rejectionReason.trim().length < 5
              }
            />
            <p className="mt-1 px-1 text-[10px] text-on-surface-variant">
              Minimal 5 karakter.
            </p>
          </div>
          <button
            type="button"
            disabled={pending || rejectionReason.trim().length < 5}
            onClick={confirmDecision}
            className="min-h-12 w-full rounded-full bg-error px-5 text-xs font-bold text-white disabled:opacity-40"
          >
            {pending ? "Menyimpan penolakan" : "Tolak pengajuan"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
