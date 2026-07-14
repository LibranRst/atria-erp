"use client";

import React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArchiveRestore, ListPlus, Pencil, Plus, SlidersHorizontal, Warehouse } from "lucide-react";
import { createMaterialCategorySetting, createMaterialWithInventoryDefaults, setMaterialActive, updateMaterial, updateMaterialSettingDefaults, type MaterialSettingRow } from "@/app/actions/settings/system";
import { CompactMetric, ConfirmationSheet, EmptyState, FilterPills, SettingsHeader } from "./settings-ui";
import { COMMON_UNIT_OPTIONS, ComboboxField, ConfirmationModal, FilterSelect, FormDisclosure, FormField, FormSection, OperationalFormSheet, MoneyInput, NumericInput, SearchInput, SheetSelect, Textarea, TextInput } from "@/components/ui";
import { transitionSpringSnappy } from "@/lib/utils/motion";

type Option = { readonly id: string; readonly name: string };
type MaterialDraft = { readonly id?: string; readonly categoryId: string; readonly defaultVendorId: string | null; readonly name: string; readonly specification: string; readonly brand: string; readonly code: string; readonly color: string; readonly unit: string; readonly isActive: boolean; readonly locationId: string; readonly minimumStock: number; readonly lastPurchasePrice: number };
type InventoryDraft = { readonly materialId: string; readonly id: string; readonly locationName: string; readonly minimumStock: number; readonly lastPurchasePrice: number };
type MaterialSettingsManagerProps = { readonly initialMaterials: readonly MaterialSettingRow[]; readonly initialCategories: readonly Option[]; readonly vendors: readonly Option[]; readonly locations: readonly Option[]; readonly roleName: string; readonly canManage: boolean; readonly hideHeader?: boolean };

const STATUS_FILTERS = [{ value: "ACTIVE", label: "Aktif" }, { value: "INACTIVE", label: "Diarsipkan" }, { value: "ALL", label: "Semua status" }] as const;

