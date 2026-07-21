"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";
import { approveFieldRequest, approveVendorPayment } from "@/app/actions/finance/field-requests";
import { decideInventoryOpening } from "@/app/actions/material/opening-inventory";
import { BottomSheet, ConfirmationSheet, Textarea, useSheetPresenceValue } from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import {
  ApprovalDecisionReasonFields,
  approvalRequiresEmergencyOverride,
  approvalRequiresOpeningReason,
} from "@/features/approvals/components/approval-decision-reason-fields";
import { InventoryOpeningApprovalItems } from "@/features/approvals/components/inventory-opening-approval-items";
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
import { formatShortDate, shortMoney } from "@/features/finance-dashboard/lib/dashboard-formatters";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { getErrorMessage } from "@/lib/utils/error-message";

type ApprovalDecision = {
  readonly item: ApprovalDetail;
  readonly status: "APPROVED" | "REJECTED";
};

type ApprovalsTabProps = {
  readonly approvals: readonly ApprovalDetail[];
  readonly approvalCount: number;
  readonly setApprovals: React.Dispatch<React.SetStateAction<readonly ApprovalDetail[]>>;
  readonly setApprovalCount: React.Dispatch<React.SetStateAction<number>>;
  readonly canEmergencyOverride?: boolean;
};

