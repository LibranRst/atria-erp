"use client";

import { useRouter } from "@/lib/navigation/workspace-navigation";

import React from "react";
import { toast } from "sonner";
import { approveFieldRequest, approveVendorPayment } from "@/app/actions/finance/field-requests";
import { decideInventoryOpening } from "@/app/actions/material/opening-inventory";
import {
  Button,
  CompactFormDialog,
  ConfirmationDialog,
  DetailSection,
  FormField,
  MediaPreviewDialog,
  MoneyValue,
  RowGroup,
  SummaryFact,
  SummarySurface,
  Textarea,
} from "@/components/ui";
import {
  ApprovalDecisionReasonFields,
  approvalRequiresEmergencyOverride,
  approvalRequiresOpeningReason,
} from "@/features/approvals/components/shared/approval-decision-reason-fields";
import {
  ApprovalDecisionSubject,
  ApprovalDetailSheet,
} from "@/features/approvals/components/views/approval-list-presentation";
import { ApprovalWorkbenchRow } from "@/features/finance-dashboard/components/rows/approval-rows";
import { DashboardTabEmpty } from "@/features/finance-dashboard/components/shared/dashboard-row-primitives";
import { shortMoney } from "@/features/finance-dashboard/utils/dashboard-formatters";
import type { ApprovalDetail } from "@atria/core/finance/approval-types";
import type { ApprovalQueueSummary } from "@atria/core/finance/approval-summary";
import { getErrorMessage } from "@atria/core/utils/error-message";

type ApprovalDecision = {
  readonly item: ApprovalDetail;
  readonly status: "APPROVED" | "REJECTED";
};

type ApprovalsTabProps = {
  readonly approvals: readonly ApprovalDetail[];
  readonly approvalSummary: ApprovalQueueSummary;
  readonly onDecisionRecorded: (item: ApprovalDetail) => void;
  readonly canEmergencyOverride?: boolean;
  readonly renderDesktopList?: (onOpen: (item: ApprovalDetail) => void) => React.ReactNode;
};

