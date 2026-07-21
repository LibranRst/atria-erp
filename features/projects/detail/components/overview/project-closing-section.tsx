"use client";

import React from "react";

import { FormField, Textarea } from "@/components/ui";
import { MoneyValue } from "@/components/ui/page-primitives";
import type { ProjectClosingChecklist } from "@/app/actions/project/closing";

export function ProjectClosingSection({
  projectStatus,
  closingChecklist,
  closingMessage,
  closingNote,
  setClosingNote,
  closingPending,
  loadClosingChecklist,
  handleCompleteProject,
}: {
  readonly projectStatus: string;
  readonly closingChecklist: ProjectClosingChecklist | null;
  readonly closingMessage: string | null;
  readonly closingNote: string;
  readonly setClosingNote: (note: string) => void;
  readonly closingPending: boolean;
  readonly loadClosingChecklist: () => void;
  readonly handleCompleteProject: () => void;
}): React.JSX.Element {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-[0_12px_30px_rgba(17,17,17,0.05)] ring-1 ring-black/2.5">
      <p className="text-[9px] font-bold tracking-[0.14em] text-on-surface-variant uppercase">
        Penutupan finansial
      </p>
      <h2 className="mt-0.5 text-[17px] leading-6 font-semibold text-on-surface">
        Checklist penutupan proyek
      </h2>
      <p className="mt-1 text-xs leading-5 text-on-surface-variant">
        Proyek hanya dapat diselesaikan setelah tagihan, biaya, RAB, change order, reservasi stok,
        dan budget sudah final.
      </p>
      <button
        type="button"
        onClick={loadClosingChecklist}
        disabled={closingPending}
        className="mt-4 min-h-12 w-full rounded-full bg-surface-container-low px-4 text-xs font-bold text-primary disabled:opacity-40"
      >
        {closingPending ? "Memeriksa…" : "Periksa kesiapan closing"}
      </button>
      {closingMessage && (
        <p className="mt-2 rounded-2xl bg-primary/5 p-3 text-[11px] leading-4 text-primary">
          {closingMessage}
        </p>
      )}
      {closingChecklist && (
        <div className="mt-sm space-y-sm">
          <div className="overflow-hidden rounded-[20px] bg-surface-container-low">
            <ClosingFact label="Biaya final saat ini" amount={closingChecklist.actualCost} />
            <ClosingFact
              label={`Margin realisasi · ${closingChecklist.realizedMarginPercentage.toFixed(2)}%`}
              amount={closingChecklist.realizedMargin}
            />
            <ClosingFact label="Posisi kas" amount={closingChecklist.cashPosition} />
          </div>
          {closingChecklist.blockers.length > 0 ? (
            <div className="rounded-2xl bg-error-container/25 p-3">
              <p className="text-xs font-bold text-error">Belum dapat ditutup</p>
              <ul className="mt-2 space-y-1 text-[11px] leading-4 text-error">
                {closingChecklist.blockers.map((blocker) => (
                  <li key={blocker}>• {blocker}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <FormField
                label="Catatan closing final"
                helper="Minimal 10 karakter untuk mencegah project ditutup tanpa konteks final."
                error={
                  closingNote.trim().length > 0 && closingNote.trim().length < 10
                    ? "Catatan minimal 10 karakter."
                    : undefined
                }
              >
                <Textarea
                  value={closingNote}
                  onChange={setClosingNote}
                  rows={3}
                  placeholder="Ringkas kondisi final proyek..."
                  aria-invalid={closingNote.trim().length > 0 && closingNote.trim().length < 10}
                />
              </FormField>
              <button
                type="button"
                onClick={handleCompleteProject}
                disabled={
                  closingPending || closingNote.trim().length < 10 || projectStatus === "COMPLETED"
                }
                className="min-h-12 w-full rounded-full bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-40"
              >
                Selesaikan proyek dan simpan snapshot final
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function ClosingFact({
  label,
  amount,
}: {
  readonly label: string;
  readonly amount: number;
}): React.JSX.Element {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-t border-outline-variant/25 px-3 py-2.5 first:border-t-0">
      <span className="text-[10px] font-semibold text-on-surface-variant">{label}</span>
      <MoneyValue
        amount={amount}
        variant="compactWithFull"
        align="right"
        size="sm"
        tone={amount < 0 ? "danger" : "default"}
      />
    </div>
  );
}
