"use client";

import React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { LockKeyhole, Pencil } from "lucide-react";
import { updateExpenseCategoryDetails, type ExpenseCategorySettingRow } from "@/app/actions/settings/system";
import { SettingsHeader } from "./settings-ui";
import { ConfirmationModal, FormField, FormRiskNotice, FormSection, OperationalFormSheet, Textarea, TextInput } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";

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
      {!hideHeader && <SettingsHeader eyebrow="Kategori baku" title="Kategori Pengeluaran" description="Lima kelompok biaya yang menjaga budget dan laporan tetap konsisten." role={roleName} canManage={canManage} />}
      {message && <p className="rounded-2xl bg-primary/5 px-3 py-2.5 text-[11px] leading-4 text-primary ring-1 ring-primary/15">{message}</p>}
      <div className="divide-y divide-outline-variant/35 overflow-hidden rounded-[28px] border border-outline-variant/20 bg-white shadow-[0_14px_34px_rgba(17,17,17,0.045)]">
        {categories.map((category) => (
          <article key={category.id} className="min-w-0 px-md py-md">
            <div className="flex min-w-0 items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate text-[9px] font-bold uppercase tracking-[0.16em] text-primary">{category.code}</p><h2 className="mt-0.5 truncate text-[16px] font-bold leading-5 text-on-surface">{category.name}</h2><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-on-surface-variant">{category.description || "Belum ada deskripsi."}</p></div><button type="button" disabled={!canManage} onClick={() => openEditor(category)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface active:scale-95 disabled:opacity-35" aria-label={`Edit ${category.name}`}><Pencil className="h-4 w-4" /></button></div>
            <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[9px] font-semibold text-on-surface-variant"><LockKeyhole className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Kode dan status aktif dilindungi</span></div>
          </article>
        ))}
      </div>
      <OperationalFormSheet open={Boolean(editing)} title="Edit Kategori" onClose={requestClose} pending={pending} disabled={!canManage || !editingNameValid || !editingDirty} disabledReason={!editingNameValid ? "Nama kategori wajib diisi." : !editingDirty ? "Belum ada perubahan untuk disimpan." : undefined} submitLabel="Simpan Perubahan" submittingLabel="Menyimpan…" onSubmit={save} statusText={editing ? `${editing.name.trim() || "Nama belum diisi"} · Kode ${editing.code}` : undefined} statusTone={!editingNameValid ? "warning" : editingDirty ? "success" : "default"}>
        {editing ? <div className="space-y-md"><div className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface-container-low px-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-on-surface-variant"><LockKeyhole className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Kode kategori</p><p className="mt-0.5 text-sm font-bold text-on-surface">{editing.code}</p></div><span className="text-[10px] font-semibold text-on-surface-variant">Dilindungi</span></div><FormSection title="Nama & penjelasan" helper="Gunakan nama singkat yang mudah dikenali tim operasional."><FormField label="Nama kategori" htmlFor="expense-category-name" required error={!editingNameValid ? "Nama kategori wajib diisi." : undefined}><TextInput id="expense-category-name" disabled={!canManage} value={editing.name} onChange={(value) => setEditing({ ...editing, name: value })} aria-invalid={!editingNameValid} /></FormField><FormField label="Deskripsi" htmlFor="expense-category-description" optional><Textarea id="expense-category-description" disabled={!canManage} value={editing.description ?? ""} onChange={(value) => setEditing({ ...editing, description: value })} rows={3} /></FormField></FormSection><FormRiskNotice title="Kategori budget baku" tone="default">Kode dan status aktif tetap dilindungi agar laporan serta histori transaksi tidak terpecah.</FormRiskNotice></div> : null}
      </OperationalFormSheet>
      <ConfirmationModal open={confirmClose} title="Buang perubahan kategori?" description="Nama dan deskripsi akan kembali ke versi terakhir yang tersimpan." tone="danger" onClose={() => setConfirmClose(false)} actions={<div className="grid grid-cols-2 gap-2"><motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setConfirmClose(false)} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold">Lanjut Mengedit</motion.button><motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => { setEditing(null); setEditingBaseline(null); setConfirmClose(false); }} className="min-h-12 rounded-full bg-error px-4 text-xs font-bold text-white">Buang Perubahan</motion.button></div>} />
    </section>
  );
}