export function ApprovalsTab({
  approvals,
  approvalSummary,
  onDecisionRecorded,
  canEmergencyOverride = false,
  renderDesktopList,
}: ApprovalsTabProps): React.JSX.Element {
  const router = useRouter();
  const [selectedApproval, setSelectedApproval] = React.useState<ApprovalDetail | null>(null);
  const [activeImage, setActiveImage] = React.useState<string | null>(null);
  const [decision, setDecision] = React.useState<ApprovalDecision | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [approvalReason, setApprovalReason] = React.useState("");
  const [emergencyOverride, setEmergencyOverride] = React.useState(false);
  const [emergencyReason, setEmergencyReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();
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

        React.startTransition(() => {
          onDecisionRecorded(item);
          router.refresh();
        });
        setSelectedApproval(null);
        setDecision(null);
        setRejectionReason("");
        setApprovalReason("");
        setEmergencyOverride(false);
        setEmergencyReason("");
        toast.success(
          `${status === "APPROVED" ? "Persetujuan" : "Penolakan"} ${shortMoney(item.amount)} berhasil dicatat.`,
        );
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, "Gagal memproses persetujuan."));
      }
    });
  }

  return (
    <div className="space-y-sm">
      {renderDesktopList ? (
        <div className="flex items-center justify-between rounded-desktop-panel bg-white p-4 ring-1 ring-ring-subtle">
          <div>
            <p className="text-support text-on-surface-variant">Menunggu keputusan</p>
            <p className="text-title font-semibold tabular-nums">{approvalSummary.totalCount}</p>
          </div>
          <div className="text-end">
            <p className="text-support text-on-surface-variant">Nilai antrean</p>
            <MoneyValue amount={approvalSummary.totalAmount} size="lg" variant="compact" />
          </div>
          <p className="text-support text-on-surface-variant">
            {approvalSummary.criticalCount} kritis · {approvalSummary.waitingLongCount} menunggu ≥3
            hari
          </p>
        </div>
      ) : (
        <SummarySurface
          ariaLabel="Antrean keputusan"
          eyebrow="Antrean keputusan"
          icon="approval"
          status={approvalSummary.totalCount > 0 ? "Perlu ditinjau" : "Selesai"}
          statusTone={approvalSummary.totalCount > 0 ? "warning" : "positive"}
        >
          <div className="flex items-end justify-between gap-4 px-3.5 pt-3.5 pb-2">
            <div className="min-w-0">
              <p className="financial-amount text-[36px] leading-none font-extrabold tracking-[-0.045em] text-on-surface max-[430px]:text-[32px]">
                {approvalSummary.totalCount}
              </p>
              <p className="text-meta font-semibold text-on-surface-variant">
                persetujuan menunggu keputusan
              </p>
            </div>
            <div className="min-w-0 shrink-0 text-right">
              <p className="text-eyebrow font-semibold text-on-surface-variant/60">Total antrean</p>
              <MoneyValue
                amount={approvalSummary.totalAmount}
                variant="compact"
                size="lg"
                align="right"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-2">
            <SummaryFact
              label="Prioritas kritis"
              value={String(approvalSummary.criticalCount)}
              tone={approvalSummary.criticalCount > 0 ? "danger" : "default"}
            />
            <SummaryFact
              label="Menunggu ≥3 hari"
              value={String(approvalSummary.waitingLongCount)}
              tone={approvalSummary.waitingLongCount > 0 ? "warning" : "positive"}
            />
          </div>
        </SummarySurface>
      )}

      {renderDesktopList ? (
        renderDesktopList(setSelectedApproval)
      ) : (
        <DetailSection title="Urutan prioritas" href="/approvals" actionLabel="Buka semua">
          {approvals.length === 0 ? (
            <DashboardTabEmpty>
              Tidak ada persetujuan tertunda. Semua keputusan saat ini sudah ditangani.
            </DashboardTabEmpty>
          ) : (
            <>
              <div className="mx-3 mt-3 rounded-inset bg-surface-container-low px-3 py-2 text-meta text-on-surface-variant">
                Diurutkan berdasarkan risiko budget, jatuh tempo, lama menunggu, dan nominal.
              </div>
              <RowGroup>
                {approvals.map((item) => (
                  <ApprovalWorkbenchRow
                    key={item.id}
                    item={item}
                    pending={pending}
                    onOpen={setSelectedApproval}
                  />
                ))}
              </RowGroup>
            </>
          )}
        </DetailSection>
      )}

      <ApprovalDetailSheet
        item={selectedApproval}
        pending={pending}
        onClose={() => {
          if (!pending) setSelectedApproval(null);
        }}
        onOpenReceipt={setActiveImage}
        onDecision={requestDecision}
      />

      <MediaPreviewDialog
        open={activeImage !== null}
        title="Bukti pengajuan"
        imageUrl={activeImage}
        alt="Bukti pengajuan"
        onClose={() => setActiveImage(null)}
      />

      <ConfirmationDialog
        open={decision?.status === "APPROVED"}
        title="Setujui pengajuan?"
        tone={
          decision?.item && approvalRequiresEmergencyOverride(decision.item, canEmergencyOverride)
            ? "warning"
            : "default"
        }
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
        {decision?.item ? (
          <div className="space-y-3">
            <ApprovalDecisionSubject item={decision.item} />
            {approvalRequiresEmergencyOverride(decision.item, canEmergencyOverride) ||
            approvalRequiresOpeningReason(decision.item, canEmergencyOverride) ? (
              <div className="border-t border-black/5.5 pt-3">
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
              </div>
            ) : null}
          </div>
        ) : null}
      </ConfirmationDialog>

      <CompactFormDialog
        open={decision?.status === "REJECTED"}
        title="Alasan Penolakan"
        onClose={closeDecision}
        pending={pending}
        actions={
          <Button
            type="button"
            variant="critical"
            fullWidth
            disabled={
              pending ||
              rejectionReason.trim().length < (decision?.item.type === "inventory_opening" ? 10 : 5)
            }
            pending={pending}
            pendingLabel="Menyimpan penolakan"
            onClick={confirmDecision}
          >
            Tolak pengajuan
          </Button>
        }
      >
        <div className="space-y-md">
          {decision?.item ? (
            <div className="rounded-inset bg-white p-4 ring-1 ring-ring-subtle">
              <ApprovalDecisionSubject item={decision.item} />
            </div>
          ) : null}
          <div className="rounded-inset bg-error-container/25 p-4 text-xs leading-5 text-error">
            Pengajuan tidak akan dilanjutkan. Jelaskan alasan yang dapat ditindaklanjuti oleh
            pengaju.
          </div>
          <FormField
            label="Alasan penolakan"
            helper={`Minimal ${decision?.item.type === "inventory_opening" ? 10 : 5} karakter.`}
            required
          >
            <Textarea
              id="dashboard-rejection-reason"
              autoFocus
              rows={4}
              value={rejectionReason}
              onChange={setRejectionReason}
              disabled={pending}
              placeholder="Contoh: nominal belum sesuai dengan progres pekerjaan"
              aria-invalid={
                rejectionReason.length > 0 &&
                rejectionReason.trim().length <
                  (decision?.item.type === "inventory_opening" ? 10 : 5)
              }
            />
          </FormField>
        </div>
      </CompactFormDialog>
    </div>
  );
}
