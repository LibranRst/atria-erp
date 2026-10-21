"use client";

import { useReducedMotion } from "framer-motion";
import React from "react";
import {
  FormField,
  MoneyValue,
  Textarea,
  Button,
  GroupedSurface,
  StatusBadge,
} from "@/components/ui";
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
  desktop = false,
  canManage = false,
  sourceReady = false,
  canReview = false,
  closingAction,
  checkedAt,
  onDismiss,
}: {
  readonly projectStatus: string;
  readonly closingChecklist: ProjectClosingChecklist | null;
  readonly closingMessage: string | null;
  readonly closingNote: string;
  readonly setClosingNote: (note: string) => void;
  readonly closingPending: boolean;
  readonly loadClosingChecklist: () => void;
  readonly handleCompleteProject: () => void;
  readonly desktop?: boolean;
  readonly canManage?: boolean;
  readonly sourceReady?: boolean;
  readonly canReview?: boolean;
  readonly closingAction?: "check" | "complete" | null;
  readonly checkedAt?: Date | null;
  readonly onDismiss?: () => void;
}): React.JSX.Element {
  const resultRef = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  React.useEffect(() => {
    if (!closingChecklist || desktop) return;
    resultRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [closingChecklist, desktop, reduceMotion]);
  const completed = projectStatus === "COMPLETED";
  return (
    <section className="min-w-0 space-y-3" aria-label="Penutupan proyek">
      <h2
        className={`px-1 font-semibold text-on-surface ${desktop ? "text-section" : "text-title"}`}
      >
        Penutupan proyek
      </h2>
      <GroupedSurface variant={desktop ? "desktopPanel" : "default"} className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-row font-semibold">
            {completed ? "Proyek sudah selesai" : "Kesiapan penutupan"}
          </h3>
          {closingChecklist ? (
            <StatusBadge
              label={closingChecklist.canComplete ? "Siap ditinjau" : "Belum siap"}
              tone={closingChecklist.canComplete ? "healthy" : "warning"}
            />
          ) : null}
        </div>
        <p className="text-support leading-5 text-on-surface-variant">
          {completed
            ? "Proyek telah ditutup. Tidak ada tindakan penutupan lanjutan."
            : "Tagihan, biaya, RAB, perubahan lingkup, stok, budget, dan rekonsiliasi diperiksa sebelum proyek ditutup."}
        </p>
        {!completed && !canManage ? (
          <p className="text-support text-on-surface-variant">
            Penutupan memerlukan izin menutup proyek dan mengelola budget. Ringkasan margin tetap
            dapat dibaca sesuai akses Anda.
          </p>
        ) : null}
        {!completed && canManage ? (
          <Button
            type="button"
            onClick={loadClosingChecklist}
            disabled={closingPending || !sourceReady || projectStatus !== "ACTIVE"}
            size={desktop ? "compact" : "default"}
            className="w-full"
            variant="secondary"
          >
            {closingAction === "check"
              ? "Memeriksa…"
              : closingChecklist
                ? "Periksa ulang kesiapan"
                : "Periksa kesiapan penutupan"}
          </Button>
        ) : null}
        {closingMessage ? (
          <p role="status" className="text-support leading-5 text-error">
            {closingMessage}
          </p>
        ) : null}
        {closingChecklist && !completed ? (
          <div ref={resultRef} className="space-y-3">
            {checkedAt ? (
              <p className="text-meta text-on-surface-variant">
                Diperiksa{" "}
                {checkedAt.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Jakarta",
                })}{" "}
                · diperiksa ulang saat disimpan
              </p>
            ) : null}
            <div className="overflow-hidden rounded-inset bg-surface-container-low">
              <ClosingFact label="Biaya terpakai" amount={closingChecklist.actualCost} />
              <ClosingFact
                label={`Margin dari biaya tercatat · ${closingChecklist.realizedMarginPercentage.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`}
                amount={closingChecklist.realizedMargin}
              />
              <ClosingFact label="Posisi kas" amount={closingChecklist.cashPosition} />
            </div>
            <p className="text-support leading-5 text-on-surface-variant">
              Margin ini hanya memakai biaya yang sudah tercatat. Pekerjaan tersisa belum
              diperkirakan; ringkasan akhir disimpan saat proyek ditutup.
            </p>
            {closingChecklist.documentedReconciliationExceptionCount > 0 ? (
              <p className="text-support leading-5 text-warning">
                {closingChecklist.documentedReconciliationExceptionCount} transaksi memiliki
                pengecualian rekonsiliasi tercatat. Periksa alasannya sebelum menutup proyek.
              </p>
            ) : null}
            {closingChecklist.blockers.length > 0 || !closingChecklist.canComplete ? (
              <div className="space-y-2">
                <p className="text-support font-semibold text-error">Belum dapat ditutup</p>
                <ul className="list-disc space-y-1 pl-4 text-support leading-5 text-on-surface-variant">
                  {closingChecklist.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {!completed &&
        canManage &&
        (closingNote.length > 0 ||
          (closingChecklist?.canComplete && closingChecklist.blockers.length === 0)) ? (
          <div className="space-y-3" key="closing-note-editor">
            <FormField
              label="Catatan penutupan final"
              helper="Minimal 10 karakter untuk menjelaskan kondisi akhir proyek."
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
                placeholder="Ringkas kondisi akhir proyek…"
                disabled={closingPending}
                aria-invalid={closingNote.trim().length > 0 && closingNote.trim().length < 10}
              />
            </FormField>
            <Button
              type="button"
              onClick={handleCompleteProject}
              disabled={!canReview || closingPending}
              pending={closingAction === "complete"}
              size={desktop ? "compact" : "default"}
              className="w-full"
              variant="primary"
            >
              Tinjau penutupan proyek
            </Button>
          </div>
        ) : null}
        {!completed &&
        canManage &&
        onDismiss &&
        (closingChecklist !== null || closingNote.length > 0 || closingMessage !== null) ? (
          <Button
            size={desktop ? "compact" : "default"}
            variant="tertiary"
            disabled={closingPending}
            onClick={onDismiss}
            className="w-full"
          >
            Tutup pemeriksaan
          </Button>
        ) : null}
      </GroupedSurface>
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
    <div className="flex min-h-12 items-center justify-between gap-3 border-t border-outline-variant/25 px-3 py-2.5 first:border-t-0">
      <span className="text-support text-on-surface-variant">{label}</span>
      <MoneyValue
        amount={amount}
        variant="fullDynamic"
        align="right"
        size="sm"
        fractionDigits={Number.isInteger(amount) ? 0 : 2}
        tone={amount < 0 ? "danger" : "default"}
      />
    </div>
  );
}
