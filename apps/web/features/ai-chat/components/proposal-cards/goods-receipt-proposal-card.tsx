"use client";

import { confirmAiGoodsReceiptProposal } from "@/app/actions/ai/confirm-material-proposal";
import { MoneyValue } from "@/components/ui";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ProposalCardShell, ProposalDiffRow, ProposalItemRow } from "./proposal-card-shell";

export type GoodsReceiptProposalData = {
  readonly kind: "POST_GOODS_RECEIPT";
  readonly projectId: string;
  readonly projectName: string;
  readonly materialId: string;
  readonly materialName: string;
  readonly materialCode: string;
  readonly unit: string;
  readonly quantity: number;
  readonly unitCost: { readonly amount: number; readonly formatted: string };
  readonly totalValue: { readonly amount: number; readonly formatted: string };
  readonly inventoryLocationId: string;
  readonly locationName: string;
  readonly stockOnHandBefore: number;
  readonly stockOnHandAfter: number;
  readonly averageCostBefore: { readonly amount: number; readonly formatted: string };
  readonly averageCostAfter: { readonly amount: number; readonly formatted: string };
  readonly receiptNumber: string;
  readonly receivedAt: string;
  readonly vendorBillId: string | null;
  readonly projectRapItemId: string | null;
  readonly rapItemName: string | null;
  readonly note: string;
};

type GoodsReceiptProposalCardProps = {
  readonly proposal: GoodsReceiptProposalData;
  readonly toolCallId: string;
  readonly conversationId: string | null;
  readonly alreadyConfirmed: boolean;
  readonly onNavigate?: () => void;
};

export function GoodsReceiptProposalCard({
  proposal,
  toolCallId,
  conversationId,
  alreadyConfirmed,
  onNavigate,
}: GoodsReceiptProposalCardProps): React.JSX.Element {
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
    const result = await confirmAiGoodsReceiptProposal({
      toolCallId,
      conversationId,
      projectId: proposal.projectId,
      inventoryLocationId: proposal.inventoryLocationId,
      receiptNumber: proposal.receiptNumber,
      receivedAt: proposal.receivedAt,
      vendorBillId: proposal.vendorBillId || undefined,
      note: proposal.note || undefined,
      items: [
        {
          materialId: proposal.materialId,
          quantity: proposal.quantity,
          unitCost: proposal.unitCost.amount,
          projectRapItemId: proposal.projectRapItemId || undefined,
          note: proposal.note,
        },
      ],
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
      eyebrow="Penerimaan Barang (Goods Receipt)"
      title={`${proposal.materialName} (${proposal.quantity} ${proposal.unit})`}
      status={status}
      errorMessage={errorMessage}
      isAlreadyConfirmed={alreadyConfirmed}
      confirmLabel="Catat Penerimaan Barang"
      submittedMessage="Barang masuk (Stock In) berhasil dicatat ke inventori gudang."
      onConfirm={handleConfirm}
      viewActionLabel="Lihat Stok Material"
      onViewAction={() => {
        onNavigate?.();
        router.push("/materials");
      }}
    >
      <dl className="divide-y divide-black/5.5">
        <ProposalItemRow label="Proyek" value={proposal.projectName} />
        <ProposalItemRow label="Lokasi Gudang" value={proposal.locationName} />
        <ProposalItemRow
          label="Harga Satuan"
          value={`${proposal.unitCost.formatted} / ${proposal.unit}`}
        />
        <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
          <dt className="text-support font-semibold text-on-surface-variant">Total Nilai</dt>
          <dd className="min-w-0">
            <MoneyValue
              amount={proposal.totalValue.amount}
              variant="compact"
              size="lg"
              align="right"
            />
          </dd>
        </div>
      </dl>

      <div className="border-t border-black/5.5 bg-surface-container-low/40">
        <div className="px-4 pt-2.5 pb-1 text-eyebrow font-bold tracking-wider text-on-surface-variant uppercase">
          Dampak Stok Fisik Gudang
        </div>
        <ProposalDiffRow
          label="Stok Tersedia"
          before={`${proposal.stockOnHandBefore} ${proposal.unit}`}
          after={`${proposal.stockOnHandAfter} ${proposal.unit}`}
          tone="positive"
        />
        <ProposalDiffRow
          label="Harga Rata-rata"
          before={proposal.averageCostBefore.formatted}
          after={proposal.averageCostAfter.formatted}
          tone="neutral"
        />
      </div>
    </ProposalCardShell>
  );
}
