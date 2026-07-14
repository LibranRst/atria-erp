"use client";

import React from "react";
import { motion } from "framer-motion";

import { ConfirmationModal, FormField, Textarea } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";

export function BudgetDraftActions({
  hasItems,
  isPending,
  onSubmitBudget,
}: {
  readonly hasItems: boolean;
  readonly isPending: boolean;
  readonly onSubmitBudget: () => void;
}): React.JSX.Element | null {
  const [confirmSubmit, setConfirmSubmit] = React.useState(false);
  if (!hasItems) return null;

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        transition={transitionSpringSnappy}
        onClick={() => setConfirmSubmit(true)}
        disabled={isPending}
        className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-secondary px-5 text-xs font-bold text-on-secondary shadow-lg disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[18px]">publish</span>
        <span>Tinjau & Ajukan Project Budget</span>
      </motion.button>
      <ConfirmationModal
        open={confirmSubmit}
        title="Ajukan Project Budget?"
        description="Item tidak dapat ditambah selama menunggu persetujuan. Owner akan meninjau plafon dan alokasi sebelum budget aktif."
        tone="warning"
        onClose={() => setConfirmSubmit(false)}
        actions={(
          <div className="grid grid-cols-2 gap-2">
            <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setConfirmSubmit(false)} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold">Kembali</motion.button>
            <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={isPending} onClick={() => { setConfirmSubmit(false); onSubmitBudget(); }} className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white disabled:opacity-40">Ajukan Budget</motion.button>
          </div>
        )}
      />
    </>
  );
}

export function BudgetApprovalPanel({
  showRejectForm,
  setShowRejectForm,
  rejectionNotes,
  setRejectionNotes,
  isPending,
  onApproveBudget,
  onRejectBudgetSubmit,
}: {
  readonly showRejectForm: boolean;
  readonly setShowRejectForm: (show: boolean) => void;
  readonly rejectionNotes: string;
  readonly setRejectionNotes: (notes: string) => void;
  readonly isPending: boolean;
  readonly onApproveBudget: () => void;
  readonly onRejectBudgetSubmit: (event: React.FormEvent) => void;
}): React.JSX.Element {
  const [confirmApprove, setConfirmApprove] = React.useState(false);
  return (
    <div className="space-y-sm border-t border-outline-variant/10 pt-md">
        <div className="flex gap-md">
          <button
            type="button"
            onClick={() => setShowRejectForm(true)}
            disabled={isPending}
            className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-error text-xs font-bold text-error transition active:scale-[0.98] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
            <span>Tolak Budget</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmApprove(true)}
            disabled={isPending}
            className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">done</span>
            <span>Setujui Project Budget</span>
          </button>
        </div>
      <ConfirmationModal
        open={confirmApprove}
        title="Setujui Project Budget?"
        description="Plafon kategori menjadi baseline aktif untuk pengeluaran, kontrol budget, dan pelaporan project."
        onClose={() => setConfirmApprove(false)}
        actions={(
          <div className="grid grid-cols-2 gap-2">
            <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setConfirmApprove(false)} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold">Batal</motion.button>
            <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={isPending} onClick={() => { setConfirmApprove(false); onApproveBudget(); }} className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white disabled:opacity-40">Setujui Budget</motion.button>
          </div>
        )}
      />
      <ConfirmationModal
        open={showRejectForm}
        title="Tolak dan minta revisi?"
        description="Project Budget kembali editable. Jelaskan bagian yang harus diperbaiki agar PM dapat menindaklanjuti."
        tone="danger"
        onClose={() => setShowRejectForm(false)}
        actions={(
          <form onSubmit={onRejectBudgetSubmit} className="space-y-3">
            <FormField label="Alasan revisi" required>
              <Textarea autoFocus value={rejectionNotes} onChange={setRejectionNotes} placeholder="Contoh: Alokasi Material perlu disesuaikan dengan RAP terbaru" rows={3} disabled={isPending} />
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setShowRejectForm(false)} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold">Batal</motion.button>
              <motion.button type="submit" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={isPending || rejectionNotes.trim().length < 3} className="min-h-12 rounded-full bg-error px-4 text-xs font-bold text-white disabled:opacity-40">{isPending ? "Mengirim…" : "Tolak Budget"}</motion.button>
            </div>
          </form>
        )}
      />
    </div>
  );
}
