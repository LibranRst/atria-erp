"use client";

import { motion } from "framer-motion";
import {
  ConfirmationDialog,
  FinanceUnsavedChangesModal,
  type OperationSuccess,
  OperationSuccessDialog,
} from "@/components/ui";
import type { ExpenseReceiptOcrResult } from "@/features/expenses/utils/expense-receipt-ocr";
import { transitionSpringSnappy } from "@/lib/utils/motion";

interface ExpenseFormOverlaysProps {
  readonly closeGuardOpen: boolean;
  readonly closeGuardPending: boolean;
  readonly conflictOpen: boolean;
  readonly pendingOcr: ExpenseReceiptOcrResult | null;
  readonly projectChange: string | null;
  readonly pendingDiscardDraftId: string | null;
  readonly success: OperationSuccess | null;
  readonly onKeepDraft: () => void;
  readonly onDiscardDraft: () => void;
  readonly onContinueEditing: () => void;
  readonly onCloseConflict: () => void;
  readonly onSaveConflictCopy: () => void;
  readonly onLoadServerVersion: () => void;
  readonly onCloseOcr: () => void;
  readonly onAppendOcr: () => void;
  readonly onReplaceOcr: () => void;
  readonly onCloseProjectChange: () => void;
  readonly onConfirmProjectChange: () => void;
  readonly onCloseDiscardDraft: () => void;
  readonly onConfirmDiscardDraft: () => void;
  readonly onCloseSuccess: () => void;
  readonly onAddAnotherExpense: () => void;
}

export function ExpenseFormOverlays({
  closeGuardOpen,
  closeGuardPending,
  conflictOpen,
  pendingOcr,
  projectChange,
  pendingDiscardDraftId,
  success,
  onKeepDraft,
  onDiscardDraft,
  onContinueEditing,
  onCloseConflict,
  onSaveConflictCopy,
  onLoadServerVersion,
  onCloseOcr,
  onAppendOcr,
  onReplaceOcr,
  onCloseProjectChange,
  onConfirmProjectChange,
  onCloseDiscardDraft,
  onConfirmDiscardDraft,
  onCloseSuccess,
  onAddAnotherExpense,
}: ExpenseFormOverlaysProps): React.JSX.Element {
  return (
    <>
      <FinanceUnsavedChangesModal
        open={closeGuardOpen}
        pending={closeGuardPending}
        onKeep={onKeepDraft}
        onDiscard={onDiscardDraft}
        onContinue={onContinueEditing}
      />

      <ConfirmationDialog
        open={conflictOpen}
        title="Draft Berubah"
        description="Draft ini diperbarui dari sesi lain. Muat versi server atau pertahankan isian lokal sebagai draft terpisah."
        tone="warning"
        onClose={onCloseConflict}
        actions={
          <div className="space-y-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={onSaveConflictCopy}
              className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-white"
            >
              Simpan sebagai Draft Baru
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={onLoadServerVersion}
              className="min-h-12 w-full rounded-full bg-surface-container px-5 text-xs font-bold text-on-surface"
            >
              Muat Versi Server
            </motion.button>
          </div>
        }
      />

      <ConfirmationDialog
        open={pendingOcr !== null}
        title="Gabungkan Hasil Scan"
        description={`${pendingOcr?.lines.length ?? 0} item terdeteksi. Item yang sudah Anda isi tidak akan diubah tanpa pilihan eksplisit.`}
        onClose={onCloseOcr}
        actions={
          <div className="space-y-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={onAppendOcr}
              className="min-h-12 w-full rounded-full bg-primary px-5 text-xs font-bold text-white"
            >
              Tambahkan Hasil Scan
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={onReplaceOcr}
              className="min-h-12 w-full rounded-full bg-surface-container px-5 text-xs font-bold text-on-surface"
            >
              Ganti Item Saat Ini
            </motion.button>
          </div>
        }
      />

      <ConfirmationDialog
        open={projectChange !== null}
        title="Ganti proyek?"
        description="Kategori, tautan RAP, material, paket, dan lokasi stok akan dikosongkan. Nominal dan keterangan tetap aman."
        confirmLabel="Ganti Proyek"
        danger
        onClose={onCloseProjectChange}
        onConfirm={onConfirmProjectChange}
      />

      <ConfirmationDialog
        open={Boolean(pendingDiscardDraftId)}
        title="Buang draft pengeluaran?"
        description="Draft ini akan dihapus dan tidak dapat dilanjutkan lagi. Belum ada transaksi atau saldo kas yang berubah."
        confirmLabel="Buang Draft"
        danger
        onClose={onCloseDiscardDraft}
        onConfirm={onConfirmDiscardDraft}
      />

      <OperationSuccessDialog
        success={success}
        secondaryLabel="Tambah Pengeluaran"
        onClose={onCloseSuccess}
        onSecondary={onAddAnotherExpense}
      />
    </>
  );
}
