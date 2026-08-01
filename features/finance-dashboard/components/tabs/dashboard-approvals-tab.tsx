"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";
import { approveFieldRequest, approveVendorPayment } from "@/app/actions/finance/field-requests";
import { decideInventoryOpening } from "@/app/actions/material/opening-inventory";
import {
  BottomSheet,
  Button,
  ConfirmationSheet,
  DetailSection,
  MoneyValue,
  RowGroup,
  SheetFooterActions,
  StatusBadge,
  SummaryFact,
  SummarySurface,
  Textarea,
  useSheetPresenceValue,
} from "@/components/ui";
import {
  ApprovalDecisionReasonFields,
  approvalRequiresEmergencyOverride,
  approvalRequiresOpeningReason,
} from "@/features/approvals/components/shared/approval-decision-reason-fields";
import { InventoryOpeningApprovalItems } from "@/features/approvals/components/shared/inventory-opening-approval-items";
import { approvalIsCritical } from "@/features/approvals/utils/approval-list-utils";
import {
  ApprovalBudgetContext,
  ApprovalWorkbenchRow,
} from "@/features/finance-dashboard/components/rows/approval-rows";
import { DashboardTabEmpty } from "@/features/finance-dashboard/components/shared/dashboard-row-primitives";
import {
  formatShortDate,
  shortMoney,
} from "@/features/finance-dashboard/utils/dashboard-formatters";
import type { ApprovalDetail } from "@/lib/finance/approval-types";
import { approvalIsWaitingLong, type ApprovalQueueSummary } from "@/lib/finance/approval-summary";
import { getErrorMessage } from "@/lib/utils/error-message";

type ApprovalDecision = {
  readonly item: ApprovalDetail;
  readonly status: "APPROVED" | "REJECTED";
};

type ApprovalsTabProps = {
  readonly approvals: readonly ApprovalDetail[];
  readonly approvalSummary: ApprovalQueueSummary;
  readonly setApprovals: React.Dispatch<React.SetStateAction<readonly ApprovalDetail[]>>;
  readonly setApprovalSummary: React.Dispatch<React.SetStateAction<ApprovalQueueSummary>>;
  readonly canEmergencyOverride?: boolean;
};

