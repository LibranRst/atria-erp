"use client";

import React from "react";
import { toast } from "sonner";
import {
  updateExpenseCategoryDetails,
  type ExpenseCategorySettingRow,
} from "@/app/actions/settings/system";
import {
  ConfirmationDialog,
  DuotoneIconTile,
  FormField,
  FormRiskNotice,
  FormSection,
  GroupedSurface,
  MetadataChip,
  OperationalFormSheet,
  Textarea,
  TextInput,
  WorkspaceModuleHeader,
  WorkspaceRowChevron,
  WorkspaceStatusLabel,
} from "@/components/ui";

type CategorySettingsManagerProps = {
  readonly initialCategories: readonly ExpenseCategorySettingRow[];
  readonly canManage: boolean;
  readonly presentation?: "settings" | "onboarding";
  readonly onMutationComplete?: () => void;
};

export function CategorySettingsManager({
  initialCategories,
  canManage,
  presentation = "settings",
  onMutationComplete,
}: CategorySettingsManagerProps): React.JSX.Element {
  const [categories, setCategories] = React.useState(initialCategories);
  const [editing, setEditing] = React.useState<ExpenseCategorySettingRow | null>(null);
  const [editingBaseline, setEditingBaseline] = React.useState<ExpenseCategorySettingRow | null>(
    null,
  );
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const editingNameValid = Boolean(editing?.name.trim());
  const editingDirty = Boolean(
    editing &&
    editingBaseline &&
    (editing.name !== editingBaseline.name || editing.description !== editingBaseline.description),
  );

  function openEditor(category: ExpenseCategorySettingRow): void {
    setEditing(category);
    setEditingBaseline(category);
  }

  function requestClose(): void {
    if (editingDirty) setConfirmClose(true);
    else {
      setEditing(null);
      setEditingBaseline(null);
    }
  }

  function save(): void {
    if (!editing) return;
    startTransition(async () => {
      const result = await updateExpenseCategoryDetails({
        expenseCategoryId: editing.id,
        name: editing.name,
        description: editing.description,
      });
      if (result.success) {
        setCategories((current) =>
          current.map((row) => (row.id === result.data.id ? result.data : row)),
        );
        setEditing(null);
        setEditingBaseline(null);
        setMessage("Kategori diperbarui.");
        toast.success("Kategori diperbarui.");
        onMutationComplete?.();
      } else {
        setMessage(result.error.message);
        toast.error(result.error.message);
      }
    });
  }

  return (
    <section className={`min-w-0 ${presentation === "onboarding" ? "space-y-3" : "space-y-sm"}`}>
      {presentation === "onboarding" ? null : (
        <WorkspaceModuleHeader
          eyebrow="Kategori baku"
          title="Kategori Pengeluaran"
          description="Lima kelompok biaya yang menjaga budget dan laporan tetap konsisten."
        />
      )}
      {message && (
        <FormRiskNotice title="Status kategori" tone="success">
          {message}
        </FormRiskNotice>
      )}
      <GroupedSurface>
        <div className="divide-y divide-black/5.5">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => openEditor(category)}
              className="flex min-h-21.5 w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/75"
              aria-label={`${canManage ? "Edit" : "Lihat"} ${category.name}`}
            >
              <DuotoneIconTile name="lock" className="h-9 w-9" iconClassName="icon-sm" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-row font-bold text-on-surface">
                    {category.name}
                  </span>
                  <WorkspaceStatusLabel label={category.code} tone="neutral" />
                </span>
                <span className="mt-1 line-clamp-2 block text-[10px] leading-[1.3] text-on-surface-variant">
                  {category.description || "Belum ada deskripsi kategori."}
                </span>
                <span className="mt-1.5 block text-eyebrow font-semibold text-on-surface-variant/70">
                  Kode dan status aktif dilindungi
                </span>
              </span>
              <WorkspaceRowChevron />
            </button>
          ))}
        </div>
      </GroupedSurface>
      <OperationalFormSheet
        open={Boolean(editing)}
        title={canManage ? "Edit Kategori" : "Detail Kategori"}
        onClose={requestClose}
        pending={pending}
        disabled={!canManage || !editingNameValid || !editingDirty}
        disabledReason={
          !canManage
            ? "Akun ini hanya dapat melihat pengaturan kategori."
            : !editingNameValid
              ? "Nama kategori wajib diisi."
              : !editingDirty
                ? "Belum ada perubahan untuk disimpan."
                : undefined
        }
        submitLabel="Simpan"
        submittingLabel="Menyimpan…"
        onSubmit={save}
        statusText={
          editing
            ? `${editing.name.trim() || "Nama belum diisi"} · Kode ${editing.code}`
            : undefined
        }
        statusTone={!editingNameValid ? "warning" : editingDirty ? "success" : "default"}
      >
        {editing ? (
          <FormSection
            title="Identitas kategori"
            helper="Nama dan penjelasan tampil di budget, transaksi, dan laporan."
          >
            <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              <DuotoneIconTile name="lock" className="h-9 w-9" iconClassName="icon-sm" />
              <div className="min-w-0 flex-1">
                <p className="text-eyebrow font-bold tracking-wide text-on-surface-variant uppercase">
                  Kode kategori
                </p>
                <p className="mt-1 text-sm leading-none font-bold text-on-surface">
                  {editing.code}
                </p>
              </div>
              <MetadataChip>Dilindungi</MetadataChip>
            </div>
            <FormField
              label="Nama kategori"
              htmlFor="expense-category-name"
              required
              error={!editingNameValid ? "Nama kategori wajib diisi." : undefined}
            >
              <TextInput
                id="expense-category-name"
                disabled={!canManage}
                value={editing.name}
                onChange={(value) => setEditing({ ...editing, name: value })}
                aria-invalid={!editingNameValid}
              />
            </FormField>
            <FormField
              label="Deskripsi"
              htmlFor="expense-category-description"
              optional
              helper="Kode dan status kategori baku tidak dapat diubah agar histori transaksi tetap utuh."
            >
              <Textarea
                id="expense-category-description"
                disabled={!canManage}
                value={editing.description ?? ""}
                onChange={(value) => setEditing({ ...editing, description: value })}
                rows={3}
              />
            </FormField>
          </FormSection>
        ) : null}
      </OperationalFormSheet>
      <ConfirmationDialog
        open={confirmClose}
        title="Buang perubahan kategori?"
        description="Nama dan deskripsi akan kembali ke versi terakhir yang tersimpan."
        danger
        confirmLabel="Buang Perubahan"
        onConfirm={() => {
          setEditing(null);
          setEditingBaseline(null);
          setConfirmClose(false);
        }}
        onClose={() => setConfirmClose(false)}
      />
    </section>
  );
}
