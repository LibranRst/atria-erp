"use client";
import * as React from "react";
import { ButtonLink, ConfirmationDialog, FactRow, SheetFooterActions } from "@/components/ui";
import { useCan } from "@/components/auth/permissions-provider";
import {
  getAiVendorPaymentWorkflowProposal,
  confirmAiVendorPaymentWorkflowProposal,
} from "@/app/actions/ai/vendor-payment-workflow";
import {
  vendorPaymentWorkflowPermission,
  type VendorPaymentWorkflowProposal,
  type VendorPaymentWorkflowView,
} from "@atria/core/ai/vendor-payment-workflow";
import { ProposalCardShell } from "./proposal-card-shell";
import { ProposalInlineReview, inlineProposalValue } from "./proposal-inline-review";
import { ProposalReviewFeedback } from "./proposal-review-feedback";
/** Inherited Atria Operate: each vendor stage is a complete inline decision; only its explicit confirmation writes.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
 */
export function VendorPaymentWorkflowCard({
  proposal: initial,
  conversationId,
  toolCallId,
  isStreaming,
  isBusy,
  alreadyConfirmed,
  onFollowUp,
}: {
  readonly proposal: VendorPaymentWorkflowProposal;
  readonly conversationId: string | null;
  readonly toolCallId: string;
  readonly isStreaming: boolean;
  readonly isBusy: boolean;
  readonly alreadyConfirmed: boolean;
  readonly onFollowUp: (text: string) => void;
}): React.JSX.Element {
  const can = useCan();
  const [view, setView] = React.useState<VendorPaymentWorkflowView | null>(null),
    [decision, setDecision] = React.useState(false),
    [error, setError] = React.useState(""),
    [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const epoch = React.useRef(0),
    inFlight = React.useRef(false);
  const proposal = view?.proposal ?? initial,
    input = proposal.input;
  const confirmed = alreadyConfirmed || status === "submitted" || view?.status === "CONFIRMED",
    pending = isBusy || status === "submitting",
    stale = view?.status === "STALE" || view?.status === "EXPIRED";
  const permitted =
    can("use:ai_chat") &&
    can("view:vendor_bill") &&
    can("view:project") &&
    can(vendorPaymentWorkflowPermission(input)) &&
    (!["SCHEDULE", "PAY"].includes(input.action) || can("view:bank_account"));
  const ready = view?.status === "READY" && permitted && !confirmed && !isStreaming && !error;
  const actions = {
    SCHEDULE: "Simpan jadwal pembayaran",
    APPROVE: "Setujui jadwal pembayaran",
    REJECT: "Tolak jadwal pembayaran",
    PAY: "Catat pembayaran vendor",
  };
  const saved = {
    SCHEDULE: "Jadwal tersimpan. Periksa status persetujuan sebelum mencatat pembayaran.",
    APPROVE: "Jadwal disetujui. Pembayaran dilakukan melalui tindakan terpisah.",
    REJECT: "Jadwal ditolak. Nominal dapat dijadwalkan kembali setelah koreksi.",
    PAY: "Pembayaran tercatat dan saldo rekening diperbarui.",
  };
  const refresh = React.useCallback((): Promise<void> => {
    if (!conversationId || isStreaming || inFlight.current) return Promise.resolve();
    const request = ++epoch.current;
    return getAiVendorPaymentWorkflowProposal({ conversationId, toolCallId })
      .then((result) => {
        if (request !== epoch.current) return;
        if (result.success) {
          setView(result.data);
          setError("");
        } else setError(result.error.message);
      })
      .catch(() => {
        if (request === epoch.current) setError("Usulan belum dapat diperiksa. Coba periksa lagi.");
      });
  }, [conversationId, toolCallId, isStreaming]);
  React.useEffect(() => {
    void refresh();
    const request = epoch;
    return () => {
      request.current++;
    };
  }, [refresh]);
  async function save(): Promise<void> {
    if (!conversationId || !ready || pending || inFlight.current) return;
    inFlight.current = true;
    epoch.current++;
    setStatus("submitting");
    setError("");
    try {
      const result = await confirmAiVendorPaymentWorkflowProposal({ conversationId, toolCallId });
      if (result.success) {
        setStatus("submitted");
        setDecision(false);
      } else {
        setError(result.error.message);
        setStatus("failed");
        setDecision(false);
      }
    } catch {
      setError("Hasil tindakan belum diketahui. Periksa lagi sebelum mengulang.");
      setStatus("failed");
      setDecision(false);
    } finally {
      inFlight.current = false;
    }
  }
  const details = proposal.facts.filter(
    (f) => f.label.startsWith("Alokasi ") || f.label === "Realisasi kategori",
  );
  const facts = proposal.facts.filter((f) => !details.includes(f));
  const feedback =
    error || stale ? (
      <ProposalReviewFeedback
        embedded
        message={
          error ||
          "Data berubah atau usulan kedaluwarsa. Minta preview terbaru sebelum melanjutkan."
        }
        recovery={
          error && !confirmed
            ? { label: "Periksa lagi", disabled: pending, onClick: () => void refresh() }
            : undefined
        }
      />
    ) : null;
  return (
    <>
      <ProposalCardShell
        title={proposal.title}
        status={error && !confirmed ? "failed" : status}
        statusLabel={
          confirmed
            ? "Tercatat"
            : stale
              ? "Data berubah"
              : error
                ? "Perlu diperiksa"
                : ready
                  ? "Usulan"
                  : "Memeriksa"
        }
        isAlreadyConfirmed={confirmed}
        showConfirmAction={false}
        onConfirm={save}
        footer={
          <div className="space-y-3">
            {confirmed ? (
              <ButtonLink
                href={`/projects/${proposal.projectId}?tab=budget`}
                fullWidth
                variant="secondary"
              >
                Lihat pembayaran vendor
              </ButtonLink>
            ) : (
              <SheetFooterActions
                layout="adaptive"
                primary={{
                  label: actions[input.action],
                  disabled: !ready || pending,
                  pending: status === "submitting",
                  pendingLabel: "Menyimpan…",
                  variant: input.action === "REJECT" ? "critical" : "primary",
                  onClick: () => (input.action === "SCHEDULE" ? void save() : setDecision(true)),
                }}
                secondary={{
                  label: stale ? "Minta preview terbaru" : "Koreksi lewat chat",
                  variant: "quiet",
                  disabled: pending,
                  onClick: () =>
                    onFollowUp(
                      `Periksa sumber terbaru lalu bantu ${stale ? "buat ulang preview" : "koreksi"} ${proposal.title} untuk ${proposal.entityName}. Tanyakan bagian yang ingin diubah; jangan simpan otomatis.`,
                    ),
                }}
              />
            )}
            <p role="status" className="text-meta text-on-surface-variant">
              {confirmed ? saved[input.action] : proposal.effect}
            </p>
          </div>
        }
      >
        <div className="px-4 py-3">
          <p className="text-row font-semibold">{proposal.entityName}</p>
        </div>
        <ProposalInlineReview
          facts={facts}
          comparisons={proposal.comparisons}
          details={
            details.length ? (
              <div className="divide-y divide-outline-variant/20">
                {details.map((f) => (
                  <FactRow
                    key={f.label}
                    label={f.label}
                    wrapLabel
                    value={inlineProposalValue(f.value, f.money)}
                  />
                ))}
              </div>
            ) : undefined
          }
        >
          {feedback}
        </ProposalInlineReview>
      </ProposalCardShell>
      <ConfirmationDialog
        actionLayout="adaptive"
        open={decision}
        title={actions[input.action]}
        description={proposal.effect}
        confirmLabel={actions[input.action]}
        tone={input.action === "REJECT" ? "danger" : "default"}
        pending={pending}
        disabled={!ready || pending}
        onClose={() => {
          if (!inFlight.current) setDecision(false);
        }}
        onConfirm={() => void save()}
      >
        <p className="mb-3 text-row font-semibold">{proposal.entityName}</p>
        <div className="divide-y divide-outline-variant/20">
          {facts.map((f) => (
            <FactRow
              key={f.label}
              label={f.label}
              wrapLabel
              value={inlineProposalValue(f.value, f.money)}
            />
          ))}
        </div>
      </ConfirmationDialog>
    </>
  );
}
