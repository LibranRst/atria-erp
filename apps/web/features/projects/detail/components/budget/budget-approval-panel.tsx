"use client";
import { AppIcon, ConfirmationDialog, FormField, Textarea, Button } from "@/components/ui";
import React from "react";

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
      <Button
        type="button"
        onClick={() => setConfirmSubmit(true)}
        disabled={isPending}
        className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-secondary px-5 text-xs font-bold text-on-secondary shadow-raised active:z-10 active:shadow-raised disabled:opacity-50"
        variant="secondary"
      >
        <AppIcon name="publish" className="icon-md" />
        <span>Tinjau & Ajukan Project Budget</span>
      </Button>
      <ConfirmationDialog
        open={confirmSubmit}
        title="Ajukan Project Budget?"
        description="Item tidak dapat ditambah selama menunggu persetujuan. Owner akan meninjau plafon dan alokasi sebelum budget aktif."
        tone="warning"
        onClose={() => setConfirmSubmit(false)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => setConfirmSubmit(false)}
              fullWidth
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold active:z-10 active:shadow-raised"
              variant="secondary"
            >
              Kembali
            </Button>
            <Button
              type="button"
              disabled={isPending}
              fullWidth
              onClick={() => {
                setConfirmSubmit(false);
                onSubmitBudget();
              }}
              className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white active:z-10 active:shadow-raised disabled:opacity-40"
              variant="primary"
            >
              Ajukan Budget
            </Button>
          </div>
        }
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
        <Button
          type="button"
          onClick={() => setShowRejectForm(true)}
          disabled={isPending}
          className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-error text-xs font-bold text-error active:z-10 active:shadow-raised disabled:opacity-50"
          variant="tertiary"
        >
          <AppIcon name="close" className="icon-md" />
          <span>Tolak Budget</span>
        </Button>

        <Button
          type="button"
          onClick={() => setConfirmApprove(true)}
          disabled={isPending}
          className="flex h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-bold text-white shadow-primary active:z-10 active:shadow-raised disabled:opacity-50"
          variant="primary"
        >
          <AppIcon name="done" className="icon-md" />
          <span>Setujui Project Budget</span>
        </Button>
      </div>
      <ConfirmationDialog
        open={confirmApprove}
        title="Setujui Project Budget?"
        description="Plafon kategori menjadi baseline aktif untuk pengeluaran, kontrol budget, dan pelaporan project."
        onClose={() => setConfirmApprove(false)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={() => setConfirmApprove(false)}
              fullWidth
              className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold active:z-10 active:shadow-raised"
              variant="secondary"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={isPending}
              fullWidth
              onClick={() => {
                setConfirmApprove(false);
                onApproveBudget();
              }}
              className="min-h-12 rounded-full bg-primary px-4 text-xs font-bold text-white active:z-10 active:shadow-raised disabled:opacity-40"
              variant="primary"
            >
              Setujui Budget
            </Button>
          </div>
        }
      />
      <ConfirmationDialog
        open={showRejectForm}
        title="Tolak dan minta revisi?"
        description="Project Budget kembali editable. Jelaskan bagian yang harus diperbaiki agar PM dapat menindaklanjuti."
        tone="danger"
        onClose={() => setShowRejectForm(false)}
        actions={
          <form onSubmit={onRejectBudgetSubmit} className="space-y-3">
            <FormField label="Alasan revisi" required>
              <Textarea
                autoFocus
                value={rejectionNotes}
                onChange={setRejectionNotes}
                placeholder="Contoh: Alokasi Material perlu disesuaikan dengan RAP terbaru"
                rows={3}
                disabled={isPending}
              />
            </FormField>
            {/* Ambang tiga karakter tidak tertulis di mana pun sebelumnya:
                tombolnya sekadar mati sampai kebetulan cukup panjang. */}
            <div aria-live="polite" className="empty:hidden">
              {!isPending && rejectionNotes.trim().length < 3 ? (
                <p className="px-1 text-meta font-medium text-on-surface-variant">
                  Tulis alasan revisinya lebih dulu, minimal 3 karakter.
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={() => setShowRejectForm(false)}
                fullWidth
                className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold active:z-10 active:shadow-raised"
                variant="secondary"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isPending || rejectionNotes.trim().length < 3}
                fullWidth
                className="min-h-12 rounded-full bg-error px-4 text-xs font-bold text-white active:z-10 active:shadow-raised disabled:opacity-40"
                variant="critical"
              >
                {isPending ? "Mengirim…" : "Tolak Budget"}
              </Button>
            </div>
          </form>
        }
      />
    </div>
  );
}
