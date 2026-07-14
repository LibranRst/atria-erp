"use client";

import React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArchiveRestore, CirclePlus, FileSearch, Pencil, Plus, Trash2 } from "lucide-react";

import { setItemPriceLibraryItemActive, type ExpenseCategorySettingRow } from "@/app/actions/settings/system";
import { upsertPricingTemplate, type PricingTemplateRow } from "@/app/actions/settings/pricing-library";
import { CompactMetric, ConfirmationSheet, EmptyState, FilterPills, SettingsHeader } from "./settings-ui";
import { COMMON_UNIT_OPTIONS, ComboboxField, CompactEditableItemRow, ConfirmationModal, DatePickerField, FilterSelect, FormDisclosure, FormField, FormRiskNotice, FormSection, OperationalFormSheet, MoneyInput, NumericInput, SearchInput, SegmentedTabs, SheetSelect, Textarea, TextInput, ValuePreviewStrip } from "@/components/ui";
import { createClientId } from "@/lib/utils/client-id";
import { transitionSpringSnappy } from "@/lib/utils/motion";

type ItemType = "MATERIAL_ITEM" | "WORK_PACKAGE" | "SUBCON_PACKAGE" | "CLIENT_LINE";
type ComponentType = "LABOR" | "MATERIAL" | "EQUIPMENT" | "LOGISTICS" | "OVERHEAD" | "OTHER";
type CostComponentDraft = { readonly key: string; readonly vendorId: string | null; readonly componentType: ComponentType; readonly label: string; readonly quantity: number; readonly unit: string; readonly unitCost: number; readonly note: string };
type Draft = {
  readonly id?: string;
  readonly expenseCategoryId: string;
  readonly materialId: string | null;
  readonly defaultVendorId: string | null;
  readonly code: string;
  readonly itemType: ItemType;
  readonly itemCategory: string;
  readonly name: string;
  readonly description: string;
  readonly unit: string;
  readonly pricingMode: "MARGIN_BASED" | "FIXED_CLIENT_PRICE";
  readonly targetGrossPercentage: number;
  readonly fixedClientPrice: number;
  readonly priceSourceType: "COST_BREAKDOWN" | "VENDOR_QUOTE" | "HISTORICAL" | "LEGACY_BACKFILL";
  readonly sourceNote: string;
  readonly effectiveFrom: string;
  readonly isActive: boolean;
  readonly components: readonly CostComponentDraft[];
};
type MaterialOption = { readonly id: string; readonly name: string; readonly isActive: boolean };
type VendorOption = { readonly id: string; readonly name: string };
type Props = { readonly initialItems: readonly PricingTemplateRow[]; readonly categories: readonly ExpenseCategorySettingRow[]; readonly materials: readonly MaterialOption[]; readonly vendors: readonly VendorOption[]; readonly roleName: string; readonly canManage: boolean; readonly hideHeader?: boolean };

