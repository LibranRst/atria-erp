"use client";

import { confirmAiRecordClientPaymentProposal } from "@/app/actions/ai/confirm-finance-proposal";
import { MoneyValue } from "@/components/ui";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import * as React from "react";
import { ProposalCardShell, ProposalDiffRow, ProposalItemRow } from "./proposal-card-shell";

export type ClientPaymentProposalData = {
  readonly kind: "RECORD_CLIENT_PAYMENT";
  readonly clientInvoiceId: string;
  readonly invoiceNumber: string;
  readonly projectName: string;
  readonly clientName: string;
  readonly amountPaid: { readonly amount: number; readonly formatted: string };
  readonly paymentDate: string;
  readonly bankAccountId: string;
  readonly bankAccountName: string;
  readonly bankBalanceBefore: { readonly amount: number; readonly formatted: string };
  readonly bankBalanceAfter: { readonly amount: number; readonly formatted: string };
  readonly invoiceOutstandingBefore: { readonly amount: number; readonly formatted: string };
  readonly invoiceOutstandingAfter: { readonly amount: number; readonly formatted: string };
  readonly willBePaid: boolean;
  readonly referenceNumber: string;
};

type ClientPaymentProposalCardProps = {
  readonly proposal: ClientPaymentProposalData;
  readonly toolCallId: string;
  readonly conversationId: string | null;
  readonly alreadyConfirmed: boolean;
  readonly onNavigate?: () => void;
};

export function ClientPaymentProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
  onNavigate,
}: ClientPaymentProposalCardProps): React.JSX.Element {
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
    const result = await confirmAiRecordClientPaymentProposal({
      toolCallId,
      conversationId,
      clientInvoiceId: proposal.clientInvoiceId,
      bankAccountId: proposal.bankAccountId,
      amountPaid: proposal.amountPaid.amount,
      paymentDate: proposal.paymentDate,
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
      eyebrow="Penerimaan Termin Klien"
      title={`Invoice #${proposal.invoiceNumber} - ${proposal.clientName}`}
      status={status}
      errorMessage={errorMessage}
      isAlreadyConfirmed={alreadyConfirmed}
      confirmLabel="Catat Penerimaan Dana"
      submittedMessage="Penerimaan dana klien berhasil dicatat dan saldo kas rekening bertambah."
      onConfirm={handleConfirm}
      viewActionLabel="Lihat Mutasi Kas"
      onViewAction={() => {
        onNavigate?.();
        router.push("/ledger");
      }}
    >
      <dl className="divide-y divide-black/5.5">
        <ProposalItemRow label="Proyek" value={proposal.projectName} />
        <ProposalItemRow label="Rekening Tujuan" value={proposal.bankAccountName} />
        <ProposalItemRow label="Nomor Referensi" value={proposal.referenceNumber} />
        <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
          <dt className="text-support font-semibold text-on-surface-variant">Dana Diterima</dt>
          <dd className="min-w-0">
            <MoneyValue
              amount={proposal.amountPaid.amount}
              variant="compact"
              size="lg"
              align="right"
            />
          </dd>
        </div>
      </dl>

      <div className="border-t border-black/5.5 bg-surface-container-low/40">
        <div className="px-4 pt-2.5 pb-1 text-eyebrow font-bold tracking-wider text-on-surface-variant uppercase">
          Dampak Finansial
        </div>
        <ProposalDiffRow
          label="Saldo Rekening"
          before={proposal.bankBalanceBefore.formatted}
          after={proposal.bankBalanceAfter.formatted}
          tone="positive"
        />
        <ProposalDiffRow
          label="Sisa Piutang"
          before={proposal.invoiceOutstandingBefore.formatted}
          after={proposal.invoiceOutstandingAfter.formatted}
          tone="neutral"
        />
      </div>
    </ProposalCardShell>
  );
}
