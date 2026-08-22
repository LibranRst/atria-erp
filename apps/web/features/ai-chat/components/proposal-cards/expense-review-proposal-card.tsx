"use client";

import { confirmAiExpenseReviewProposal } from "@/app/actions/ai/confirm-expense-proposal";
import { MoneyValue } from "@/components/ui";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ProposalCardShell, ProposalItemRow } from "./proposal-card-shell";

export type ExpenseReviewProposalData = {
  readonly kind: "EXPENSE_REVIEW";
  readonly expenseId: string;
  readonly action: "APPROVE" | "REJECT" | "VERIFY";
  readonly actionLabel: string;
  readonly description: string;
  readonly amount: { readonly amount: number; readonly formatted: string };
  readonly projectName: string;
  readonly requesterName: string;
  readonly notes: string;
};

type ExpenseReviewProposalCardProps = {
  readonly proposal: ExpenseReviewProposalData;
  readonly toolCallId: string;
  readonly conversationId: string | null;
  readonly alreadyConfirmed: boolean;
  readonly onNavigate?: () => void;
};

export function ExpenseReviewProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
  onNavigate,
}: ExpenseReviewProposalCardProps): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = React.useState<"idle" | "submitting" | "submitted" | "failed">(
    alreadyConfirmed ? "submitted" : "idle",
  );
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  async function handleConfirm(): Promise<void> {
    if (!conversationId) {
      setStatus("failed");
      setErrorMessage("Sesi percakapan belum siap. Silakan coba lagi.");
      return;
    }

    setStatus("submitting");
    const result = await confirmAiExpenseReviewProposal({
      toolCallId,
      conversationId,
      expenseId: proposal.expenseId,
      action: proposal.action,
      notes: proposal.notes,
    });

    if (result.success) {
      setStatus("submitted");
      return;
    }

    setStatus("failed");
    setErrorMessage(result.error.message);
  }

  const isVerify = proposal.action === "VERIFY";
  const isApprove = proposal.action === "APPROVE";

  const eyebrow = isVerify
    ? "Verifikasi Pengeluaran Lapangan"
    : `Persetujuan Biaya (${isApprove ? "Approve" : "Reject"})`;

  const submittedMessage = isVerify
    ? "Pengajuan biaya berhasil diverifikasi."
    : isApprove
      ? "Pengajuan biaya berhasil disetujui."
      : "Pengajuan biaya berhasil ditolak.";

  return (
    <ProposalCardShell
      eyebrow={eyebrow}
      title={proposal.description}
      status={status}
      errorMessage={errorMessage}
      isAlreadyConfirmed={alreadyConfirmed}
      confirmLabel={proposal.actionLabel}
      submittedMessage={submittedMessage}
      onConfirm={handleConfirm}
      viewActionLabel="Lihat Daftar Pengeluaran"
      onViewAction={() => {
        onNavigate?.();
        router.push("/expenses");
      }}
    >
      <dl className="divide-y divide-black/5.5">
        <ProposalItemRow label="Proyek" value={proposal.projectName} />
        <ProposalItemRow label="Diajukan Oleh" value={proposal.requesterName} />
        <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
          <dt className="text-support font-semibold text-on-surface-variant">Nominal</dt>
          <dd className="min-w-0">
            <MoneyValue amount={proposal.amount.amount} variant="compact" size="lg" align="right" />
          </dd>
        </div>
        <ProposalItemRow label="Catatan Keputusan" value={proposal.notes} />
      </dl>
    </ProposalCardShell>
  );
}