export function ApprovalsTab({
  approvals,
  approvalSummary,
  setApprovals,
  setApprovalSummary,
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
        setApprovalSummary((current) => ({
          totalCount: Math.max(0, current.totalCount - 1),
          criticalCount: Math.max(0, current.criticalCount - Number(approvalIsCritical(item))),
          waitingLongCount: Math.max(
            0,
            current.waitingLongCount - Number(approvalIsWaitingLong(item, new Date())),
          ),
          totalAmount: Math.max(0, current.totalAmount - item.amount),
        }));
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
    <div className="space-y-sm">
      <SummarySurface
        ariaLabel="Antrean keputusan"
        eyebrow="Antrean keputusan"
        icon="approval"
        status={approvalSummary.totalCount > 0 ? "Perlu ditinjau" : "Selesai"}
        statusTone={approvalSummary.totalCount > 0 ? "warning" : "positive"}
      >
        <div className="flex items-end justify-between gap-4 px-3.5 pt-3.5 pb-2">
          <div className="min-w-0">
            <p className="font-mono text-[36px] leading-none font-black text-on-surface max-[430px]:text-[32px]">
              {approvalSummary.totalCount}
            </p>
            <p className="text-meta font-semibold text-on-surface-variant">
              persetujuan menunggu keputusan
            </p>
          </div>
          <div className="min-w-0 shrink-0 text-right">
            <p className="text-[9px] font-semibold text-on-surface-variant/60">Total antrean</p>
            <MoneyValue
              amount={approvalSummary.totalAmount}
              variant="compactWithFull"
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

      <DetailSection title="Urutan prioritas" href="/approvals" actionLabel="Buka semua">
        {approvals.length === 0 ? (
          <DashboardTabEmpty>
            Tidak ada persetujuan tertunda. Semua keputusan saat ini sudah ditangani.
          </DashboardTabEmpty>
        ) : (
          <>
            <div className="mx-3 mt-3 rounded-[15px] bg-surface-container-low/65 px-3 py-2 text-meta text-on-surface-variant">
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

      <BottomSheet
        open={approvalOpen}
        title="Tinjau Persetujuan"
        onClose={() => setSelectedApproval(null)}
        onExitComplete={handleApprovalExitComplete}
        footer={
          presentedApproval ? (
            <SheetFooterActions
              secondary={{
                label: "Tolak",
                disabled: pending,
                onClick: () => requestDecision(presentedApproval, "REJECTED"),
              }}
              primary={{
                label: "Setujui",
                disabled: pending,
                onClick: () => requestDecision(presentedApproval, "APPROVED"),
              }}
            />
          ) : undefined
        }
      >
        {presentedApproval ? (
          <div className="space-y-md">
            <section className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
              <div className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge
                    tone={
                      presentedApproval.priority === "CRITICAL"
                        ? "critical"
                        : presentedApproval.priority === "WARNING"
                          ? "warning"
                          : "pending"
                    }
                    label={presentedApproval.priorityReason}
                  />
                  <span className="shrink-0 text-[10px] font-semibold text-on-surface-variant">
                    {formatShortDate(presentedApproval.createdAt)}
                  </span>
                </div>
                <p className="mt-4 text-[9px] font-bold tracking-[0.12em] text-on-surface-variant/65 uppercase">
                  Nominal pengajuan
                </p>
                <MoneyValue
                  amount={presentedApproval.amount}
                  variant="fullDynamic"
                  size="hero"
                  className="mt-1"
                />
                <p className="mt-3 text-sm leading-[1.3] font-semibold text-on-surface">
                  {presentedApproval.description}
                </p>
              </div>
              {presentedApproval.notes ? (
                <div className="border-t border-outline-variant/20 bg-surface-container-lowest px-4 py-3">
                  <p className="text-[9px] leading-5 font-bold tracking-widest text-on-surface-variant/65 uppercase">
                    Catatan pengajuan
                  </p>
                  <p className="text-xs leading-4 text-on-surface-variant">
                    {presentedApproval.notes}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
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

            {presentedApproval.type === "inventory_opening" ? (
              <>
                <InventoryOpeningApprovalItems item={presentedApproval} />
                <section className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-surface ring-1 ring-ring-subtle">
                  <div className="px-4 py-3.5">
                    <p className="text-[10px] font-bold tracking-widest text-on-surface-variant/65 uppercase">
                      Dampak stok
                    </p>
                    <p className="mt-1 text-xs leading-5 text-on-surface">
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
                <h3 className="px-1 text-[10px] font-bold tracking-[0.11em] text-on-surface uppercase">
                  Bukti pengajuan
                </h3>
                <div className="overflow-hidden rounded-3xl bg-surface-container-lowest p-3 shadow-surface ring-1 ring-ring-subtle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={presentedApproval.receiptImageUrl}
                    alt="Bukti pengajuan"
                    className="max-h-70 w-full rounded-2xl bg-surface-container-low object-contain"
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
          <div className="rounded-[20px] bg-error-container/25 p-4 text-xs leading-5 text-error">
            Pengajuan tidak akan dilanjutkan. Jelaskan alasan yang dapat ditindaklanjuti oleh
            pengaju.
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
                rejectionReason.length > 0 &&
                rejectionReason.trim().length <
                  (decision?.item.type === "inventory_opening" ? 10 : 5)
              }
            />
            <p className="mt-1 px-1 text-[10px] text-on-surface-variant">
              Minimal {decision?.item.type === "inventory_opening" ? 10 : 5} karakter.
            </p>
          </div>
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
        </div>
      </BottomSheet>
    </div>
  );
}