export function ApprovalsTab({
  approvals,
  approvalCount,
  setApprovals,
  setApprovalCount,
  canEmergencyOverride = false,
}: ApprovalsTabProps): React.JSX.Element {
  const router = useRouter();
  const [selectedApproval, setSelectedApproval] = React.useState<ApprovalDetail | null>(null);
  const {
    presentedValue: presentedApproval,
    open: approvalOpen,
    handleExitComplete: handleApprovalExitComplete,
  } = useSheetPresenceValue(selectedApproval, selectedApproval?.id);
  const [decision, setDecision] = React.useState<ApprovalDecision | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [approvalReason, setApprovalReason] = React.useState("");
  const [emergencyOverride, setEmergencyOverride] = React.useState(false);
  const [emergencyReason, setEmergencyReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const criticalCount = approvals.filter((item) => item.priority === "CRITICAL").length;
  const visibleAmount = approvals.reduce((sum, item) => sum + item.amount, 0);

  function requestDecision(item: ApprovalDetail, status: ApprovalDecision["status"]): void {
    setDecision({ item, status });
    if (status === "REJECTED") setRejectionReason("");
    if (status === "APPROVED") {
      setApprovalReason("");
      setEmergencyOverride(false);
      setEmergencyReason("");
    }
  }

  function closeDecision(): void {
    if (pending) return;
    setDecision(null);
    setRejectionReason("");
    setApprovalReason("");
    setEmergencyOverride(false);
    setEmergencyReason("");
  }

  function confirmDecision(): void {
    if (!decision) return;
    const requiresEmergencyOverride = approvalRequiresEmergencyOverride(
      decision.item,
      canEmergencyOverride,
    );
    const requiresOpeningReason = approvalRequiresOpeningReason(
      decision.item,
      canEmergencyOverride,
    );
    if (
      decision.status === "REJECTED" &&
      rejectionReason.trim().length < (decision.item.type === "inventory_opening" ? 10 : 5)
    ) {
      toast.error(
        `Tuliskan alasan penolakan minimal ${decision.item.type === "inventory_opening" ? 10 : 5} karakter.`,
      );
      return;
    }
    if (
      decision.status === "APPROVED" &&
      requiresOpeningReason &&
      approvalReason.trim().length < 10
    ) {
      toast.error("Alasan persetujuan minimal 10 karakter.");
      return;
    }
    if (decision.status === "APPROVED" && requiresEmergencyOverride && !emergencyOverride) {
      toast.error("Aktifkan emergency override untuk persetujuan sendiri.");
      return;
    }
    if (decision.status === "APPROVED" && emergencyOverride && emergencyReason.trim().length < 10) {
      toast.error("Alasan emergency override minimal 10 karakter.");
      return;
    }
    const { item, status } = decision;
    startTransition(async () => {
      try {
        const notes =
          status === "APPROVED"
            ? emergencyOverride
              ? emergencyReason.trim()
              : item.type === "inventory_opening"
                ? approvalReason.trim()
                : "Disetujui Owner dari Dashboard"
            : rejectionReason.trim();
        const result =
          item.type === "inventory_opening"
            ? await decideInventoryOpening({
                batchId: item.referenceId,
                decision: status === "APPROVED" ? "APPROVE" : "REJECT",
                reason: notes,
                emergencyOverride,
              })
            : item.type === "project_cost"
              ? await approveFieldRequest({
                  projectCostId: item.referenceId,
                  status,
                  notes,
                  emergencyOverride,
                })
              : await approveVendorPayment(item.referenceId, notes, status, emergencyOverride);
        if (!result.success) throw new Error(result.error.message);

        setApprovals((current) => current.filter((approval) => approval.id !== item.id));
        setApprovalCount((current) => Math.max(0, current - 1));
        setSelectedApproval(null);
        setDecision(null);
        setRejectionReason("");
        setApprovalReason("");
        setEmergencyOverride(false);
        setEmergencyReason("");
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
            <p className="text-on-surface font-mono text-[30px] leading-none font-black max-[430px]:text-[27px]">
              {approvalCount}
            </p>
            <p className="text-on-surface-variant mt-1 text-[10px] font-semibold">
              persetujuan menunggu keputusan
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-on-surface-variant/60 text-[8px] font-semibold">Total antrean</p>
            <MoneyValue
              amount={visibleAmount}
              variant="compactWithFull"
              size="sm"
              align="right"
              className="mt-1"
            />
          </div>
        </div>
        <div className="bg-surface-container-low/65 mt-3.5 grid grid-cols-2 divide-x divide-black/5.5 rounded-[18px] px-3 py-2.5 max-[430px]:gap-0">
          <div>
            <p className="text-on-surface-variant/60 text-[9px] font-semibold">Prioritas kritis</p>
            <p
              className={`mt-1 font-mono text-sm font-black ${criticalCount > 0 ? "text-error" : "text-on-surface"}`}
            >
              {criticalCount}
            </p>
          </div>
          <div className="pl-3 text-right">
            <p className="text-on-surface-variant/60 text-[9px] font-semibold">Urutan otomatis</p>
            <p className="text-on-surface mt-1 text-[10px] font-bold">Risiko &amp; urgensi</p>
          </div>
        </div>
      </DashboardSummarySurface>

      <DashboardDetailSection title="Urutan prioritas" href="/approvals" actionLabel="Buka semua">
        {approvals.length === 0 ? (
          <DashboardTabEmpty>
            Tidak ada persetujuan tertunda. Semua keputusan saat ini sudah ditangani.
          </DashboardTabEmpty>
        ) : (
          <>
            <div className="bg-surface-container-low/65 text-on-surface-variant mx-3 mt-3 rounded-[15px] px-3 py-2 text-[10px] leading-4">
              Diurutkan berdasarkan risiko budget, jatuh tempo, lama menunggu, dan nominal.
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
                className="bg-error-container/30 text-error min-h-12 rounded-full px-4 text-xs font-bold disabled:opacity-45"
              >
                Tolak
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => requestDecision(presentedApproval, "APPROVED")}
                className="bg-primary text-on-primary min-h-12 rounded-full px-4 text-xs font-bold disabled:opacity-45"
              >
                Setujui
              </button>
            </div>
          ) : undefined
        }
      >
        {presentedApproval ? (
          <div className="space-y-md">
            <section className="bg-surface-container-lowest ring-outline-variant/15 overflow-hidden rounded-[24px] shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1">
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-[9px] font-bold ${presentedApproval.priority === "CRITICAL" ? "bg-error-container/30 text-error" : presentedApproval.priority === "WARNING" ? "bg-warning-light text-warning" : "bg-primary/8 text-primary"}`}
                  >
                    {presentedApproval.priorityReason}
                  </span>
                  <span className="text-on-surface-variant shrink-0 text-[10px] font-semibold">
                    {formatShortDate(presentedApproval.createdAt)}
                  </span>
                </div>
                <p className="text-on-surface-variant/65 mt-4 text-[9px] font-bold tracking-[0.12em] uppercase">
                  Nominal pengajuan
                </p>
                <MoneyValue
                  amount={presentedApproval.amount}
                  variant="fullDynamic"
                  size="hero"
                  className="mt-1"
                />
                <p className="text-on-surface mt-3 text-sm leading-[1.3] font-semibold">
                  {presentedApproval.description}
                </p>
              </div>
              {presentedApproval.notes ? (
                <div className="border-outline-variant/20 bg-surface-container-lowest border-t px-4 py-3">
                  <p className="text-on-surface-variant/65 text-[9px] leading-5 font-bold tracking-widest uppercase">
                    Catatan pengajuan
                  </p>
                  <p className="text-on-surface-variant text-xs leading-4">
                    {presentedApproval.notes}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="bg-surface-container-lowest ring-outline-variant/15 overflow-hidden rounded-[24px] shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1">
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
                  className="border-outline-variant/20 flex min-h-12 items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
                >
                  <p className="text-on-surface-variant shrink-0 text-[10px] font-medium">
                    {label}
                  </p>
                  <p className="text-on-surface min-w-0 truncate text-right text-xs font-semibold">
                    {value}
                  </p>
                </div>
              ))}
            </section>

            {presentedApproval.type === "inventory_opening" ? (
              <>
                <InventoryOpeningApprovalItems item={presentedApproval} />
                <section className="bg-surface-container-lowest ring-outline-variant/15 overflow-hidden rounded-[24px] shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1">
                  <div className="px-4 py-3.5">
                    <p className="text-on-surface-variant/65 text-[10px] font-bold tracking-widest uppercase">
                      Dampak stok
                    </p>
                    <p className="text-on-surface mt-1 text-xs leading-5">
                      Setelah disetujui, stok dan nilai inventory bertambah. Kas, utang vendor, dan
                      actual cost proyek tidak berubah.
                    </p>
                  </div>
                </section>
              </>
            ) : (
              <ApprovalBudgetContext item={presentedApproval} />
            )}
            {presentedApproval.receiptImageUrl ? (
              <section className="space-y-2.5">
                <h3 className="text-on-surface px-1 text-[10px] font-bold tracking-[0.11em] uppercase">
                  Bukti pengajuan
                </h3>
                <div className="bg-surface-container-lowest ring-outline-variant/15 overflow-hidden rounded-[24px] p-3 shadow-[0_10px_28px_rgba(17,17,17,0.035)] ring-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={presentedApproval.receiptImageUrl}
                    alt="Bukti pengajuan"
                    className="bg-surface-container-low max-h-[280px] w-full rounded-[16px] object-contain"
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
        description={
          decision?.item.type === "inventory_opening"
            ? "Pastikan jumlah fisik, harga per unit, dan subtotal sudah sesuai. Keputusan dicatat dalam audit log."
            : "Dampak budget sudah ditampilkan di detail. Keputusan ini akan dicatat dalam audit log."
        }
        confirmLabel="Setujui"
        pending={pending}
        disabled={
          (decision?.item.type === "inventory_opening" &&
            approvalRequiresOpeningReason(decision.item, canEmergencyOverride) &&
            approvalReason.trim().length < 10) ||
          (Boolean(
            decision?.item &&
            approvalRequiresEmergencyOverride(decision.item, canEmergencyOverride),
          ) &&
            (!emergencyOverride || emergencyReason.trim().length < 10))
        }
        onClose={closeDecision}
        onConfirm={confirmDecision}
      >
        {decision?.item &&
        (approvalRequiresEmergencyOverride(decision.item, canEmergencyOverride) ||
          approvalRequiresOpeningReason(decision.item, canEmergencyOverride)) ? (
          <ApprovalDecisionReasonFields
            item={decision.item}
            canEmergencyOverride={canEmergencyOverride}
            approvalReason={approvalReason}
            emergencyOverride={emergencyOverride}
            emergencyReason={emergencyReason}
            pending={pending}
            idPrefix="dashboard-approval"
            onApprovalReasonChange={setApprovalReason}
            onEmergencyOverrideChange={setEmergencyOverride}
            onEmergencyReasonChange={setEmergencyReason}
          />
        ) : null}
      </ConfirmationSheet>

      <BottomSheet
        open={decision?.status === "REJECTED"}
        title="Alasan Penolakan"
        onClose={closeDecision}
      >
        <div className="space-y-md">
          <div className="bg-error-container/25 text-error rounded-[20px] p-4 text-xs leading-5">
            Pengajuan tidak akan dilanjutkan. Jelaskan alasan yang dapat ditindaklanjuti oleh
            pengaju.
          </div>
          <div>
            <label
              htmlFor="dashboard-rejection-reason"
              className="text-on-surface px-1 text-xs font-bold"
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
                rejectionReason.length > 0 &&
                rejectionReason.trim().length <
                  (decision?.item.type === "inventory_opening" ? 10 : 5)
              }
            />
            <p className="text-on-surface-variant mt-1 px-1 text-[10px]">
              Minimal {decision?.item.type === "inventory_opening" ? 10 : 5} karakter.
            </p>
          </div>
          <button
            type="button"
            disabled={
              pending ||
              rejectionReason.trim().length < (decision?.item.type === "inventory_opening" ? 10 : 5)
            }
            onClick={confirmDecision}
            className="bg-error min-h-12 w-full rounded-full px-5 text-xs font-bold text-white disabled:opacity-40"
          >
            {pending ? "Menyimpan penolakan" : "Tolak pengajuan"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