export function MaterialSettingsManager({ initialMaterials, initialCategories, vendors, locations, roleName, canManage, hideHeader = false }: MaterialSettingsManagerProps): React.JSX.Element {
  const [materials, setMaterials] = React.useState(initialMaterials);
  const [categories, setCategories] = React.useState(initialCategories);
  const [draft, setDraft] = React.useState<MaterialDraft | null>(null);
  const [inventoryEdit, setInventoryEdit] = React.useState<InventoryDraft | null>(null);
  const [draftBaseline, setDraftBaseline] = React.useState("");
  const [inventoryBaseline, setInventoryBaseline] = React.useState("");
  const [inventoryOriginal, setInventoryOriginal] = React.useState<InventoryDraft | null>(null);
  const [pendingClose, setPendingClose] = React.useState<"MATERIAL" | "INVENTORY" | null>(null);
  const [confirmMaterial, setConfirmMaterial] = React.useState<MaterialSettingRow | null>(null);
  const [showCategoryComposer, setShowCategoryComposer] = React.useState(false);
  const [showMaterialDetails, setShowMaterialDetails] = React.useState(false);
  const [categoryName, setCategoryName] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("ALL");
  const [vendorFilter, setVendorFilter] = React.useState("ALL");
  const [status, setStatus] = React.useState("ACTIVE");
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const categoryFilters = React.useMemo(() => [{ value: "ALL", label: "Semua kategori" }, ...categories.map((category) => ({ value: category.id, label: category.name }))], [categories]);
  const vendorFilters = React.useMemo(() => [{ value: "ALL", label: "Semua vendor" }, ...vendors.map((vendor) => ({ value: vendor.id, label: vendor.name }))], [vendors]);
  const filtered = materials.filter((material) => (material.name + (material.code ?? "") + (material.brand ?? "")).toLowerCase().includes(search.toLowerCase()) && (categoryFilter === "ALL" || material.categoryId === categoryFilter) && (vendorFilter === "ALL" || material.defaultVendorId === vendorFilter) && (status === "ALL" || (status === "ACTIVE" ? material.isActive : !material.isActive)));
  const materialCompletionItems = draft ? [
    draft.categoryId && categories.some((category) => category.id === draft.categoryId),
    draft.name.trim().length > 0,
    draft.unit.trim().length > 0,
    Boolean(draft.id) || (draft.locationId && locations.some((location) => location.id === draft.locationId)),
  ] : [];
  const materialCompletedCount = materialCompletionItems.filter(Boolean).length;
  const materialCompletionTotal = materialCompletionItems.length || 1;
  const canSaveMaterial = Boolean(draft && materialCompletedCount === materialCompletionTotal);
  const materialDisabledReason = !draft
    ? undefined
    : !draft.categoryId || !categories.some((category) => category.id === draft.categoryId)
      ? "Pilih kategori material yang valid."
      : !draft.name.trim()
        ? "Isi nama material."
        : !draft.unit.trim()
          ? "Isi unit material."
          : !draft.id && (!draft.locationId || !locations.some((location) => location.id === draft.locationId))
            ? "Pilih lokasi awal agar default inventory tidak salah tempat."
            : undefined;
  const inventoryDirty = Boolean(inventoryEdit && JSON.stringify(inventoryEdit) !== inventoryBaseline);

  function blank(): MaterialDraft { return { categoryId: categories[0]?.id ?? "", defaultVendorId: null, name: "", specification: "", brand: "", code: "", color: "", unit: "unit", isActive: true, locationId: locations[0]?.id ?? "", minimumStock: 0, lastPurchasePrice: 0 }; }
  function openMaterial(next: MaterialDraft): void {
    setDraft(next);
    setDraftBaseline(JSON.stringify(next));
    setShowMaterialDetails(Boolean(next.id || next.brand || next.code || next.color || next.specification || next.defaultVendorId));
  }
  function openInventory(next: InventoryDraft): void { setInventoryEdit(next); setInventoryOriginal(next); setInventoryBaseline(JSON.stringify(next)); }
  function closeMaterial(): void { if (draft && JSON.stringify(draft) !== draftBaseline) setPendingClose("MATERIAL"); else { setDraft(null); setShowCategoryComposer(false); } }
  function closeInventory(): void { if (inventoryEdit && JSON.stringify(inventoryEdit) !== inventoryBaseline) setPendingClose("INVENTORY"); else { setInventoryEdit(null); setInventoryOriginal(null); } }

  function saveMaterial(): void {
    if (!draft || !canSaveMaterial) return;
    startTransition(async () => {
      if (draft.id) {
        const result = await updateMaterial({ materialId: draft.id, categoryId: draft.categoryId, defaultVendorId: draft.defaultVendorId, name: draft.name, specification: draft.specification, brand: draft.brand, code: draft.code, color: draft.color, unit: draft.unit, isActive: draft.isActive });
        if (result.success) { setMaterials((current) => current.map((row) => row.id === result.data.id ? result.data : row)); setDraft(null); setDraftBaseline(""); setMessage("Material berhasil diperbarui."); toast.success("Material berhasil diperbarui."); }
        else { setMessage(result.error.message); toast.error(result.error.message); }
      } else {
        const result = await createMaterialWithInventoryDefaults({ categoryId: draft.categoryId, defaultVendorId: draft.defaultVendorId, name: draft.name, specification: draft.specification, brand: draft.brand, code: draft.code, color: draft.color, unit: draft.unit, inventoryDefaults: [{ inventoryLocationId: draft.locationId, minimumStock: draft.minimumStock, lastPurchasePrice: draft.lastPurchasePrice }] });
        if (result.success) { toast.success("Material baru berhasil ditambahkan."); window.location.reload(); } else { setMessage(result.error.message); toast.error(result.error.message); }
      }
    });
  }

  function confirmToggle(): void {
    if (!confirmMaterial) return;
    const target = confirmMaterial;
    startTransition(async () => {
      const result = await setMaterialActive({ materialId: target.id, isActive: !target.isActive });
      if (result.success) { setMaterials((current) => current.map((row) => row.id === target.id ? { ...row, isActive: result.data.isActive } : row)); setConfirmMaterial(null); toast.success("Material berhasil diperbarui."); }
      else { setMessage(result.error.message); toast.error(result.error.message); }
    });
  }

  function saveInventory(): void {
    if (!inventoryEdit) return;
    startTransition(async () => {
      const result = await updateMaterialSettingDefaults({ materialInventoryId: inventoryEdit.id, minimumStock: inventoryEdit.minimumStock, lastPurchasePrice: inventoryEdit.lastPurchasePrice });
      if (result.success) { setMaterials((current) => current.map((material) => material.id === inventoryEdit.materialId ? { ...material, inventory: material.inventory.map((row) => row.id === result.data.id ? result.data : row) } : material)); setInventoryEdit(null); setInventoryOriginal(null); setInventoryBaseline(""); setMessage("Default inventory diperbarui."); toast.success("Default inventory diperbarui."); }
      else { setMessage(result.error.message); toast.error(result.error.message); }
    });
  }

  function addCategory(): void {
    const name = categoryName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createMaterialCategorySetting({ name, description: null });
      if (result.success) { setCategories((current) => [...current, result.data].sort((a, b) => a.name.localeCompare(b.name))); if (draft) setDraft({ ...draft, categoryId: result.data.id }); setCategoryName(""); setShowCategoryComposer(false); toast.success("Kategori baru berhasil ditambahkan."); }
      else { setMessage(result.error.message); toast.error(result.error.message); }
    });
  }

  const addAction = <button type="button" disabled={!canManage} onClick={() => openMaterial(blank())} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-on-primary active:scale-[0.99] disabled:opacity-35"><Plus className="h-4 w-4" /> Tambah material</button>;

  return (
    <section className="min-w-0 space-y-lg">
      {!hideHeader && <SettingsHeader eyebrow="Identitas dan default material" title="Material Master" description="Identitas material dan default inventori. Pergerakan stok tetap dilakukan di Material & Stok." role={roleName} canManage={canManage} action={addAction} />}
      {hideHeader && addAction}
      {message && <p className="rounded-2xl bg-primary/5 px-3 py-2.5 text-[11px] leading-4 text-primary ring-1 ring-primary/15">{message}</p>}
      <div className="min-w-0 space-y-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari material, kode, merek" ariaLabel="Cari material master" />
        <div className="grid grid-cols-2 gap-2">
          <FilterSelect label="Kategori" value={categoryFilter} options={categoryFilters} onChange={setCategoryFilter} />
          <FilterSelect label="Vendor" value={vendorFilter} options={vendorFilters} onChange={setVendorFilter} />
        </div>
        <FilterPills label="Filter status" value={status} options={STATUS_FILTERS} onChange={setStatus} />
      </div>
      {filtered.length === 0 ? <EmptyState title="Tidak ada material" description="Ubah filter atau tambahkan Material Master pertama." /> : (
        <div className="min-w-0 space-y-sm">
          {filtered.map((material) => (
            <article key={material.id} className={`min-w-0 rounded-[28px] border bg-white p-md shadow-[0_14px_34px_rgba(17,17,17,0.045)] ${material.isActive ? "border-outline-variant/20" : "border-outline-variant/15 opacity-60"}`}>
              <div className="flex min-w-0 items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-[9px] font-bold uppercase tracking-wide text-primary">{material.categoryName}</p><h2 className="mt-0.5 truncate text-[16px] font-bold leading-5 text-on-surface">{material.name}</h2><p className="mt-1 truncate text-[11px] text-on-surface-variant">{[material.brand, material.code, material.color, material.unit].filter(Boolean).join(" · ")}</p>{material.defaultVendorName && <p className="mt-0.5 truncate text-[10px] text-on-surface-variant">Vendor: {material.defaultVendorName}</p>}</div><button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-low" disabled={!canManage} onClick={() => openMaterial({ id: material.id, categoryId: material.categoryId, defaultVendorId: material.defaultVendorId, name: material.name, specification: material.specification ?? "", brand: material.brand ?? "", code: material.code ?? "", color: material.color ?? "", unit: material.unit, isActive: material.isActive, locationId: "", minimumStock: 0, lastPurchasePrice: 0 })} aria-label={`Edit ${material.name}`}><Pencil className="h-4 w-4" /></button><button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-low" disabled={!canManage || pending} onClick={() => setConfirmMaterial(material)} aria-label="Ubah status"><ArchiveRestore className="h-4 w-4" /></button></div>
              <div className="mt-sm space-y-2 border-t border-outline-variant/10 pt-sm">
                {material.inventory.map((inventory) => {
                  const available = inventory.currentStock - inventory.reservedStock;
                  return (
                    <button type="button" key={inventory.id} disabled={!canManage} onClick={() => openInventory({ materialId: material.id, id: inventory.id, locationName: inventory.locationName, minimumStock: inventory.minimumStock, lastPurchasePrice: inventory.lastPurchasePrice })} className="w-full min-w-0 rounded-[24px] bg-surface-container-low p-3 text-left active:scale-[0.99] disabled:cursor-default">
                      <div className="flex min-w-0 items-center gap-2"><Warehouse className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate text-xs font-bold text-on-surface">{inventory.locationName}</span><span className="shrink-0 text-[9px] text-on-surface-variant">Edit default</span></div>
                      <div className="mt-2 grid grid-cols-2 gap-2"><CompactMetric label="Stok Minimum" value={inventory.minimumStock.toLocaleString("id-ID")} /><CompactMetric label="Harga Acuan" amount={inventory.lastPurchasePrice} /></div>
                      <div className="mt-2 grid grid-cols-2 gap-2"><CompactMetric label="Stok / Reservasi" value={`${inventory.currentStock.toLocaleString("id-ID")} / ${inventory.reservedStock.toLocaleString("id-ID")}`} /><CompactMetric label="Tersedia / Biaya Rata-rata" supportingValue={available.toLocaleString("id-ID")} amount={inventory.averageCost} tone={available < inventory.minimumStock ? "warning" : "primary"} /></div>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}

      <OperationalFormSheet open={Boolean(draft)} title={draft?.id ? "Edit Material" : "Tambah Material"} onClose={closeMaterial} pending={pending} disabled={!canManage || !canSaveMaterial} disabledReason={materialDisabledReason} submitLabel="Simpan Material" submittingLabel="Menyimpan…" onSubmit={saveMaterial} statusText={draft ? `${materialCompletedCount} dari ${materialCompletionTotal} data wajib lengkap${draft.name.trim() ? ` · ${draft.name.trim()}` : ""}` : undefined} statusTone={canSaveMaterial ? "success" : "warning"}>
        {draft ? (
          <div className="space-y-md">
            <FormSection title="1 · Identitas utama" helper="Nama, kategori, dan satuan wajib agar material konsisten di RAP, stok, dan transaksi.">
              <SheetSelect label="Kategori material" value={draft.categoryId} onChange={(value) => setDraft({ ...draft, categoryId: value })} options={categories.map((row) => ({ value: row.id, label: row.name }))} />
              <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={!canManage} onClick={() => setShowCategoryComposer(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-surface-container-low px-5 text-xs font-bold text-primary ring-1 ring-outline-variant/15"><ListPlus className="h-4 w-4" /> Buat kategori material</motion.button>
              <FormField label="Nama material" required error={!draft.name.trim() ? "Nama material wajib diisi." : undefined}><TextInput value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} aria-invalid={!draft.name.trim()} /></FormField>
              <ComboboxField label="Satuan" value={draft.unit} onChange={(value) => setDraft({ ...draft, unit: value })} options={COMMON_UNIT_OPTIONS} error={!draft.unit.trim() ? "Satuan wajib diisi." : undefined} />
            </FormSection>

            <FormDisclosure title="Detail material" description="Merek, kode, warna, vendor, dan spesifikasi" summary={[draft.brand, draft.code, draft.color, draft.defaultVendorId, draft.specification].filter(Boolean).length > 0 ? `${[draft.brand, draft.code, draft.color, draft.defaultVendorId, draft.specification].filter(Boolean).length} terisi` : "Opsional"} icon={<SlidersHorizontal className="h-4 w-4" />} expanded={showMaterialDetails} onToggle={() => setShowMaterialDetails((current) => !current)}>
              <FormSection title="Informasi pembelian" helper="Isi hanya data yang membantu pencarian atau pembelian berulang.">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><FormField label="Merek" optional><TextInput value={draft.brand} onChange={(value) => setDraft({ ...draft, brand: value })} /></FormField><FormField label="Kode" optional><TextInput value={draft.code} onChange={(value) => setDraft({ ...draft, code: value })} /></FormField></div>
                <FormField label="Warna" optional><TextInput value={draft.color} onChange={(value) => setDraft({ ...draft, color: value })} /></FormField>
                <SheetSelect label="Vendor default" value={draft.defaultVendorId ?? ""} onChange={(value) => setDraft({ ...draft, defaultVendorId: value || null })} options={[{ value: "", label: "Tanpa vendor default" }, ...vendors.map((row) => ({ value: row.id, label: row.name }))]} />
                <FormField label="Spesifikasi" optional><Textarea value={draft.specification} onChange={(value) => setDraft({ ...draft, specification: value })} rows={2} /></FormField>
              </FormSection>
            </FormDisclosure>

            {!draft.id ? (
              <FormSection title="2 · Default inventori awal" helper="Lokasi wajib; stok minimum dan harga acuan dapat tetap nol bila belum diketahui.">
                <SheetSelect label="Lokasi" value={draft.locationId} onChange={(value) => setDraft({ ...draft, locationId: value })} options={locations.map((row) => ({ value: row.id, label: row.name }))} error={!draft.locationId ? "Lokasi awal wajib dipilih agar stok tidak masuk tempat yang salah." : undefined} />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><FormField label="Stok minimum"><NumericInput min={0} value={draft.minimumStock} onChange={(value) => setDraft({ ...draft, minimumStock: Number(value || 0) })} /></FormField><FormField label="Harga acuan"><MoneyInput value={draft.lastPurchasePrice} onChange={(value) => setDraft({ ...draft, lastPurchasePrice: Number(value || 0) })} /></FormField></div>
              </FormSection>
            ) : null}
          </div>
        ) : null}
      </OperationalFormSheet>

      <OperationalFormSheet open={showCategoryComposer} title="Kategori Material Baru" onClose={() => { setShowCategoryComposer(false); setCategoryName(""); }} pending={pending} disabled={!categoryName.trim()} disabledReason={!categoryName.trim() ? "Isi nama kategori material." : undefined} submitLabel="Tambahkan Kategori" submittingLabel="Menambahkan…" onSubmit={addCategory} statusText={categoryName.trim() ? `${categoryName.trim()} · Siap ditambahkan` : "Nama kategori belum diisi"} statusTone={categoryName.trim() ? "success" : "warning"}>
        <FormSection title="Nama kategori" helper="Kategori baru langsung dipilih pada Material yang sedang dibuat."><FormField label="Nama kategori material" required><TextInput autoFocus value={categoryName} onChange={setCategoryName} placeholder="Contoh: Hardware" /></FormField></FormSection>
      </OperationalFormSheet>

      <OperationalFormSheet open={Boolean(inventoryEdit)} title="Default Inventori" onClose={closeInventory} pending={pending} disabled={!inventoryDirty} disabledReason={!inventoryDirty ? "Belum ada perubahan untuk disimpan." : undefined} submitLabel="Simpan Default Inventori" submittingLabel="Menyimpan…" onSubmit={saveInventory} statusText={inventoryEdit ? `${inventoryEdit.locationName} · ${inventoryDirty ? "Perubahan siap disimpan" : "Belum ada perubahan"}` : undefined} statusTone={inventoryDirty ? "success" : "default"}>
        {inventoryEdit && <div className="space-y-md"><div className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface-container-low px-4"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-primary"><Warehouse className="h-4 w-4" /></span><div><p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Lokasi inventori</p><p className="mt-0.5 text-sm font-bold text-on-surface">{inventoryEdit.locationName}</p></div></div><FormSection title="Batas & harga acuan" helper="Perubahan ini tidak mengubah stok saat ini."><FormField label="Stok minimum"><NumericInput min={0} value={inventoryEdit.minimumStock} onChange={(value) => setInventoryEdit({ ...inventoryEdit, minimumStock: Number(value || 0) })} /></FormField><FormField label="Harga pembelian acuan"><MoneyInput value={inventoryEdit.lastPurchasePrice} onChange={(value) => setInventoryEdit({ ...inventoryEdit, lastPurchasePrice: Number(value || 0) })} /></FormField></FormSection>{inventoryOriginal ? <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-surface-container-low p-3 text-center"><div><p className="text-[9px] font-bold uppercase tracking-wide text-on-surface-variant">Sebelum</p><p className="mt-1 text-xs font-bold">Min. {inventoryOriginal.minimumStock.toLocaleString("id-ID")}</p><p className="mt-0.5 text-[10px] text-on-surface-variant">Rp {inventoryOriginal.lastPurchasePrice.toLocaleString("id-ID")}</p></div><span className="text-on-surface-variant">→</span><div><p className="text-[9px] font-bold uppercase tracking-wide text-primary">Sesudah</p><p className="mt-1 text-xs font-bold text-primary">Min. {inventoryEdit.minimumStock.toLocaleString("id-ID")}</p><p className="mt-0.5 text-[10px] text-primary">Rp {inventoryEdit.lastPurchasePrice.toLocaleString("id-ID")}</p></div></div> : null}</div>}
      </OperationalFormSheet>
      <ConfirmationSheet open={Boolean(confirmMaterial)} title={confirmMaterial?.isActive ? "Arsipkan material?" : "Aktifkan kembali material?"} description={confirmMaterial ? `${confirmMaterial.name} ${confirmMaterial.isActive ? "tidak akan muncul sebagai pilihan aktif." : "akan kembali tersedia sebagai pilihan."}` : ""} confirmLabel={confirmMaterial?.isActive ? "Arsipkan" : "Aktifkan"} danger={Boolean(confirmMaterial?.isActive)} pending={pending} onClose={() => setConfirmMaterial(null)} onConfirm={confirmToggle} />
      <ConfirmationModal open={pendingClose !== null} title="Buang perubahan yang belum disimpan?" description={pendingClose === "MATERIAL" ? "Perubahan identitas dan default material akan hilang." : "Perubahan minimum stok dan harga referensi akan hilang."} tone="danger" onClose={() => setPendingClose(null)} actions={<div className="grid grid-cols-2 gap-2"><motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setPendingClose(null)} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold">Lanjut Mengedit</motion.button><motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => { if (pendingClose === "MATERIAL") { setDraft(null); setDraftBaseline(""); setShowCategoryComposer(false); } else { setInventoryEdit(null); setInventoryOriginal(null); setInventoryBaseline(""); } setPendingClose(null); }} className="min-h-12 rounded-full bg-error px-4 text-xs font-bold text-white">Buang Perubahan</motion.button></div>} />
    </section>
  );
}
