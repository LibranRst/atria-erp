"use client";

import React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { LockKeyhole } from "lucide-react";
import {
  updateExpenseCategoryDetails,
  type ExpenseCategorySettingRow,
} from "@/app/actions/settings/system";
import { SettingsHeader } from "./settings-ui";
import {
  ConfirmationModal,
  FormField,
  FormSection,
  OperationalFormSheet,
  Textarea,
  TextInput,
} from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import {
  SettingsGroupSurface,
  SettingsModuleHeader,
  SettingsRowChevron,
  SettingsStatusLabel,
} from "./settings-primitives";

type CategorySettingsManagerProps = {
  readonly initialCategories: readonly ExpenseCategorySettingRow[];
  readonly roleName: string;
  readonly canManage: boolean;
  readonly hideHeader?: boolean;
  readonly presentation?: "settings" | "onboarding";
  readonly onMutationComplete?: () => void;
};

export function CategorySettingsManager({
  initialCategories,
  roleName,
  canManage,
  hideHeader = false,
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
    <section className={`min-w-0 ${presentation === "onboarding" ? "space-y-3" : "space-y-lg"}`}>
      {presentation === "onboarding" ? null : hideHeader ? (
        <SettingsModuleHeader
          eyebrow="Kategori baku"
          title="Kategori Pengeluaran"
          description="Lima kelompok biaya yang menjaga budget dan laporan tetap konsisten."
        />
      ) : (
        <SettingsHeader
          eyebrow="Kategori baku"
          title="Kategori Pengeluaran"
          description="Lima kelompok biaya yang menjaga budget dan laporan tetap konsisten."
          role={roleName}
          canManage={canManage}
        />
      )}
      {message && (
        <p className="bg-primary/5 text-primary ring-primary/15 rounded-2xl px-3 py-2.5 text-[11px] leading-4 ring-1">
          {message}
        </p>
      )}
      <SettingsGroupSurface>
        <div className="divide-y divide-black/5.5">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => openEditor(category)}
              className="focus-visible:bg-surface-container-low active:bg-surface-container-low/75 flex min-h-[86px] w-full items-center gap-3 px-3.5 py-3 text-left outline-none"
              aria-label={`${canManage ? "Edit" : "Lihat"} ${category.name}`}
            >
              <span className="bg-surface-container-low text-on-surface-variant flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px]">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-on-surface truncate text-[13px] font-bold">
                    {category.name}
                  </span>
                  <SettingsStatusLabel label={category.code} tone="neutral" />
                </span>
                <span className="text-on-surface-variant mt-1 line-clamp-2 block text-[10px] leading-[1.3]">
                  {category.description || "Belum ada deskripsi kategori."}
                </span>
                <span className="text-on-surface-variant/70 mt-1.5 block text-[9px] font-semibold">
                  Kode dan status aktif dilindungi
                </span>
              </span>
              <SettingsRowChevron />
            </button>
          ))}
        </div>
      </SettingsGroupSurface>
      <OperationalFormSheet
        actionPlacement="header"
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
              <span className="bg-surface-container-low text-on-surface-variant flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px]">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-on-surface-variant text-[9px] font-bold tracking-wide uppercase">
                  Kode kategori
                </p>
                <p className="text-on-surface mt-1 text-sm leading-none font-bold">
                  {editing.code}
                </p>
              </div>
              <span className="bg-surface-container-low text-on-surface-variant shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold">
                Dilindungi
              </span>
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
      <ConfirmationModal
        open={confirmClose}
        title="Buang perubahan kategori?"
        description="Nama dan deskripsi akan kembali ke versi terakhir yang tersimpan."
        tone="danger"
        onClose={() => setConfirmClose(false)}
        actions={
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => setConfirmClose(false)}
              className="bg-surface-container min-h-12 rounded-full px-4 text-xs font-bold"
            >
              Lanjut Mengedit
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={transitionSpringSnappy}
              onClick={() => {
                setEditing(null);
                setEditingBaseline(null);
                setConfirmClose(false);
              }}
              className="bg-error min-h-12 rounded-full px-4 text-xs font-bold text-white"
            >
              Buang Perubahan
            </motion.button>
          </div>
        }
      />
    </section>
  );
}
