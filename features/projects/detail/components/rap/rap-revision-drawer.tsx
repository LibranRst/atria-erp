"use client";

import React from "react";

import { ChoiceRow, FormField, FormRiskNotice, FormSection, OperationalFormSheet, Textarea } from "@/components/ui";
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
}): React.JSX.Element {
  return (
    <OperationalFormSheet
      open={internalRevisionOpen}
      title="Buat Revisi RAP"
      onClose={() => setInternalRevisionOpen(false)}
      submitLabel="Buat Draft Revisi"
      submittingLabel="Membuat…"
      pending={isPending}
      disabled={internalRevisionReason.trim().length < 10 || (!reviseMaterial && revisionPackageIds.length === 0)}
      disabledReason={internalRevisionReason.trim().length < 10 ? "Jelaskan alasan revisi minimal 10 karakter." : !reviseMaterial && revisionPackageIds.length === 0 ? "Pilih minimal satu bagian yang akan direvisi." : undefined}
      onSubmit={handleCreateInternalPlanRevision}
      statusText={`${internalRevisionReason.trim().length}/10 karakter · ${(reviseMaterial ? 1 : 0) + revisionPackageIds.length} bagian dipilih`}
      statusTone={internalRevisionReason.trim().length >= 10 && (reviseMaterial || revisionPackageIds.length > 0) ? "success" : "warning"}
    >
      <div className="space-y-md">
        <FormRiskNotice title="RAP lama tetap terkunci" tone="default">Aplikasi membuat draft revisi baru. Data yang sudah disetujui tidak diedit langsung.</FormRiskNotice>
        <FormSection title="1 · Alasan revisi" helper="Alasan disimpan dalam audit dan membantu reviewer memahami perubahan.">
        <FormField
          label="Alasan revisi"
          helper="Minimal 10 karakter dan tersimpan dalam audit."
        >
          <Textarea
            rows={3}
            value={internalRevisionReason}
            onChange={setInternalRevisionReason}
            placeholder="Contoh: Perubahan lingkup area dapur"
          />
        </FormField>
        </FormSection>
        <FormSection title="2 · Bagian yang direvisi" helper="Pilih hanya material atau paket yang benar-benar perlu disesuaikan.">
        <fieldset className="space-y-2">
          <ChoiceRow
            checked={reviseMaterial}
            onChange={setReviseMaterial}
            title="Material RAP"
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
              />
            ))}
        </fieldset>
        </FormSection>
      </div>
    </OperationalFormSheet>
  );
}
