"use client";

import React from "react";

import {
  GroupedSurface,
  FactRow,
  ChoiceRow,
  FormField,
  FormRiskNotice,
  FormSection,
  OperationalFormSheet,
  Textarea,
} from "@/components/ui";
import type { ProjectCategoryPlanItemView } from "../shared/rap-rab-manager";

export function InternalRevisionDrawer({
  internalRevisionOpen,
  setInternalRevisionOpen,
  internalRevisionReason,
  setInternalRevisionReason,
  reviseMaterial,
  setReviseMaterial,
  categoryPlanItems,
  revisionPackageIds,
  toggleRevisionPackage,
  handleCreateInternalPlanRevision,
  isPending,
  canReviseMaterial = true,
  canRevisePackages = true,
}: {
  readonly internalRevisionOpen: boolean;
  readonly setInternalRevisionOpen: (open: boolean) => void;
  readonly internalRevisionReason: string;
  readonly setInternalRevisionReason: (reason: string) => void;
  readonly reviseMaterial: boolean;
  readonly setReviseMaterial: (revise: boolean) => void;
  readonly categoryPlanItems: readonly ProjectCategoryPlanItemView[];
  readonly revisionPackageIds: readonly string[];
  readonly toggleRevisionPackage: (id: string) => void;
  readonly handleCreateInternalPlanRevision: () => void;
  readonly isPending: boolean;
  readonly canReviseMaterial?: boolean;
  readonly canRevisePackages?: boolean;
}): React.JSX.Element {
  const unauthorizedSelection =
    (reviseMaterial && !canReviseMaterial) || (revisionPackageIds.length > 0 && !canRevisePackages);
  return (
    <OperationalFormSheet
      desktopSize="wide"
      desktopFooterPlacement="aside"
      desktopAsideSummary={
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="text-support font-semibold text-on-surface">Lingkup revisi</h3>
          </div>
          <GroupedSurface variant="desktopPanel" className="wrap-anywhere">
            <div className="divide-y divide-outline-variant/20">
              <FactRow
                layout="stacked"
                wrapLabel
                label="Material RAP"
                value={reviseMaterial ? "Dipilih" : "Tidak dipilih"}
              />
              <FactRow
                layout="stacked"
                wrapLabel
                label="Paket kerja"
                value={`${revisionPackageIds.length} dipilih`}
              />
              <FactRow
                layout="stacked"
                wrapLabel
                label="Alasan audit"
                value={
                  internalRevisionReason.trim().length >= 10 ? "Terisi" : "Minimal 10 karakter"
                }
              />
            </div>
          </GroupedSurface>
          <p className="px-1 text-support text-on-surface-variant">
            Revisi menghasilkan draft baru; baseline RAP yang terkunci tetap dipertahankan.
          </p>
        </div>
      }
      dismissal={{
        mode: "confirm",
        dirty: internalRevisionReason.length > 0 || reviseMaterial || revisionPackageIds.length > 0,
        onDiscard: () => undefined,
        description: "Pilihan revisi RAP yang belum dibuat akan hilang.",
      }}
      open={internalRevisionOpen}
      title="Buat Revisi RAP"
      onClose={() => setInternalRevisionOpen(false)}
      submitLabel="Buat"
      submittingLabel="Membuat…"
      pending={isPending}
      disabled={
        unauthorizedSelection ||
        internalRevisionReason.trim().length < 10 ||
        (!reviseMaterial && revisionPackageIds.length === 0)
      }
      disabledReason={
        unauthorizedSelection
          ? "Izin revisi untuk pilihan ini tidak tersedia."
          : internalRevisionReason.trim().length < 10
            ? "Jelaskan alasan revisi minimal 10 karakter."
            : !reviseMaterial && revisionPackageIds.length === 0
              ? "Pilih minimal satu bagian yang akan direvisi."
              : undefined
      }
      onSubmit={handleCreateInternalPlanRevision}
      statusText={`${internalRevisionReason.trim().length}/10 karakter · ${(reviseMaterial ? 1 : 0) + revisionPackageIds.length} bagian dipilih`}
      statusTone={
        internalRevisionReason.trim().length >= 10 &&
        (reviseMaterial || revisionPackageIds.length > 0)
          ? "success"
          : "warning"
      }
    >
      <div className="space-y-md">
        <FormRiskNotice title="RAP lama tetap terkunci" tone="default">
          Aplikasi membuat draft revisi baru. Data yang sudah disetujui tidak diedit langsung.
        </FormRiskNotice>
        <FormSection
          title="Alasan revisi"
          helper="Alasan disimpan dalam audit dan membantu reviewer memahami perubahan."
        >
          <FormField label="Alasan revisi" helper="Minimal 10 karakter dan tersimpan dalam audit.">
            <Textarea
              rows={3}
              value={internalRevisionReason}
              onChange={setInternalRevisionReason}
              placeholder="Contoh: Perubahan lingkup area dapur"
            />
          </FormField>
        </FormSection>
        <FormSection
          title="Bagian yang direvisi"
          helper="Pilih hanya material atau paket yang benar-benar perlu disesuaikan."
        >
          <fieldset className="space-y-2">
            <ChoiceRow
              checked={reviseMaterial}
              onChange={setReviseMaterial}
              title="Material RAP"
              disabled={!canReviseMaterial || isPending}
            />
            {categoryPlanItems
              .filter((item) => item.status === "LOCKED")
              .map((item) => (
                <ChoiceRow
                  key={item.id}
                  checked={revisionPackageIds.includes(item.id)}
                  onChange={() => toggleRevisionPackage(item.id)}
                  title={item.name}
                  description={item.expenseCategoryName}
                  disabled={!canRevisePackages || isPending}
                />
              ))}
          </fieldset>
        </FormSection>
      </div>
    </OperationalFormSheet>
  );
}
