"use client";

import React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { LockKeyhole } from "lucide-react";
import { updateExpenseCategoryDetails, type ExpenseCategorySettingRow } from "@/app/actions/settings/system";
import { SettingsHeader } from "./settings-ui";
import { ConfirmationModal, FormField, FormRiskNotice, FormSection, OperationalFormSheet, Textarea, TextInput } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";
import { SettingsGroupSurface, SettingsModuleHeader, SettingsRowChevron, SettingsStatusLabel } from "./settings-primitives";

type CategorySettingsManagerProps = { readonly initialCategories: readonly ExpenseCategorySettingRow[]; readonly roleName: string; readonly canManage: boolean; readonly hideHeader?: boolean };

export function CategorySettingsManager({ initialCategories, roleName, canManage, hideHeader = false }: CategorySettingsManagerProps): React.JSX.Element {
  const [categories, setCategories] = React.useState(initialCategories);
  const [editing, setEditing] = React.useState<ExpenseCategorySettingRow | null>(null);
  const [editingBaseline, setEditingBaseline] = React.useState<ExpenseCategorySettingRow | null>(null);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const editingNameValid = Boolean(editing?.name.trim());
  const editingDirty = Boolean(editing && editingBaseline && (editing.name !== editingBaseline.name || editing.description !== editingBaseline.description));

  function openEditor(category: ExpenseCategorySettingRow): void {
    setEditing(category);
    setEditingBaseline(category);
  }

  function requestClose(): void {
    if (editingDirty) setConfirmClose(true);
    else { setEditing(null); setEditingBaseline(null); }
  }

  function save(): void {
    if (!editing) return;
    startTransition(async () => {
      const result = await updateExpenseCategoryDetails({ expenseCategoryId: editing.id, name: editing.name, description: editing.description });
      if (result.success) { setCategories((current) => current.map((row) => row.id === result.data.id ? result.data : row)); setEditing(null); setEditingBaseline(null); setMessage("Kategori diperbarui."); toast.success("Kategori diperbarui."); }
      else { setMessage(result.error.message); toast.error(result.error.message); }
    });
  }

  return (
    <section className="min-w-0 space-y-lg">
      {hideHeader ? <SettingsModuleHeader eyebrow="Kategori baku" title="Kategori Pengeluaran" description="Lima kelompok biaya yang menjaga budget dan laporan tetap konsisten." /> : <SettingsHeader eyebrow="Kategori baku" title="Kategori Pengeluaran" description="Lima kelompok biaya yang menjaga budget dan laporan tetap konsisten." role={roleName} canManage={canManage} />}
      {message && <p className="rounded-2xl bg-primary/5 px-3 py-2.5 text-[11px] leading-4 text-primary ring-1 ring-primary/15">{message}</p>}
      <SettingsGroupSurface>
        <div className="divide-y divide-black/[0.055]">
          {categories.map((category) => (
            <button key={category.id} type="button" onClick={() => openEditor(category)} className="flex min-h-[86px] w-full items-center gap-3 px-3.5 py-3 text-left outline-none focus-visible:bg-surface-container-low active:bg-surface-container-low/75" aria-label={`${canManage ? "Edit" : "Lihat"} ${category.name}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-surface-container-low text-on-surface-variant"><LockKeyhole className="h-4 w-4" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-2"><span className="truncate text-[13px] font-bold text-on-surface">{category.name}</span><SettingsStatusLabel label={category.code} tone="neutral" /></span><span className="mt-1 block line-clamp-2 text-[10px] leading-[1.3] text-on-surface-variant">{category.description || "Belum ada deskripsi kategori."}</span><span className="mt-1.5 block text-[9px] font-semibold text-on-surface-variant/70">Kode dan status aktif dilindungi</span></span>
              <SettingsRowChevron />
            </button>
          ))}
        </div>
      </SettingsGroupSurface>
      <OperationalFormSheet actionPlacement="header" open={Boolean(editing)} title={canManage ? "Edit Kategori" : "Detail Kategori"} onClose={requestClose} pending={pending} disabled={!canManage || !editingNameValid || !editingDirty} disabledReason={!canManage ? "Akun ini hanya dapat melihat pengaturan kategori." : !editingNameValid ? "Nama kategori wajib diisi." : !editingDirty ? "Belum ada perubahan untuk disimpan." : undefined} submitLabel="Simpan Perubahan" submittingLabel="Menyimpan…" onSubmit={save} statusText={editing ? `${editing.name.trim() || "Nama belum diisi"} · Kode ${editing.code}` : undefined} statusTone={!editingNameValid ? "warning" : editingDirty ? "success" : "default"}>
        {editing ? <div className="space-y-md"><div className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface-container-low px-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-on-surface-variant"><LockKeyhole className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Kode kategori</p><p className="mt-0.5 text-sm font-bold text-on-surface">{editing.code}</p></div><span className="text-[10px] font-semibold text-on-surface-variant">Dilindungi</span></div><FormSection title="Nama & penjelasan" helper="Gunakan nama singkat yang mudah dikenali tim operasional."><FormField label="Nama kategori" htmlFor="expense-category-name" required error={!editingNameValid ? "Nama kategori wajib diisi." : undefined}><TextInput id="expense-category-name" disabled={!canManage} value={editing.name} onChange={(value) => setEditing({ ...editing, name: value })} aria-invalid={!editingNameValid} /></FormField><FormField label="Deskripsi" htmlFor="expense-category-description" optional><Textarea id="expense-category-description" disabled={!canManage} value={editing.description ?? ""} onChange={(value) => setEditing({ ...editing, description: value })} rows={3} /></FormField></FormSection><FormRiskNotice title="Kategori budget baku" tone="default">Kode dan status aktif tetap dilindungi agar laporan serta histori transaksi tidak terpecah.</FormRiskNotice></div> : null}
      </OperationalFormSheet>
      <ConfirmationModal open={confirmClose} title="Buang perubahan kategori?" description="Nama dan deskripsi akan kembali ke versi terakhir yang tersimpan." tone="danger" onClose={() => setConfirmClose(false)} actions={<div className="grid grid-cols-2 gap-2"><motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setConfirmClose(false)} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold">Lanjut Mengedit</motion.button><motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => { setEditing(null); setEditingBaseline(null); setConfirmClose(false); }} className="min-h-12 rounded-full bg-error px-4 text-xs font-bold text-white">Buang Perubahan</motion.button></div>} />
    </section>
  );
}
