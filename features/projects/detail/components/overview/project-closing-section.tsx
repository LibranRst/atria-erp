"use client";

import React from "react";

import { FormField, Textarea } from "@/components/ui";
import { MetricGrid, MoneyMetricPill, NativeSection } from "@/components/ui/page-primitives";
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
    <NativeSection eyebrow="Financial Closing" title="Project Closing Checklist">
      <p className="text-xs leading-5 text-on-surface-variant">
        Completion hanya tersedia setelah invoice, vendor bill/payment, expense,
        RAB/Change Order, stock reservation, dan canonical budget sudah final.
      </p>
      <button
        type="button"
        onClick={loadClosingChecklist}
        disabled={closingPending}
        className="mt-sm min-h-11 w-full rounded-full bg-surface-container-low px-4 text-xs font-bold text-primary disabled:opacity-40"
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
          <MetricGrid>
            <MoneyMetricPill
              label="Final/Current Cost"
              amount={closingChecklist.actualCost}
            />
            <MoneyMetricPill
              label="Realized Margin"
              amount={closingChecklist.realizedMargin}
              detail={`${closingChecklist.realizedMarginPercentage.toFixed(2)}%`}
            />
            <MoneyMetricPill
              label="Cash Position"
              amount={closingChecklist.cashPosition}
            />
          </MetricGrid>
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
                  aria-invalid={
                    closingNote.trim().length > 0 && closingNote.trim().length < 10
                  }
                />
              </FormField>
              <button
                type="button"
                onClick={handleCompleteProject}
                disabled={
                  closingPending ||
                  closingNote.trim().length < 10 ||
                  projectStatus === "COMPLETED"
                }
                className="min-h-12 w-full rounded-full bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-40"
              >
                Complete Project & Create Final Snapshot
              </button>
            </>
          )}
        </div>
      )}
    </NativeSection>
  );
}