const TYPE_FILTERS = [{ value: "ALL", label: "Semua tipe" }, { value: "MATERIAL_ITEM", label: "Material" }, { value: "WORK_PACKAGE", label: "Tukang" }, { value: "SUBCON_PACKAGE", label: "Subcon" }, { value: "CLIENT_LINE", label: "Baris klien" }] as const;
const STATUS_FILTERS = [{ value: "ACTIVE", label: "Aktif" }, { value: "INACTIVE", label: "Diarsipkan" }, { value: "ALL", label: "Semua status" }] as const;
const COMPONENT_TYPES: readonly ComponentType[] = ["LABOR", "MATERIAL", "EQUIPMENT", "LOGISTICS", "OVERHEAD", "OTHER"];
const COMPONENT_TYPE_LABELS: Readonly<Record<ComponentType, string>> = {
  LABOR: "Tenaga kerja",
  MATERIAL: "Material",
  EQUIPMENT: "Peralatan",
  LOGISTICS: "Logistik",
  OVERHEAD: "Overhead",
  OTHER: "Lainnya",
};
const ITEM_TYPE_LABELS: Readonly<Record<ItemType, string>> = {
  CLIENT_LINE: "Baris klien",
  MATERIAL_ITEM: "Material",
  WORK_PACKAGE: "Paket Tukang",
  SUBCON_PACKAGE: "Paket Subcon",
};
const PRICE_SOURCE_LABELS: Readonly<Record<Draft["priceSourceType"], string>> = {
  COST_BREAKDOWN: "Rincian biaya",
  VENDOR_QUOTE: "Penawaran vendor",
  HISTORICAL: "Riwayat harga",
  LEGACY_BACKFILL: "Data lama",
};
function itemTypeLabel(value: string): string {
  if (value === "CLIENT_LINE") return ITEM_TYPE_LABELS.CLIENT_LINE;
  if (value === "MATERIAL_ITEM") return ITEM_TYPE_LABELS.MATERIAL_ITEM;
  if (value === "WORK_PACKAGE") return ITEM_TYPE_LABELS.WORK_PACKAGE;
  if (value === "SUBCON_PACKAGE") return ITEM_TYPE_LABELS.SUBCON_PACKAGE;
  return value.replaceAll("_", " ");
}
function priceSourceLabel(value: string): string {
  if (value === "COST_BREAKDOWN") return PRICE_SOURCE_LABELS.COST_BREAKDOWN;
  if (value === "VENDOR_QUOTE") return PRICE_SOURCE_LABELS.VENDOR_QUOTE;
  if (value === "HISTORICAL") return PRICE_SOURCE_LABELS.HISTORICAL;
  if (value === "LEGACY_BACKFILL") return PRICE_SOURCE_LABELS.LEGACY_BACKFILL;
  return value.replaceAll("_", " ");
}
const fullMoney = (value: number): string => `Rp ${Math.round(value).toLocaleString("id-ID")}`;
function newComponent(): CostComponentDraft { return { key: createClientId("cost-component"), vendorId: null, componentType: "OTHER", label: "", quantity: 1, unit: "ls", unitCost: 0, note: "" }; }
function emptyDraft(categoryId: string): Draft { return { expenseCategoryId: categoryId, materialId: null, defaultVendorId: null, code: "", itemType: "CLIENT_LINE", itemCategory: "General", name: "", description: "", unit: "ls", pricingMode: "MARGIN_BASED", targetGrossPercentage: 0.4, fixedClientPrice: 0, priceSourceType: "COST_BREAKDOWN", sourceNote: "", effectiveFrom: new Date().toISOString().slice(0, 10), isActive: true, components: [newComponent()] }; }
function toDraft(item: PricingTemplateRow): Draft { return { id: item.id, expenseCategoryId: item.expenseCategoryId, materialId: item.materialId, defaultVendorId: item.defaultVendorId, code: item.code ?? "", itemType: item.itemType as ItemType, itemCategory: item.itemCategory, name: item.name, description: item.description ?? "", unit: item.unit, pricingMode: item.pricingMode as Draft["pricingMode"], targetGrossPercentage: item.targetGrossPercentage, fixedClientPrice: item.defaultClientPrice, priceSourceType: item.priceSourceType as Draft["priceSourceType"], sourceNote: item.sourceNote ?? "", effectiveFrom: item.effectiveFrom.toString().slice(0, 10), isActive: item.isActive, components: item.components.map((component) => ({ key: component.id, vendorId: component.vendorId, componentType: component.componentType as ComponentType, label: component.label, quantity: component.quantity, unit: component.unit, unitCost: component.unitCost, note: component.note ?? "" })) }; }

