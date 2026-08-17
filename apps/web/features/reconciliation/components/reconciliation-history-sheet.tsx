"use client";

import type { ReconciliationWorkspace } from "@/app/actions/finance/reconciliation-workspace";
import { BottomSheet, FormSection, useSheetPresenceValue } from "@/components/ui";
import {
  directionCopy,
  EvidenceDescription,
  EvidenceMetaRow,
  formatReconciliationDate,
  SheetMoneySummary,
} from "./reconciliation-primitives";

interface ReconciliationHistorySheetProps {
  readonly selected: ReconciliationWorkspace["history"][number] | null;
  readonly onClose: () => void;
}

export function ReconciliationHistorySheet({
  selected,
  onClose,
}: ReconciliationHistorySheetProps): React.JSX.Element {
  const { presentedValue, handleExitComplete } = useSheetPresenceValue(selected, selected?.id);

  return (
    <BottomSheet
      open={selected !== null}
      title="Detail rekonsiliasi"
      onClose={onClose}
      onExitComplete={handleExitComplete}
    >
      {presentedValue ? (
        <div className="space-y-4">
          <SheetMoneySummary
            amount={presentedValue.amount}
            type={presentedValue.type}
            label="Sudah cocok"
            meta={`${formatReconciliationDate(presentedValue.reconciledAt)} · ${presentedValue.reconciledByName}`}
            confirmed
          />

          <FormSection title="Catatan Atria" helper="Transaksi yang tercatat di dalam Atria.">
            <EvidenceDescription
              icon="receipt_long"
              title={presentedValue.cashDescription}
              description={`${presentedValue.bankAccountName} · ${directionCopy(presentedValue.type)}`}
            />
            <EvidenceMetaRow
              label="Referensi bank"
              value={presentedValue.bankReference || "Tidak dicatat"}
            />
          </FormSection>

          <FormSection title="Mutasi bank" helper="Bukti pada rekening koran yang dipasangkan.">
            <EvidenceDescription
              icon="account_balance"
              title={presentedValue.statementDescription}
              description={`${formatReconciliationDate(presentedValue.transactionDate)} · ${presentedValue.bankAccountName}`}
            />
            <EvidenceMetaRow label="Sumber data" value={presentedValue.importFileName} />
          </FormSection>

          <p className="px-1 text-meta text-on-surface-variant">
            Nominal, arah dana, dan rekening pada kedua catatan telah diverifikasi sebagai satu
            transaksi.
          </p>
        </div>
      ) : null}
    </BottomSheet>
  );
}
