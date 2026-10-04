"use client";

import { confirmAiPayVendorBillProposal } from "@/app/actions/ai/confirm-finance-proposal";
import { MoneyValue } from "@/components/ui";
import { useRouter } from "@/lib/navigation/workspace-navigation";

import * as React from "react";
import { ProposalCardShell, ProposalDiffRow, ProposalItemRow } from "./proposal-card-shell";

export type VendorPaymentProposalData = {
  readonly kind: "PAY_VENDOR_BILL";
  readonly vendorPaymentId: string;
  readonly vendorBillId: string;
  readonly billNumber: string;
  readonly vendorName: string;
  readonly projectName: string;
  readonly amountPaid: { readonly amount: number; readonly formatted: string };
  readonly bankAccountId: string;
  readonly bankAccountName: string;
  readonly bankBalanceBefore: { readonly amount: number; readonly formatted: string };
  readonly bankBalanceAfter: { readonly amount: number; readonly formatted: string };
  readonly insufficientFunds: boolean;
  readonly referenceNumber: string;
  readonly billTotalAmount: { readonly amount: number; readonly formatted: string };
  readonly budgetCategoryRemaining: { readonly amount: number; readonly formatted: string } | null;
};

type VendorPaymentProposalCardProps = {
  readonly proposal: VendorPaymentProposalData;
  readonly toolCallId: string;
  readonly conversationId: string | null;
  readonly alreadyConfirmed: boolean;
  readonly onNavigate?: () => void;
};

export function VendorPaymentProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
  onNavigate,
}: VendorPaymentProposalCardProps): React.JSX.Element {
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
    const result = await confirmAiPayVendorBillProposal({
      toolCallId,
      conversationId,
      vendorPaymentId: proposal.vendorPaymentId,
      bankAccountId: proposal.bankAccountId,
      referenceNumber: proposal.referenceNumber,
      amountPaid: proposal.amountPaid.amount,
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
      eyebrow="Usulan Pembayaran Tagihan Vendor"
      title={`Bill #${proposal.billNumber} - ${proposal.vendorName}`}
      status={status}
      errorMessage={errorMessage}
      isAlreadyConfirmed={alreadyConfirmed}
      warningMessage={
        proposal.insufficientFunds
          ? "Saldo rekening bank tidak mencukupi untuk pembayaran ini."
          : null
      }
      confirmLabel="Bayar Tagihan Vendor"
      submittedMessage="Pembayaran tagihan vendor berhasil dicatat dan saldo kas dipotong."
      onConfirm={handleConfirm}
      viewActionLabel="Lihat di Ledger"
      onViewAction={() => {
        onNavigate?.();
        router.push("/ledger");
      }}
    >
      <dl className="divide-y divide-black/5.5">
        <ProposalItemRow label="Proyek" value={proposal.projectName} />
        <ProposalItemRow label="Rekening Sumber" value={proposal.bankAccountName} />
        <ProposalItemRow label="Nomor Referensi" value={proposal.referenceNumber} />
        <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
          <dt className="text-support font-semibold text-on-surface-variant">Nominal Bayar</dt>
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
