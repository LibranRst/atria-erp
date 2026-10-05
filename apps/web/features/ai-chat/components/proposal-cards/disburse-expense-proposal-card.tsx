"use client";

import { confirmAiDisburseExpenseProposal } from "@/app/actions/ai/confirm-expense-proposal";
import { MoneyValue } from "@/components/ui";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import * as React from "react";
import { ProposalCardShell, ProposalDiffRow, ProposalItemRow } from "./proposal-card-shell";

export type DisburseExpenseProposalData = {
  readonly kind: "DISBURSE_EXPENSE";
  readonly expenseId: string;
  readonly description: string;
  readonly projectName: string;
  readonly requesterName: string;
  readonly amount: { readonly amount: number; readonly formatted: string };
  readonly bankAccountId: string;
  readonly bankAccountName: string;
  readonly bankBalanceBefore: { readonly amount: number; readonly formatted: string };
  readonly bankBalanceAfter: { readonly amount: number; readonly formatted: string };
  readonly insufficientFunds: boolean;
  readonly referenceNumber: string;
};

type DisburseExpenseProposalCardProps = {
  readonly proposal: DisburseExpenseProposalData;
  readonly toolCallId: string;
  readonly conversationId: string | null;
  readonly alreadyConfirmed: boolean;
  readonly onNavigate?: () => void;
};

export function DisburseExpenseProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
  onNavigate,
}: DisburseExpenseProposalCardProps): React.JSX.Element {
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
    const result = await confirmAiDisburseExpenseProposal({
      toolCallId,
      conversationId,
      expenseId: proposal.expenseId,
      bankAccountId: proposal.bankAccountId,
      referenceNumber: proposal.referenceNumber,
    });

    if (result.success) {
      setStatus("submitted");
      return;
    }

    setStatus("failed");
    setErrorMessage(result.error.message);
  }

  return (
    <ProposalCardShell
      eyebrow="Pencairan Dana Biaya Lapangan"
      title={proposal.description}
      status={status}
      errorMessage={errorMessage}
      isAlreadyConfirmed={alreadyConfirmed}
      warningMessage={
        proposal.insufficientFunds
          ? "Saldo rekening bank tidak mencukupi untuk pencairan dana ini."
          : null
      }
      confirmLabel="Cairkan Dana Lapangan"
      submittedMessage="Dana pengeluaran lapangan berhasil dicairkan dan saldo bank dipotong."
      onConfirm={handleConfirm}
      viewActionLabel="Lihat di Ledger"
      onViewAction={() => {
        onNavigate?.();
        router.push("/ledger");
      }}
    >
      <dl className="divide-y divide-black/5.5">
        <ProposalItemRow label="Proyek" value={proposal.projectName} />
        <ProposalItemRow label="Penerima / Pemohon" value={proposal.requesterName} />
        <ProposalItemRow label="Rekening Sumber" value={proposal.bankAccountName} />
        <ProposalItemRow label="Nomor Referensi" value={proposal.referenceNumber} />
        <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
          <dt className="text-support font-semibold text-on-surface-variant">Nominal Pencairan</dt>
          <dd className="min-w-0">
            <MoneyValue amount={proposal.amount.amount} variant="compact" size="lg" align="right" />
          </dd>
        </div>
      </dl>

      <div className="border-t border-black/5.5 bg-surface-container-low/40">
        <div className="px-4 pt-2.5 pb-1 text-eyebrow font-bold tracking-wider text-on-surface-variant uppercase">
          Dampak Saldo Kas Bank
        </div>
        <ProposalDiffRow
          label="Saldo Rekening"
          before={proposal.bankBalanceBefore.formatted}
          after={proposal.bankBalanceAfter.formatted}
          tone={proposal.insufficientFunds ? "negative" : "neutral"}
        />
      </div>
    </ProposalCardShell>
  );
}
