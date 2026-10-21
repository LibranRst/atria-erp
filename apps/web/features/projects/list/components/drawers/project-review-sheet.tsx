import React from "react";
import { useWorkspacePresentation } from "@/lib/navigation/workspace-presentation";

import {
  GroupedSurface,
  FactRow,
  FormRiskNotice,
  FormSection,
  WorkflowFormSheet,
} from "@/components/ui";
import type { ProjectFormDraft } from "@/features/projects/list/utils/project-form-draft";

function ReviewFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
      <span className="shrink-0 text-on-surface-variant">{label}</span>
      <span className="text-right font-bold text-on-surface">{value}</span>
    </div>
  );
}

export function ProjectReviewSheet({
  open,
  editMode,
  pending,
  draft,
  clientName,
  projectManagerName,
  statusLabel,
  healthLabel,
  onClose,
  onExitComplete,
  onSubmit,
}: {
  readonly open: boolean;
  readonly editMode: boolean;
  readonly pending: boolean;
  readonly draft: ProjectFormDraft;
  readonly clientName: string;
  readonly projectManagerName: string;
  readonly statusLabel: string;
  readonly healthLabel: string;
  readonly onClose: () => void;
  readonly onExitComplete?: () => void;
  readonly onSubmit: () => void;
}): React.JSX.Element {
  const desktop = useWorkspacePresentation() === "desktop";
  return (
    <WorkflowFormSheet
      desktopSize="wide"
      desktopFooterPlacement="aside"
      desktopAsideSummary={
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="text-support font-semibold text-on-surface">Keputusan proyek</h3>
            <p className="mt-1 text-support wrap-anywhere text-on-surface-variant">
              {draft.name.trim()}
            </p>
          </div>
          <GroupedSurface variant="desktopPanel" className="wrap-anywhere">
            <div className="divide-y divide-outline-variant/20">
              <FactRow layout="stacked" wrapLabel label="Klien" value={clientName} />
              <FactRow
                layout="stacked"
                wrapLabel
                label="Project Manager"
                value={projectManagerName}
              />
              <FactRow layout="stacked" wrapLabel label="Status" value={statusLabel} />
            </div>
          </GroupedSurface>
          <p className="px-1 text-support text-on-surface-variant">
            {editMode
              ? "Periksa perubahan sebelum menyimpan proyek."
              : "Budget kategori awal mengikuti default Settings."}
          </p>
        </div>
      }
      dismissal={{ mode: "discard" }}
      open={open}
      title={editMode ? "Tinjau Perubahan Proyek" : "Tinjau Proyek Baru"}
      primaryLabel={editMode ? "Simpan" : "Buat"}
      secondaryLabel="Ubah"
      pendingLabel={editMode ? "Memperbarui…" : "Membuat…"}
      pending={pending}
      onClose={onClose}
      onExitComplete={onExitComplete}
      onSecondary={onClose}
      onPrimary={onSubmit}
      statusText={`${clientName} · ${projectManagerName}`}
      statusTone="success"
    >
      <div className="space-y-3">
        <FormSection
          title={
            desktop ? "Rincian proyek" : editMode ? "Tinjau Perubahan Proyek" : "Tinjau Proyek Baru"
          }
          helper="Periksa detail proyek sebelum menyimpan."
        >
          <ReviewFact label="Nama Proyek" value={draft.name.trim()} />
          <ReviewFact label="Klien" value={clientName} />
          <ReviewFact label="Project Manager" value={projectManagerName} />
          <ReviewFact
            label="Lokasi & Area"
            value={[draft.location, draft.roomArea].filter(Boolean).join(" · ") || "–"}
          />
          <ReviewFact
            label="Periode"
            value={
              draft.startDate || draft.endDate
                ? `${draft.startDate || "–"}${draft.endDate ? ` → ${draft.endDate}` : ""}`
                : "–"
            }
          />
          <ReviewFact label="Status Proyek" value={statusLabel} />
          {editMode ? <ReviewFact label="Kesehatan Finansial" value={healthLabel} /> : null}
        </FormSection>
        <FormRiskNotice
          title={editMode ? "Dampak perubahan" : "Yang disiapkan otomatis"}
          tone="warning"
        >
          {editMode
            ? "Penugasan PM dan status proyek langsung memengaruhi akses serta alur operasional setelah disimpan."
            : "Project dibuat sebagai Draft. Budget kategori awal disiapkan dari default Settings; lengkapi setup lalu aktifkan proyek sebelum transaksi atau pergerakan stok."}
        </FormRiskNotice>
      </div>
    </WorkflowFormSheet>
  );
}