export function LibrarySettingsManager({ initialItems, categories, materials, vendors, roleName, canManage, hideHeader = false }: Props): React.JSX.Element {
  const [items, setItems] = React.useState(initialItems);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [draftBaseline, setDraftBaseline] = React.useState("");
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [confirmItem, setConfirmItem] = React.useState<PricingTemplateRow | null>(null);
  const [componentEditor, setComponentEditor] = React.useState<CostComponentDraft | null>(null);
  const [componentEditorBaseline, setComponentEditorBaseline] = React.useState("");
  const [confirmComponentClose, setConfirmComponentClose] = React.useState(false);
  const [nameTouched, setNameTouched] = React.useState(false);
  const [componentNameTouched, setComponentNameTouched] = React.useState(false);
  const [showSourceDetails, setShowSourceDetails] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState("ALL");
  const [status, setStatus] = React.useState("ACTIVE");
  const [categoryId, setCategoryId] = React.useState("ALL");
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const categoryFilters = React.useMemo(() => [{ value: "ALL", label: "Semua kategori" }, ...categories.map((category) => ({ value: category.id, label: category.name }))], [categories]);
  const filtered = items.filter((item) => `${item.name} ${item.itemCategory} ${item.code ?? ""}`.toLowerCase().includes(search.toLowerCase()) && (type === "ALL" || item.itemType === type) && (categoryId === "ALL" || item.expenseCategoryId === categoryId) && (status === "ALL" || (status === "ACTIVE" ? item.isActive : !item.isActive)));
  const internalCost = draft?.components.reduce((sum, component) => sum + component.quantity * component.unitCost, 0) ?? 0;
  const clientPrice = draft ? draft.pricingMode === "MARGIN_BASED" ? (draft.targetGrossPercentage < 1 ? internalCost / (1 - draft.targetGrossPercentage) : 0) : draft.fixedClientPrice : 0;
  const grossMargin = clientPrice > 0 ? ((clientPrice - internalCost) / clientPrice) * 100 : 0;
  const draftCompletionItems = draft ? [
    draft.expenseCategoryId && categories.some((category) => category.id === draft.expenseCategoryId),
    draft.name.trim().length > 0,
    draft.itemCategory.trim().length > 0,
    draft.unit.trim().length > 0,
    draft.effectiveFrom.trim().length > 0 && !Number.isNaN(new Date(draft.effectiveFrom).getTime()),
    draft.pricingMode === "MARGIN_BASED" || draft.fixedClientPrice > 0,
    draft.components.length > 0,
    ...draft.components.flatMap((component) => [
      component.label.trim().length > 0,
      Number(component.quantity) > 0,
      component.unit.trim().length > 0,
      Number(component.unitCost) >= 0,
    ]),
  ] : [];
  const draftCompletedCount = draftCompletionItems.filter(Boolean).length;
  const draftCompletionTotal = draftCompletionItems.length || 1;
  const canSaveDraft = Boolean(draft && draftCompletedCount === draftCompletionTotal);
  const componentEditorValid = Boolean(componentEditor && componentEditor.label.trim() && componentEditor.quantity > 0 && componentEditor.unit.trim() && componentEditor.unitCost >= 0);
  const componentEditorDirty = Boolean(componentEditor && JSON.stringify(componentEditor) !== componentEditorBaseline);
  const draftDisabledReason = !draft
    ? undefined
    : !draft.expenseCategoryId || !categories.some((category) => category.id === draft.expenseCategoryId)
      ? "Pilih kategori pengeluaran yang valid."
      : !draft.name.trim()
        ? "Isi nama template."
        : !draft.itemCategory.trim()
          ? "Isi kategori item."
          : !draft.unit.trim()
            ? "Isi satuan."
            : !draft.effectiveFrom.trim() || Number.isNaN(new Date(draft.effectiveFrom).getTime())
              ? "Isi tanggal berlaku yang valid."
              : draft.pricingMode === "FIXED_CLIENT_PRICE" && draft.fixedClientPrice <= 0
                ? "Harga tetap untuk klien harus lebih dari 0."
                : draft.components.some((component) => !component.label.trim() || Number(component.quantity) <= 0 || !component.unit.trim() || Number(component.unitCost) < 0)
                  ? "Lengkapi nama, jumlah, satuan, dan biaya satuan di setiap komponen."
                  : undefined;

  function openDraft(next: Draft): void {
    setDraft(next);
    setDraftBaseline(JSON.stringify(next));
    setNameTouched(false);
    setComponentEditor(null);
    setShowSourceDetails(Boolean(next.id || next.sourceNote || next.description));
  }
  function requestClose(): void { if (draft && JSON.stringify(draft) !== draftBaseline) setConfirmClose(true); else setDraft(null); }

  function changeType(nextType: ItemType): void { if (!draft) return; const required = nextType === "MATERIAL_ITEM" ? "MATERIAL" : nextType === "WORK_PACKAGE" ? "TUKANG" : nextType === "SUBCON_PACKAGE" ? "SUBCON" : null; const category = required ? categories.find((row) => row.code === required) : null; const defaultMargin = nextType === "MATERIAL_ITEM" ? 0.3 : nextType === "CLIENT_LINE" ? 0.4 : 0.2; setDraft({ ...draft, itemType: nextType, targetGrossPercentage: defaultMargin, expenseCategoryId: category?.id ?? draft.expenseCategoryId, materialId: nextType === "MATERIAL_ITEM" ? draft.materialId : null }); }
  function openComponent(component: CostComponentDraft): void {
    setComponentEditor({ ...component });
    setComponentEditorBaseline(JSON.stringify(component));
    setComponentNameTouched(false);
  }
  function patchComponent(update: Partial<CostComponentDraft>): void {
    setComponentEditor((current) => current ? { ...current, ...update } : current);
  }
  function addComponent(): void {
    const component = newComponent();
    setComponentEditor(component);
    setComponentEditorBaseline(JSON.stringify(component));
    setComponentNameTouched(false);
  }
  function requestComponentClose(): void {
    if (componentEditorDirty) setConfirmComponentClose(true);
    else setComponentEditor(null);
  }
  function saveComponent(): void {
    if (!draft || !componentEditor || !componentEditorValid) return;
    const exists = draft.components.some((component) => component.key === componentEditor.key);
    setDraft({
      ...draft,
      components: exists
        ? draft.components.map((component) => component.key === componentEditor.key ? componentEditor : component)
        : [...draft.components, componentEditor],
    });
    setComponentEditor(null);
    setComponentEditorBaseline("");
  }
  function deleteComponent(): void {
    if (!draft || !componentEditor || draft.components.length <= 1) return;
    setDraft({ ...draft, components: draft.components.filter((component) => component.key !== componentEditor.key) });
    setComponentEditor(null);
    setComponentEditorBaseline("");
  }
  function save(): void { if (!draft || !canSaveDraft) return; startTransition(async () => { const result = await upsertPricingTemplate({ itemPriceLibraryId: draft.id, expenseCategoryId: draft.expenseCategoryId, materialId: draft.materialId, defaultVendorId: draft.defaultVendorId, code: draft.code || null, itemType: draft.itemType, itemCategory: draft.itemCategory, name: draft.name, description: draft.description || null, unit: draft.unit, pricingMode: draft.pricingMode, targetGrossPercentage: draft.targetGrossPercentage, fixedClientPrice: draft.pricingMode === "FIXED_CLIENT_PRICE" ? draft.fixedClientPrice : undefined, priceSourceType: draft.priceSourceType, sourceNote: draft.sourceNote, effectiveFrom: new Date(draft.effectiveFrom), isActive: draft.isActive, components: draft.components.map((component, index) => ({ vendorId: component.vendorId, componentType: component.componentType, label: component.label, quantity: component.quantity, unit: component.unit, unitCost: component.unitCost, note: component.note || null, displayOrder: index })) }); if (result.success) { setItems((current) => draft.id ? current.map((item) => item.id === result.data.id ? result.data : item) : [result.data, ...current]); setDraft(null); setDraftBaseline(""); setMessage("Template dan breakdown harga berhasil disimpan."); toast.success("Template dan breakdown harga berhasil disimpan."); } else { setMessage(result.error.message); toast.error(result.error.message); } }); }
  function confirmToggle(): void { if (!confirmItem) return; const target = confirmItem; startTransition(async () => { const result = await setItemPriceLibraryItemActive({ itemPriceLibraryId: target.id, isActive: !target.isActive }); if (result.success) { setItems((current) => current.map((item) => item.id === target.id ? { ...item, isActive: result.data.isActive } : item)); setConfirmItem(null); toast.success("Item berhasil diperbarui."); } else { setMessage(result.error.message); toast.error(result.error.message); } }); }

  const addAction = <button type="button" disabled={!canManage} onClick={() => openDraft(emptyDraft(categories[0]?.id ?? ""))} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-on-primary active:scale-[0.99] disabled:opacity-35"><Plus className="h-4 w-4" /> Tambah template</button>;
  return <section className="min-w-0 space-y-lg">
    {!hideHeader && <SettingsHeader eyebrow="Template proyek berulang" title="Library Item & Harga" description="Template untuk RAP, paket kerja, Subcon, dan baris RAB. Harga berasal dari rincian biaya serta target margin kotor yang terlihat." role={roleName} canManage={canManage} action={addAction} />}
    {hideHeader && addAction}
    <div className="rounded-2xl bg-primary/5 p-sm text-[11px] leading-5 text-on-surface-variant ring-1 ring-primary/15"><strong className="text-primary">Cara kerja:</strong> Biaya internal adalah total komponen. Rekomendasi harga klien dihitung dari biaya internal dan target margin. Nilainya disimpan sebagai snapshot sehingga perubahan Library tidak diam-diam mengubah RAB lama.</div>
    {message && <p className="rounded-2xl bg-primary/5 px-3 py-2.5 text-[11px] leading-4 text-primary ring-1 ring-primary/15">{message}</p>}
    <div className="min-w-0 space-y-2.5"><SearchInput value={search} onChange={setSearch} placeholder="Cari template, kode, kategori" ariaLabel="Cari template harga" /><div className="grid grid-cols-2 gap-2"><FilterSelect label="Tipe" value={type} options={TYPE_FILTERS} onChange={setType} /><FilterSelect label="Kategori" value={categoryId} options={categoryFilters} onChange={setCategoryId} /></div><FilterPills label="Filter status" value={status} options={STATUS_FILTERS} onChange={setStatus} /></div>
    {filtered.length === 0 ? <EmptyState title="Tidak ada template" description="Ubah filter atau tambahkan template pertama." /> : <div className="min-w-0 space-y-sm">{filtered.map((item) => { const margin = item.defaultClientPrice > 0 ? ((item.defaultClientPrice - item.defaultInternalCost) / item.defaultClientPrice) * 100 : 0; return <article key={item.id} className={`min-w-0 rounded-[28px] border bg-white p-md shadow-[0_14px_34px_rgba(17,17,17,0.045)] ${item.isActive ? "border-outline-variant/20" : "border-outline-variant/15 opacity-65"}`}><div className="flex min-w-0 items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-[9px] font-bold uppercase tracking-wide text-primary">{itemTypeLabel(item.itemType)}</p><h2 className="mt-0.5 truncate text-[16px] font-bold leading-5">{item.name}</h2><p className="mt-1 truncate text-[11px] text-on-surface-variant">{item.itemCategory} · {item.unit}{item.code ? ` · ${item.code}` : ""}</p></div><button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-low" disabled={!canManage} onClick={() => openDraft(toDraft(item))} aria-label={`Edit ${item.name}`}><Pencil className="h-4 w-4" /></button><button className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-low" disabled={!canManage || pending} onClick={() => setConfirmItem(item)} aria-label={item.isActive ? "Arsipkan" : "Aktifkan kembali"}><ArchiveRestore className="h-4 w-4" /></button></div><div className="mt-sm grid grid-cols-2 gap-2"><CompactMetric label="Saran Harga Klien" amount={item.defaultClientPrice} tone="primary" /><CompactMetric label="Biaya Internal" amount={item.defaultInternalCost} /></div><div className="mt-2 flex min-w-0 items-center justify-between gap-3 text-[10px]"><span className="truncate text-on-surface-variant">{item.components.length} komponen · {priceSourceLabel(item.priceSourceType)}</span><span className="shrink-0 font-bold text-primary">Margin {margin.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</span></div>{item.sourceNote && <p className="mt-2 overflow-hidden text-ellipsis text-[10px] leading-4 text-on-surface-variant">{item.sourceNote}</p>}</article>; })}</div>}

    <OperationalFormSheet open={Boolean(draft)} title={draft?.id ? "Edit Template Harga" : "Tambah Template Harga"} onClose={requestClose} pending={pending} disabled={!canManage || !canSaveDraft} disabledReason={draftDisabledReason} submitLabel="Simpan Template" submittingLabel="Menyimpan..." onSubmit={save} statusText={draft ? `${draft.components.length} komponen · ${fullMoney(internalCost)} · Margin ${grossMargin.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%` : undefined} statusTone={!canSaveDraft ? "warning" : grossMargin < 0 ? "danger" : "success"}>
      {draft ? <div className="space-y-md">
        <FormSection title="1 · Identitas template" helper="Tipe menentukan konteks dan kategori budget; field lanjutan hanya muncul saat relevan.">
          <SheetSelect label="Tipe item" value={draft.itemType} onChange={(value) => changeType(value as ItemType)} options={[{ value: "CLIENT_LINE", label: "Baris Klien" }, { value: "MATERIAL_ITEM", label: "Material" }, { value: "WORK_PACKAGE", label: "Paket Tukang" }, { value: "SUBCON_PACKAGE", label: "Paket Subcon" }]} />
          <SheetSelect label="Kategori pengeluaran" readOnly={draft.itemType !== "CLIENT_LINE"} value={draft.expenseCategoryId} onChange={(value) => setDraft({ ...draft, expenseCategoryId: value })} options={categories.map((row) => ({ value: row.id, label: row.name, description: row.code }))} />
          <FormField label="Nama template" required error={nameTouched && !draft.name.trim() ? "Nama template wajib diisi." : undefined}><TextInput value={draft.name} onChange={(value) => { setNameTouched(true); setDraft({ ...draft, name: value }); }} aria-invalid={nameTouched && !draft.name.trim()} /></FormField>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><FormField label="Kategori item" required error={!draft.itemCategory.trim() ? "Kategori item wajib diisi." : undefined}><TextInput value={draft.itemCategory} onChange={(value) => setDraft({ ...draft, itemCategory: value })} aria-invalid={!draft.itemCategory.trim()} /></FormField><ComboboxField label="Satuan" value={draft.unit} onChange={(value) => setDraft({ ...draft, unit: value })} options={COMMON_UNIT_OPTIONS} error={!draft.unit.trim() ? "Satuan wajib diisi." : undefined} /></div>
          {draft.itemType === "MATERIAL_ITEM" ? <SheetSelect label="Tautan Material Master" value={draft.materialId ?? ""} onChange={(value) => setDraft({ ...draft, materialId: value || null })} options={[{ value: "", label: "Tanpa tautan material" }, ...materials.filter((row) => row.isActive).map((row) => ({ value: row.id, label: row.name }))]} /> : null}
        </FormSection>

        <FormSection title="2 · Rincian biaya" helper={`${draft.components.length} komponen. Buka satu komponen untuk mengedit tanpa memenuhi layar.`} action={<motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={addComponent} className="flex min-h-10 items-center gap-1 rounded-full bg-primary/10 px-3 text-[10px] font-bold text-primary"><CirclePlus className="h-4 w-4" /> Tambah</motion.button>}>
          <div className="space-y-2">{draft.components.map((component, index) => <CompactEditableItemRow key={component.key} status={component.label.trim() && component.quantity > 0 && component.unit.trim() ? "complete" : "warning"} title={component.label.trim() || `Komponen ${index + 1}`} meta={`${component.quantity} ${component.unit} · ${COMPONENT_TYPE_LABELS[component.componentType]}`} value={fullMoney(component.quantity * component.unitCost)} onClick={() => openComponent(component)} />)}</div>
        </FormSection>

        <FormSection title="3 · Harga untuk klien" helper="Aplikasi menghitung rekomendasi dan margin langsung dari total komponen.">
          <SegmentedTabs value={draft.pricingMode} ariaLabel="Metode harga klien" layoutId="library-pricing-mode" options={[{ value: "MARGIN_BASED", label: "Berdasarkan margin" }, { value: "FIXED_CLIENT_PRICE", label: "Harga tetap" }]} onChange={(pricingMode) => setDraft({ ...draft, pricingMode })} />
          {draft.pricingMode === "MARGIN_BASED" ? <FormField label="Target margin kotor (%)"><NumericInput min={0} max={95} value={draft.targetGrossPercentage * 100} onChange={(value) => setDraft({ ...draft, targetGrossPercentage: Number(value || 0) / 100 })} suffix="%" /></FormField> : <FormField label="Harga tetap untuk klien"><MoneyInput value={draft.fixedClientPrice} onChange={(value) => setDraft({ ...draft, fixedClientPrice: Number(value || 0) })} /></FormField>}
          <ValuePreviewStrip items={[{ label: "Biaya internal", amount: internalCost }, { label: "Harga klien", amount: clientPrice, tone: "success" }, { label: "Margin kotor", value: `${grossMargin.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`, tone: grossMargin < 0 ? "danger" : "success" }]} />
          {grossMargin < 0 ? <FormRiskNotice title="Harga di bawah biaya" tone="danger">Naikkan harga klien atau periksa kembali rincian biaya sebelum menyimpan.</FormRiskNotice> : null}
        </FormSection>

        <FormDisclosure title="Sumber & detail tambahan" description="Kode, vendor, tanggal berlaku, catatan, dan deskripsi" summary={[draft.code, draft.defaultVendorId, draft.sourceNote, draft.description].filter(Boolean).length > 0 ? `${[draft.code, draft.defaultVendorId, draft.sourceNote, draft.description].filter(Boolean).length} terisi` : "Opsional"} icon={<FileSearch className="h-4 w-4" />} expanded={showSourceDetails} onToggle={() => setShowSourceDetails((current) => !current)}><FormSection title="Sumber & detail" helper="Isi data yang membantu audit dan penggunaan ulang template.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><FormField label="Kode" optional><TextInput value={draft.code} onChange={(value) => setDraft({ ...draft, code: value })} /></FormField><DatePickerField label="Berlaku mulai" value={draft.effectiveFrom} onChange={(value) => setDraft({ ...draft, effectiveFrom: value })} /></div>
          <SheetSelect label="Vendor default" value={draft.defaultVendorId ?? ""} onChange={(value) => setDraft({ ...draft, defaultVendorId: value || null })} options={[{ value: "", label: "Tanpa vendor default" }, ...vendors.map((vendor) => ({ value: vendor.id, label: vendor.name }))]} />
          <SheetSelect label="Sumber harga" value={draft.priceSourceType} onChange={(value) => setDraft({ ...draft, priceSourceType: value as Draft["priceSourceType"] })} options={[{ value: "COST_BREAKDOWN", label: "Rincian biaya" }, { value: "VENDOR_QUOTE", label: "Penawaran vendor" }, { value: "HISTORICAL", label: "Riwayat harga" }, { value: "LEGACY_BACKFILL", label: "Data lama" }]} />
          <FormField label="Catatan sumber" optional><Textarea value={draft.sourceNote} onChange={(value) => setDraft({ ...draft, sourceNote: value })} placeholder="Penawaran, referensi, tanggal, dan asumsi harga" rows={2} /></FormField>
          <FormField label="Deskripsi" optional><Textarea value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} rows={2} /></FormField>
        </FormSection></FormDisclosure>
      </div> : null}
    </OperationalFormSheet>
    <OperationalFormSheet open={Boolean(componentEditor)} title={componentEditor && draft?.components.some((component) => component.key === componentEditor.key) ? "Edit Komponen Biaya" : "Tambah Komponen Biaya"} onClose={requestComponentClose} disabled={!componentEditorValid} disabledReason={!componentEditorValid ? "Lengkapi nama, jumlah, satuan, dan biaya satuan." : undefined} submitLabel="Simpan Komponen" onSubmit={saveComponent} statusText={componentEditor ? `${componentEditor.label.trim() || "Komponen belum diisi"} · ${fullMoney(componentEditor.quantity * componentEditor.unitCost)}` : undefined} statusTone={componentEditorValid ? "success" : "warning"}>
      {componentEditor ? <div className="space-y-md"><FormSection title="Jenis & nama biaya" helper="Satu komponen mewakili satu sumber biaya yang dapat digunakan kembali."><SheetSelect label="Tipe komponen" value={componentEditor.componentType} onChange={(value) => patchComponent({ componentType: value as ComponentType })} options={COMPONENT_TYPES.map((value) => ({ value, label: COMPONENT_TYPE_LABELS[value] }))} /><FormField label="Nama biaya" required error={componentNameTouched && !componentEditor.label.trim() ? "Nama biaya wajib diisi." : undefined}><TextInput autoFocus placeholder="Contoh: Material utama" value={componentEditor.label} onChange={(value) => { setComponentNameTouched(true); patchComponent({ label: value }); }} aria-invalid={componentNameTouched && !componentEditor.label.trim()} /></FormField></FormSection><FormSection title="Jumlah & biaya" helper="Subtotal diperbarui langsung sebelum komponen disimpan."><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><FormField label="Jumlah"><NumericInput min={0.01} value={componentEditor.quantity} onChange={(value) => patchComponent({ quantity: Number(value || 0) })} /></FormField><ComboboxField label="Satuan" value={componentEditor.unit} onChange={(value) => patchComponent({ unit: value })} options={COMMON_UNIT_OPTIONS} error={!componentEditor.unit.trim() ? "Satuan wajib diisi." : undefined} /></div><FormField label="Biaya satuan"><MoneyInput value={componentEditor.unitCost} showPreview={false} onChange={(value) => patchComponent({ unitCost: Number(value || 0) })} /></FormField><ValuePreviewStrip items={[{ label: "Subtotal komponen", amount: componentEditor.quantity * componentEditor.unitCost, tone: "success" }]} /></FormSection>{draft?.components.some((component) => component.key === componentEditor.key) ? <motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} disabled={(draft?.components.length ?? 0) <= 1} onClick={deleteComponent} className="min-h-12 w-full rounded-full bg-error-container/20 px-5 text-xs font-bold text-error disabled:opacity-35"><Trash2 className="mr-1.5 inline h-4 w-4" /> Hapus Komponen</motion.button> : null}</div> : null}
    </OperationalFormSheet>
    <ConfirmationSheet open={Boolean(confirmItem)} title={confirmItem?.isActive ? "Arsipkan template?" : "Aktifkan kembali template?"} description={confirmItem ? `${confirmItem.name} ${confirmItem.isActive ? "tidak akan muncul sebagai pilihan aktif." : "akan kembali tersedia sebagai pilihan."}` : ""} confirmLabel={confirmItem?.isActive ? "Arsipkan" : "Aktifkan"} danger={Boolean(confirmItem?.isActive)} pending={pending} onClose={() => setConfirmItem(null)} onConfirm={confirmToggle} />
    <ConfirmationModal open={confirmClose} title="Buang perubahan template?" description="Rincian biaya, harga klien, dan catatan yang belum disimpan akan hilang." tone="danger" onClose={() => setConfirmClose(false)} actions={<div className="grid grid-cols-2 gap-2"><motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setConfirmClose(false)} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold">Lanjut Mengedit</motion.button><motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => { setDraft(null); setDraftBaseline(""); setConfirmClose(false); }} className="min-h-12 rounded-full bg-error px-4 text-xs font-bold text-white">Buang Perubahan</motion.button></div>} />
    <ConfirmationModal open={confirmComponentClose} title="Buang perubahan komponen?" description="Isian komponen ini belum diterapkan ke template harga." tone="danger" onClose={() => setConfirmComponentClose(false)} actions={<div className="grid grid-cols-2 gap-2"><motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => setConfirmComponentClose(false)} className="min-h-12 rounded-full bg-surface-container px-4 text-xs font-bold">Lanjut Mengedit</motion.button><motion.button type="button" whileTap={{ scale: 0.97 }} transition={transitionSpringSnappy} onClick={() => { setComponentEditor(null); setComponentEditorBaseline(""); setConfirmComponentClose(false); }} className="min-h-12 rounded-full bg-error px-4 text-xs font-bold text-white">Buang Perubahan</motion.button></div>} />
  </section>;
}
